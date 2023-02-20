import { MonthlyUsage } from "@/MonthlyUsage";
import { ProjectSlug } from "@/project";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import * as E from "fp-ts/lib/Either.js";
import { draw } from "io-ts/lib/Decoder";
import { flow } from "lodash";
import { getProjectBySlug } from "./getProjectBySlug";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
};

export const getProjectUsageFromSlug = ({
  projectSlug,
}: {
  projectSlug: ProjectSlug;
}) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.bindW("project", () => getProjectBySlug({ projectSlug })),
    RTE.chainW(({ project, firestore, namespace }) => {
      const usageDoc = firestore.doc(
        `/namespaces/${namespace}/projects/${project.id}/usage/all-forever:month`
      );
      return pipe(
        TE.tryCatch(
          async () => {
            const snapshot = await usageDoc.get();
            return snapshot;
          },
          (reason) => new Error(String(reason))
        ),
        TE.map((d) => (d.exists ? d.data() : {})),
        RTE.fromTaskEither
      );
    }),
    RTE.chainEitherKW(
      flow(
        MonthlyUsage.codec.decode,
        E.mapLeft((e) => {
          console.error(`Could not decode MonthlyUsage\n`, draw(e));
          return e;
        })
      )
    )
  );
