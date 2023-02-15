import { Project, ProjectSlug } from "@/project";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
};

export const projectExists = ({ projectSlug }: { projectSlug: ProjectSlug }) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.chainW(({ firestore, namespace }) =>
      TE.tryCatchK(
        async () => {
          const snapshot = await firestore
            .collection(`/namespaces/${namespace}/projects`)
            .where("slug", "==", projectSlug)
            .count()
            .get();

          return snapshot.data().count > 0;
        },
        (reason) => new Error(String(reason))
      )
    )
  );
