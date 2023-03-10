import { Api } from "@/Api";
import { rte } from "@/fp-ts";
import { checkQuota, countUsage } from "@/useCases";
import {
  Clock,
  getProjectByApiKey,
  Headers,
  Http,
  JobScheduleArgs,
  RawBody,
  ScheduledAt,
} from "@timetriggers/domain";
import bodyParser from "body-parser";
import { Express } from "express";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";

export const initializeEndpoints = ({
  app,
  api,
  firestore,
  namespace,
  clock,
}: {
  app: Express;
  api: Api;
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
      const url = req.headers["ttr-url"] as string;
      const apiKeyValue = (req.headers["ttr-api-key"] as string) || "";
      const options =
        ((req.headers["ttr-options"] as string) || "").split(",") || [];

      await pipe(
        RTE.Do,
        RTE.bindW("scheduledAt", () =>
          pipe(
            req.headers["ttr-scheduled-at"] as string,
            ScheduledAt.fromQueryLanguage,
            RTE.mapLeft((e) => `date-parsing-error: ${e.message}`),
            rte.sideEffect(
              (s) =>
                options.includes("no_noise") ||
                s.setMilliseconds(Math.random() * 1000)
            )
          )
        ),
        RTE.bindW("project", () => getProjectByApiKey({ apiKeyValue })),

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
        RTE.bindW("rawBody", () => {
          // If it's a buffer, call toString on it
          const raw =
            req.body instanceof Buffer ? req.body.toString("utf8") : "";
          return RTE.of(new RawBody({ raw }));
        }),
        RTE.bindW("jobScheduleArgs", ({ rawBody, scheduledAt }) =>
          RTE.of(
            new JobScheduleArgs({
              scheduledAt,
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
        RTE.chainFirstW(
          ({
            jobScheduleArgs,
            project: { id: projectId },
            quota,
            scheduledAt,
          }) => {
            return pipe(
              api.schedule(jobScheduleArgs, projectId),
              RTE.fromTaskEither,
              rte.sideEffect((jobId) => {
                if (quota.remaining < Infinity) {
                  res.setHeader(
                    "ttr-month-quota-remaining",
                    quota.remaining - 1
                  );
                }
                res.send({
                  success: true,
                  jobId,
                  scheduledAt: ScheduledAt.formatUTCFloorSecond(scheduledAt),
                });
              }),
              RTE.mapLeft((e) => "scheduling error" as const)
            );
          }
          // Todo handle errors due to scheduling
        ),

        RTE.mapLeft((error) => {
          if (error === "Project not found") {
            res
              .status(404)
              .send({ success: false, error: "project not found" });
          } else if (error === "Quota exceeded") {
            res.status(402).send({ success: false, error: "quota exceeded" });
          } else if (
            typeof error === "string" &&
            error.startsWith("date-parsing-error")
          ) {
            res.status(400).send({ success: false, error: error });
          } else {
            console.error(error);
            res.status(500).send({
              success: false,
              error: "internal error, please try again later",
            });
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
    });
  return RTE.of(void 0);
};
