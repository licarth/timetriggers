import { Project, ProjectId } from "@/project";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
};

export const getProjectById = ({ projectId }: { projectId: ProjectId }) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.chainW(({ firestore, namespace }) =>
      TE.tryCatchK(
        async () => {
          const snapshot = await firestore
            .collection(`/namespaces/${namespace}/projects`)
            .where("id", "==", projectId)
            .limit(1)
            .get();

          return snapshot.docs;
        },
        (reason) => new Error(String(reason))
      )
    ),
    RTE.filterOrElseW(
      (d) => d.length !== 0,
      () => "Project not found"
    ),
    RTE.filterOrElseW(
      (d) => d.length < 2,
      () => `Multiple projects found for slug ${projectId}`
    ),
    RTE.map((d) => pipe(d[0].data())),
    RTE.chainEitherKW(Project.codec("firestore").decode)
  );
