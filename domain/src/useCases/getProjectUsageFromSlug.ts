import { MonthlyUsage } from "@/MonthlyUsage";
import { ProjectSlug } from "@/project";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import { getOneFromFirestore } from "../firestore/getFirebaseEntity";
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
    RTE.apSW("project", getProjectBySlug({ projectSlug })),
    RTE.chainW(({ project: { id } }) =>
      getOneFromFirestore(
        MonthlyUsage,
        `/projects/${id}/usage/all-forever:month`
      )
    )
  );
