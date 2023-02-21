import { MonthlyUsage } from "@/MonthlyUsage";
import { FirebaseUserId, Project, ProjectId, ProjectSlug } from "@/project";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
};

export const createProject = ({
  slug,
  creator,
}: {
  slug: ProjectSlug;
  creator: FirebaseUserId;
}) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.bindW("project", ({ firestore, namespace }) =>
      pipe(
        TE.tryCatchK(
          async () => {
            const projectId = ProjectId.generate();
            const projectRef = firestore.doc(
              `/namespaces/${namespace}/projects/${projectId}`
            );
            await firestore.runTransaction(async (t) => {
              if ((await t.get(projectRef)).exists) {
                throw new Error("Project already exists");
              }

              const project = new Project({
                id: projectId,
                slug,
                ownerId: creator,
                apiKeys: {},
                editorIds: [],
                readerIds: [],
              });
              const monthlyUsage = MonthlyUsage.empty;
              t.set(
                projectRef.collection("usage").doc("all-forever:month"),
                MonthlyUsage.codec.encode(monthlyUsage)
              );
              t.set(projectRef, Project.codec("firestore").encode(project));
            });
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
