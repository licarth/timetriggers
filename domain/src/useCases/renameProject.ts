import { MonthlyUsage } from "@/MonthlyUsage";
import { FirebaseUserId, Project, ProjectId, ProjectSlug } from "@/project";
import { Auth } from "firebase-admin/auth";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { getProjectById } from "./getProjectById";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  auth: Auth;
  namespace: string;
};

export const renameProject = ({
  slug,
  projectId,
}: {
  slug: ProjectSlug;
  projectId: ProjectId;
}) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.chainW(({ firestore, namespace, auth }) =>
      RTE.fromTaskEither(
        TE.tryCatch(
          async () => {
            await firestore
              .doc(`/namespaces/${namespace}/projects/${projectId}`)
              .update({
                slug: ProjectSlug.codec.encode(slug),
              });
          },
          (e) => new Error(`Could not rename project: ${e}`)
        )
      )
    )
  );
