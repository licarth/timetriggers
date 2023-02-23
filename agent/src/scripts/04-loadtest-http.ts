import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import { FirestoreDatastore } from "@/Firebase/Processor/FirestoreDatastore";
import {
  JobId,
  JobScheduleArgs,
  ScheduledAt,
  Shard,
  te,
} from "@timetriggers/domain";
import { addSeconds } from "date-fns";
import _ from "lodash";
import { initializeApp } from "../Firebase/initializeApp";

const { firestore } = initializeApp({
  serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
});

const preloadedHashingFunction = consistentHashingFirebaseArrayPreloaded(5);

const executePromisesInBatches = <T>(
  promises: Promise<T>[],
  batchSize: number
) => {
  const batches = _.chunk(promises, batchSize);
  const newLocal = Promise.all<T[]>(
    batches.map((batch) => Promise.all<T>(batch))
  );
  return newLocal.then((batches) => _.flatMap(batches));
};

(async () => {
  const now = new Date();

  // create a FirestoreDatastore
  const datastore = new FirestoreDatastore({
    firestore,
    rootDocumentPath: `/namespaces/doi-production/jobs`,
  });

  const jobSchedulePromise = () =>
    fetch("https://api.timetriggers.io/schedule", {
      method: "GET",

      headers: {
        "X-Timetriggers-At": "2021-08-01T00:00:00.000Z",
        "X-Timetriggers-Key": "cj0LHUPjjDb5Pf3oEkdXXkfyb4euyija",
        "X-Timetriggers-Url": "https://api.timetriggers.io/1",
      },
    });

  const responses = await executePromisesInBatches(
    _.times(10, () => jobSchedulePromise()),
    2
  );

  console.log(
    "jobId",
    responses.map((r) => r.json())
  );
  console.log("✅ done");
})();
