import { Api } from "@/Api";
import { Headers } from "@/domain/Headers";
import { JobScheduleArgs } from "@/domain/JobScheduleArgs";
import { RawBody } from "@/domain/RawBody";
import { ScheduledAt } from "@/domain/ScheduledAt";
import { rte } from "@/fp-ts";
import { getProjectByApiKey } from "@timetriggers/domain";
import bodyParser from "body-parser";
import { Express } from "express";
import { pipe } from "fp-ts/lib/function.js";
import * as RT from "fp-ts/lib/ReaderTask.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import { draw } from "io-ts/lib/Decoder.js";

export const initializeEndpoints = ({
  app,
  api,
  firestore,
  namespace,
}: {
  app: Express;
  api: Api;
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
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
      const scheduledAt = ScheduledAt.fromUTCString(
        req.headers["x-timetriggers-at"] as string
      );
      const apiKeyValue = req.headers["x-timetriggers-key"] as string;

      await pipe(
        RTE.Do,
        RTE.bindW("project", () => getProjectByApiKey({ apiKeyValue })),
        RTE.bindW("rawBody", () => {
          return RTE.fromEither(
            RawBody.codec.decode({ raw: req.body.toString("utf8") })
          );
        }),
        RTE.chainW(
          ({ rawBody }) =>
            pipe(
              api.schedule(
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
              ),
              RTE.fromTaskEither,
              rte.sideEffect((jobId) => res.send({ success: true, jobId }))
            )
          // Todo handle errors due to scheduling
        ),
        RTE.mapLeft((error) => {
          // console.log(draw(error));
          res.sendStatus(500); // TODO useful error message to users
        }),
        logErrors
      )({ firestore, namespace })();
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
