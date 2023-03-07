import {
  Clock,
  getOneFromFirestore,
  MonthlyUsage,
  Project,
} from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import { match } from "ts-pattern";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
  clock: Clock;
};

type Args = {
  project: Project;
};

const FREE_PLAN_QUOTA = 500;

export const checkQuota = ({ project }: Args) =>
  pipe(
    RTE.ask<Dependencies>(),
    // If we're on the flex plan, we don't need to check usage
    RTE.bindW("usage", ({ clock }) =>
      match(project.getPricingPlan() || "free")
        .with("flex", () => RTE.of({ remaining: Infinity }))
        .with("free", () =>
          pipe(
            getOneFromFirestore(
              MonthlyUsage,
              `/projects/${project.id}/usage/all-forever:month`
            ),
            RTE.map((usage) => {
              const count = usage.getScheduleUsageForDate(clock.now());
              return {
                used: count,
                remaining:
                  (project.overrideQuotaLimit || FREE_PLAN_QUOTA) - count,
              };
            })
          )
        )
        .run()
    ),
    RTE.map(({ usage }) => usage)
  );
