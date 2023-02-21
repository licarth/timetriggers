import { Api } from "@/Api";
import { rte } from "@/fp-ts";
import { countUsage } from "@/useCases";
import {
  Clock,
  getProjectByApiKey,
  Headers,
  JobScheduleArgs,
  RawBody,
  ScheduledAt,
} from "@timetriggers/domain";
import bodyParser from "body-parser";
import { max } from "date-fns";
import { Express } from "express";
import { pipe } from "fp-ts/lib/function.js";
import * as RT from "fp-ts/lib/ReaderTask.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as E from "fp-ts/lib/Either.js";

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
      const url = req.headers["x-timetriggers-url"] as string;
      const apiKeyValue = (req.headers["x-timetriggers-key"] as string) || "";

      await pipe(
        RTE.Do,
        RTE.bindW("scheduledAt", () =>
          pipe(
            req.headers["x-timetriggers-at"] as string,
            ScheduledAt.parseISOString,
            E.map((d) => max([d, clock.now()])),
            E.map(ScheduledAt.fromDate),
            RTE.fromEither
          )
        ),
        RTE.bindW("project", () =>
          pipe(
            getProjectByApiKey({ apiKeyValue }),
            RTE.mapLeft((e) => {
              if (e === "Project not found") {
                res.status(404).send({ success: false, error: e });
              } else {
                res.status(500).send({ success: false, error: e });
              }
              return "error-already-handled";
            })
          )
        ),
        RTE.bindW("rawBody", () => {
          return pipe(
            { _tag: "RawBody", raw: req.body.toString("utf8") },
            RawBody.codec.decode,
            RTE.fromEither
          );
        }),
        RTE.bindW("jobScheduleArgs", ({ rawBody, scheduledAt }) =>
          RTE.of(
            new JobScheduleArgs({
              scheduledAt,
              http: {
                url,
                options: {
                  method: req.method,
                  headers: Headers.fromExpress(req.headers),
                  body: rawBody,
                },
              },
            })
          )
        ),
        RTE.chainFirstW(
          ({ jobScheduleArgs, project: { id: projectId } }) =>
            pipe(
              api.schedule(jobScheduleArgs, projectId),
              RTE.fromTaskEither,
              rte.sideEffect((jobId) => res.send({ success: true, jobId }))
            )
          // Todo handle errors due to scheduling
        ),
        RTE.mapLeft((error) => {
          if (error === "error-already-handled") {
            console.log("error already handled");
          } else {
            res.sendStatus(500); // TODO useful error message to users
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
        }),
        logErrors
      )({ firestore, namespace, clock })();
    });
  return RTE.of(void 0);
};

const logErrors = <R, E, A>(rte: RTE.ReaderTaskEither<R, E, A>) =>
  pipe(
    rte,
    RTE.foldW(
      (error) => {
        console.error(error);
        return RT.of(void 0);
      },
      () => RT.of(void 0)
    )
  );
