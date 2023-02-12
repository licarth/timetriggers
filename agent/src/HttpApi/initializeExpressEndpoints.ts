import { Api } from "@/Api";
import { JobId } from "@/domain/JobId";
import { JobScheduleArgs } from "@/domain/JobScheduleArgs";
import { rte } from "@/fp-ts";
import { Express } from "express";
import { pipe } from "fp-ts/lib/function.js";
import * as RT from "fp-ts/lib/ReaderTask.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";

export const initializeEndpoints = ({
  app,
  api,
}: {
  app: Express;
  api: Api;
}) => {
  app.post("/schedule", async (req, res) => {
    await pipe(
      RTE.Do,
      RTE.bindW("jobScheduleArgs", () => {
        console.log(req.body);
        return RTE.fromEither(JobScheduleArgs.codec.decode(req.body));
      }),
      RTE.chainW(
        ({ jobScheduleArgs }) =>
          pipe(
            api.schedule(jobScheduleArgs),
            RTE.fromTaskEither,
            rte.sideEffect((jobId) => res.send({ success: true, jobId }))
          )
        // Todo handle errors due to scheduling
      ),
      RTE.mapLeft((error) => {
        console.log(error);
        res.sendStatus(500); // TODO useful error message to users
      }),
      logErrors
    )(void 0)();
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
