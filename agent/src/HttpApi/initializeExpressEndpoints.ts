import { Api } from "@/Api";
import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import { ProductionDatastore } from "@/Firebase/Processor/Datastore";
import { rte } from "@/fp-ts";
import { checkQuota, countUsage } from "@/useCases";
import {
  Clock,
  CustomKey,
  getProjectByApiKey,
  Headers,
  Http,
  JobId,
  JobScheduleArgs,
  RawBody,
  ScheduledAt,
  Shard,
  te,
  Url,
} from "@timetriggers/domain";
import bodyParser from "body-parser";
import { Express } from "express";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";

interface Tagged {
  _tag: string;
}

const getLastHeaderValue = (
  rawHeaders: NodeJS.Dict<string | string[]>,
  key: string
) => {
  const value = rawHeaders[key];
  if (Array.isArray(value)) {
    return RTE.left("Header is an array" as const);
  }
  return RTE.of(value);
};

const preloadedHashingFunction = consistentHashingFirebaseArrayPreloaded(11);

const shardingAlgorithm = (jobId: JobId) =>
  preloadedHashingFunction(jobId)
    .slice(1)
    .map((s) => {
      const parts = s.split("-");
      return new Shard({
        nodeCount: Number(parts[0]),
        nodeId: Number(parts[1]),
      });
    });

export const initializeEndpoints = ({
  app,
  api,
  firestore,
  namespace,
  datastore,
  clock,
}: {
  app: Express;
  api: Api; // @deprecated
  datastore: ProductionDatastore;
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
  clock: Clock;
}) => {
  app
    .use(
      bodyParser.raw({
        inflate: true,
        limit: "100kb",
        type: "*/*",
      })
    )
    .all("/schedule", async (req, res) => {
      const apiKeyValue = (req.headers["ttr-api-key"] as string) || "";
      const options =
        ((req.headers["ttr-options"] as string) || "").split(",") || [];

      await pipe(
        RTE.Do,
        RTE.apSW(
          "url",
          pipe(Url.parse(req.headers["ttr-url"]), RTE.fromEither)
        ),
        RTE.apSW(
          "triggerId",
          getLastHeaderValue(req.headers, "ttr-trigger-id")
        ),
        RTE.apSW(
          "customKey",
          getLastHeaderValue(req.headers, "ttr-custom-key")
        ),
        RTE.apSW(
          "scheduledAt",
          pipe(
            req.headers["ttr-scheduled-at"] as string,
            ScheduledAt.fromQueryLanguage,
            RTE.mapLeft((e) => `date-parsing-error: ${e.message}` as const),
            rte.sideEffect(
              (s) =>
                options.includes("no_noise") ||
                s.setMilliseconds(Math.random() * 1000)
            )
          )
        ),
        RTE.apSW("project", getProjectByApiKey({ apiKeyValue })),
        RTE.apSW(
          "rawBody",
          RTE.of(
            new RawBody({
              raw: req.body instanceof Buffer ? req.body.toString("utf8") : "",
            })
          )
        ),
        RTE.bindW("quota", ({ project }) =>
          pipe(
            checkQuota({ project }),
            RTE.chainW((quota) =>
              quota.remaining > 0
                ? RTE.of(quota)
                : RTE.left("Quota exceeded" as const)
            )
          )
        ),
        RTE.bindW(
          "jobScheduleArgs",
          ({ rawBody, scheduledAt, url, triggerId, customKey }) =>
            RTE.of(
              new JobScheduleArgs({
                scheduledAt,
                id: triggerId as JobId,
                customKey: customKey as CustomKey,
                http: new Http({
                  url,
                  options: {
                    method: req.method,
                    headers: Headers.fromExpress(req.headers),
                    body: rawBody,
                  },
                }),
              })
            )
        ),
        RTE.chainFirstTaskEitherKW(
          ({
            jobScheduleArgs,
            project: { id: projectId },
            quota,
            scheduledAt,
          }) =>
            pipe(
              datastore.schedule(jobScheduleArgs, shardingAlgorithm, projectId),
              TE.map((x) => x), // This is needed to merge the TE types :/
              te.sideEffect(
                ({
                  jobDocument: {
                    jobDefinition: { id: jobId },
                  },
                  operation,
                }) => {
                  if (quota.remaining < Infinity) {
                    res.setHeader(
                      "ttr-month-quota-remaining",
                      quota.remaining - 1
                    );
                  }
                  res.setHeader(
                    "ttr-scheduled-at",
                    ScheduledAt.formatUTCFloorSecond(scheduledAt)
                  );
                  res.setHeader("ttr-trigger-id", jobId);
                  res.sendStatus(operation === "schedule" ? 201 : 200);
                }
              )
            )
        ),

        RTE.mapLeft((error) => {
          if (error === "Project not found" || error === "Job does not exist") {
            res.setHeader("ttr-error", error);
            res.sendStatus(404);
          } else if (error === "Invalid api key") {
            res.setHeader("ttr-error", "Invalid api key");
            res.sendStatus(401);
          } else if (error === "Custom key already in use") {
            res.setHeader("ttr-error", error);
            res.sendStatus(409);
          } else if (error === "Job is not in registered state") {
            res.setHeader("ttr-error", error);
            res.sendStatus(410);
          } else if (error === "Quota exceeded") {
            res.setHeader("ttr-error", "quota exceeded");
            res.sendStatus(402);
          } else if (
            (typeof error === "string" &&
              error.startsWith("date-parsing-error")) ||
            error === "not a valid url"
          ) {
            res.setHeader("ttr-error", error);
            res.sendStatus(400);
          } else {
            console.error(error);
            res.setHeader(
              "ttr-error",
              "internal error, please try again later"
            );
            res.sendStatus(500);
          }
          return error;
        }),
        // Below this point we don't run res.send anymore.

        RTE.chainW(({ project, jobScheduleArgs }) => {
          return countUsage({
            project,
            apiKeyValue,
            jobScheduleArgs,
          });
        })
      )({ firestore, namespace, clock })();
    })
    .all("/cancel", async (req, res) => {
      const apiKeyValue = (req.headers["ttr-api-key"] as string) || "";

      await pipe(
        RTE.Do,
        RTE.apSW(
          "triggerId",
          getLastHeaderValue(req.headers, "ttr-trigger-id")
        ),
        RTE.apSW(
          "customKey",
          getLastHeaderValue(req.headers, "ttr-custom-key")
        ),
        RTE.apSW("project", getProjectByApiKey({ apiKeyValue })),
        RTE.chainFirstEitherKW(({ customKey, triggerId }) => {
          if (customKey && triggerId) {
            return E.left(
              "Cannot specify both a custom key and a trigger id" as const
            );
          } else if (!customKey && !triggerId) {
            return E.left("Must specify a custom key or a trigger id" as const);
          } else {
            return E.right(undefined);
          }
        }),
        RTE.chainFirstW(
          ({ project: { id: projectId }, triggerId, customKey }) => {
            const op = triggerId
              ? datastore.cancel({ _tag: "JobId", jobId: triggerId as JobId })
              : datastore.cancel({
                  _tag: "CustomKey",
                  customKey: customKey as CustomKey,
                  projectId,
                });
            return pipe(
              op,
              RTE.fromTaskEither,
              RTE.mapLeft((x) => x),
              rte.sideEffect(() => {
                res.sendStatus(200);
              })
            );
          }
          // Todo handle errors due to scheduling
        ),
        RTE.mapLeft((error) => {
          if (error === "Project not found") {
            res.setHeader("ttr-error", "Project not found");
            res.sendStatus(404);
          } else if (error === "Invalid api key") {
            res.setHeader("ttr-error", "Invalid api key");
            res.sendStatus(401);
          } else if (
            error === "Job does not exist" ||
            error === "Custom key does not exist"
          ) {
            res.setHeader("ttr-error", "Job not found");
            res.sendStatus(404);
          } else if (error === "Job is not registered anymore") {
            res.setHeader("ttr-error", "Job is not registered anymore");
            res.sendStatus(410);
          } else if (error === "firebase-error") {
            res.setHeader("ttr-error", "Database error");
            res.sendStatus(500);
          } else if (
            (typeof error === "string" &&
              error.startsWith("date-parsing-error")) ||
            error == "Cannot specify both a custom key and a trigger id" ||
            error == "Must specify a custom key or a trigger id"
          ) {
            res.setHeader("ttr-error", error);
            res.sendStatus(400);
          } else {
            console.error(error);
            res.setHeader(
              "ttr-error",
              "internal error, please try again later"
            );
            res.sendStatus(500);
          }
          return error;
        })
      )({ firestore, namespace })();
    });
  return RTE.of(void 0);
};
