import { emulatorFirestore } from "@/Firebase/emulatorFirestore";
import { FirestoreDatastore } from "@/Firebase/Processor/FirestoreDatastore";
import { JobId, te } from "@timetriggers/domain";
import { addSeconds } from "date-fns";
import { initializeApp } from "../Firebase/initializeApp";

const { firestore } =
  process.env.EMULATOR === "true"
    ? emulatorFirestore()
    : initializeApp({
        serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      });

(async () => {
  const datastore = FirestoreDatastore.factory({
    firestore,
    namespace: `doi-production`,
  });

  const jobs = firestore
    .collection(datastore.rootJobsCollectionPath)
    .where("status.value", "==", "running")
    .where("jobDefinition.scheduledAt", "<", addSeconds(new Date(), -70))
    .limit(500);

  const jobsSnapshot = await jobs.get();

  for (const job of jobsSnapshot.docs) {
    console.log(job.id);
    await te.unsafeGetOrThrow(datastore.markAsDead(job.id as JobId));
  }

  console.log(`Long running jobs found : ${jobsSnapshot.size}`);

  console.log("✅ done");
})();
