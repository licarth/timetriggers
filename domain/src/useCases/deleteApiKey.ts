import { rte } from "@/fp-ts";
import { ApiKey, Project, ProjectId } from "@/project";
import { FieldValue, Firestore } from "firebase-admin/firestore";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
};

export const deleteApiKey = ({
  projectId,
  apiKey,
}: {
  projectId: ProjectId;
  apiKey: ApiKey;
}) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.bindW("project", ({ firestore, namespace }) =>
      pipe(
        TE.tryCatchK(
          async () => {
            const projectRef = firestore.doc(
              `/namespaces/${namespace}/projects/${projectId}`
            );
            const apiKeysToRemove = [ApiKey.codec("firestore").encode(apiKey)];

            await projectRef.update(
              "apiKeys",
              FieldValue.arrayRemove(...apiKeysToRemove)
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
