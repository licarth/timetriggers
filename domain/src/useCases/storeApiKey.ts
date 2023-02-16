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

export const storeApiKey = ({
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
            await projectRef.update(
              `apiKeys.${apiKey.value}`,
              ApiKey.codec("firestore").encode(apiKey)
            );
          },
          (reason) => {
            //@ts-ignore
            console.log(reason.stack);
            return new Error(String(reason));
          }
        )
      )
    )
  );
