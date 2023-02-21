import { ApiKey, Clock, JobScheduleArgs, Project } from "@timetriggers/domain";
import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";
import { FieldValue } from "firebase-admin/firestore";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
  clock: Clock;
};

type Args = {
  project: Project;
  apiKeyValue: ApiKey["value"];
  jobScheduleArgs: JobScheduleArgs;
};

const setUpdate = (update: { [key: string]: any }) => {
  return _.keys(update).reduce(
    (prev, currKey) => _.setWith(prev, currKey, update[currKey], Object),
    {}
  );
};

const utcFormat = (date: Date, f: string) => formatInTimeZone(date, "Z", f);

export const countUsage = ({ project, apiKeyValue, jobScheduleArgs }: Args) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.bindW("project", ({ firestore, namespace, clock }) =>
      pipe(
        TE.tryCatchK(
          async () => {
            const scheduledAt = jobScheduleArgs.scheduledAt;
            const nowUtc = zonedTimeToUtc(clock.now(), "UTC");
            const projectUsageDoc = firestore.doc(
              `/namespaces/${namespace}/projects/${project.id}/usage/all-forever:month`
            );
            const monthlyGlobalUsageDoc = firestore.doc(
              `/namespaces/${namespace}/global-usage/all-forever:month`
            );
            const hourlyGlobalUsageDoc = firestore.doc(
              `/namespaces/${namespace}/global-usage/planned-day:minute-${utcFormat(
                scheduledAt,
                "yyyy-MM-dd"
              )}`
            );

            const usageUpdate = {
              [`planned.trigger.${utcFormat(scheduledAt, "yyyy.MM")}`]:
                FieldValue.increment(1),
              [`done.api.schedule.${utcFormat(nowUtc, "yyyy.MM")}`]:
                FieldValue.increment(1),
            };
            const globalMonthMinuteUpdate = {
              [`trigger.${utcFormat(scheduledAt, "HH.mm")}`]:
                FieldValue.increment(1),
            };

            const withProjectId = (a: object) => ({
              projectId: project.id,
              ...a,
            });

            const b = firestore.batch();
            b.set(projectUsageDoc, withProjectId(setUpdate(usageUpdate)), {
              merge: true,
            });
            b.set(monthlyGlobalUsageDoc, setUpdate(usageUpdate), {
              merge: true,
            });
            b.set(hourlyGlobalUsageDoc, setUpdate(globalMonthMinuteUpdate), {
              merge: true,
            });
            await b.commit();
          },
          (reason) => {
            console.log("error", reason);
            return new Error(String(reason));
          }
        )
      )
    )
  );
