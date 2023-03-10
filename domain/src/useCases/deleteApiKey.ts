import { ApiKey, ProjectId } from "@/project";
import { FieldValue } from "firebase-admin/firestore";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
};

type Args = {
  projectId: ProjectId;
  apiKey: ApiKey;
};

export const deleteApiKey = ({ projectId, apiKey }: Args) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.bindW("project", ({ firestore, namespace }) =>
      pipe(
        TE.tryCatchK(
          async () => {
            const projectRef = firestore.doc(
              `/namespaces/${namespace}/projects/${projectId}`
            );

            await projectRef.update(
              `apiKeys.${apiKey.value}`,
              FieldValue.delete()
            );
          },
          (reason) => {
            console.log("error", reason);
            return new Error(String(reason));
          }
        )
      )
    )
  );
