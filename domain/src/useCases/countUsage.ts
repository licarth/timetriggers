import { ApiKey, Project } from "../project";
import { FieldValue } from "firebase-admin/firestore";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
};

type Args = {
  project: Project;
  apiKeyValue: ApiKey["value"];
  //   jobArgs:
};

export const countUsage = ({ project, apiKeyValue }: Args) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.bindW("project", ({ firestore, namespace }) =>
      pipe(
        TE.tryCatchK(
          async () => {
            const projectRef = firestore.doc(
              `/namespaces/${namespace}/monthly-usage/${project.id}`
            );

            await projectRef.update(`planned.trigger`, FieldValue.increment(1));
          },
          (reason) => {
            console.log("error", reason);
            return new Error(String(reason));
          }
        )
      )
    )
  );
