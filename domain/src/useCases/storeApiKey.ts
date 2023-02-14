import { rte } from "@/fp-ts";
import { ApiKey, Project, ProjectId } from "@/project";
// import { FieldValue, Firestore } from "firebase-admin/firestore";
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
            return (await projectRef.get()).data();
            // await projectRef.update(
            //   "apiKeys",
            //   FieldValue.arrayUnion(...newApiKeys)
            // );
          },
          (reason) => new Error(String(reason))
        ),
        RTE.chainEitherKW(Project.codec("firestore").decode)
      )
    ),
    rte.sideEffect(({ project }) => {
      project.apiKeys = project.apiKeys || [];
      project.apiKeys.push(apiKey);
    }),
    RTE.chainW(({ project, firestore, namespace }) =>
      pipe(
        TE.tryCatchK(
          async () => {
            const projectRef = firestore.doc(
              `/namespaces/${namespace}/projects/${projectId}`
            );
            await projectRef.set(Project.codec("firestore").encode(project));
          },
          (reason) => new Error(String(reason))
        )
      )
    )
  );
