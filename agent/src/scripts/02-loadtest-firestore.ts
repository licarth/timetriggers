import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import { FirestoreDatastore } from "@/Firebase/Processor/FirestoreDatastore";
import {
  Http,
  JobId,
  JobScheduleArgs,
  ScheduledAt,
  Shard,
  te,
  Url,
} from "@timetriggers/domain";
import { addSeconds } from "date-fns";
import _ from "lodash";
import { initializeApp } from "../Firebase/initializeApp";

const { firestore } = initializeApp({
  serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
});

const preloadedHashingFunction = consistentHashingFirebaseArrayPreloaded(5);

(async () => {
  const now = new Date();

  // create a FirestoreDatastore
  const datastore = new FirestoreDatastore({
    firestore,
    namespace: `doi-production`,
  });

  const jobSchedulePromise = () =>
    te.unsafeGetOrThrow(
      datastore.schedule(
        new JobScheduleArgs({
          scheduledAt: ScheduledAt.fromDate(addSeconds(now, 3)),
          http: new Http({
            options: undefined,
            url: "https://api.timetriggers.io/1" as Url,
          }),
        }),
        (jobId: JobId) =>
          preloadedHashingFunction(jobId)
            .slice(1)
            .map((s) => {
              const parts = s.split("-");
              return new Shard({
                nodeCount: Number(parts[0]),
                nodeId: Number(parts[1]),
              });
            })
      )
    );

  const jobId = await Promise.all(_.times(10000, () => jobSchedulePromise()));

  console.log("jobId", jobId);
  console.log("✅ done");
})();
