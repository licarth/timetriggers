import { Project, ProjectId } from "@/project";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
};

export const getProject = ({ projectId }: { projectId: ProjectId }) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.chainW(({ firestore, namespace }) =>
      TE.tryCatchK(
        async () => {
          const snapshot = await firestore
            .doc(`/namespaces/${namespace}/projects/${projectId}`)
            .get();

          return pipe(snapshot.data());
        },
        (reason) => new Error(String(reason))
      )
    ),
    RTE.chainEitherKW(Project.codec("firestore").decode)
  );
