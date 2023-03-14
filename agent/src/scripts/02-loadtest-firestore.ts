import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import { DatastoreApi } from "@/Firebase/DatastoreApi";
import { FirestoreDatastore } from "@/Firebase/Processor/FirestoreDatastore";
import {
  Http,
  JobScheduleArgs,
  ScheduledAt,
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
  const api = new DatastoreApi({ datastore });

  const jobSchedulePromise = () =>
    te.unsafeGetOrThrow(
      api.schedule(
        new JobScheduleArgs({
          scheduledAt: ScheduledAt.fromDate(addSeconds(now, 3)),
          http: new Http({
            options: undefined,
            url: "https://api.timetriggers.io/1" as Url,
          }),
        })
      )
    );

  const jobId = await Promise.all(_.times(10000, () => jobSchedulePromise()));

  console.log("jobId", jobId);
  console.log("✅ done");
})();
