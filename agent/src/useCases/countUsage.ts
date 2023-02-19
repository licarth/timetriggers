import { ApiKey, Clock, Project } from "@timetriggers/domain";
import { FieldValue } from "firebase-admin/firestore";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { format } from "date-fns";
import { JobScheduleArgs } from "@timetriggers/domain";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
  clock: Clock;
};

type Args = {
  project: Project;
  apiKeyValue: ApiKey["value"];
  jobScheduleArgs: JobScheduleArgs;
};

export const countUsage = ({ project, apiKeyValue, jobScheduleArgs }: Args) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.bindW("project", ({ firestore, namespace, clock }) =>
      pipe(
        TE.tryCatchK(
          async () => {
            const usageDoc = firestore.doc(
              `/namespaces/${namespace}/projects/${project.id}/usage/monthly`
            );

            await usageDoc.update({
              [`planned.trigger.${format(
                jobScheduleArgs.scheduledAt.date,
                "yyyy.MM"
              )}`]: FieldValue.increment(1),
              [`done.api.schedule.${format(clock.now(), "yyyy.MM")}`]:
                FieldValue.increment(1),
            });
          },
          (reason) => {
            console.log("error", reason);
            return new Error(String(reason));
          }
        )
      )
    )
  );
