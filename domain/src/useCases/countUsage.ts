import { ApiKey, Project } from "../project";
import { FieldValue } from "firebase-admin/firestore";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { JobScheduleArgs } from "@/domain";
import { format } from "date-fns";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
};

type Args = {
  project: Project;
  apiKeyValue: ApiKey["value"];
  jobScheduleArgs: JobScheduleArgs;
};

export const countUsage = ({ project, apiKeyValue, jobScheduleArgs }: Args) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.bindW("project", ({ firestore, namespace }) =>
      pipe(
        TE.tryCatchK(
          async () => {
            const usageDoc = firestore.doc(
              `/namespaces/${namespace}/usage/${project.id}/monthly/all}`
            );

            await usageDoc.update({
              [`planned.trigger.${format(
                jobScheduleArgs.scheduledAt.date,
                "yyyy.MM"
              )}`]: FieldValue.increment(1),
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
