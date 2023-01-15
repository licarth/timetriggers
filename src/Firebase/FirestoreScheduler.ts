import { Clock } from "@/Clock/Clock";
import { pipe } from "fp-ts/lib/function";
import type { Firestore } from "firebase-admin/firestore";
import * as TE from "fp-ts/lib/TaskEither";
import { addHours } from "date-fns";

export class FirestoreScheduler {
  clock;
  firestore;
  collection;
  // Acquire a lock on the namespace
  // Listen to changes in the scheduled jobs collection

  constructor(props: {
    clock: Clock;
    firestore: Firestore;
    collection: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>;
  }) {
    this.clock = props.clock;
    this.firestore = props.firestore;
    this.collection = props.collection;
  }

  run() {
    console.log("Running firestore scheduler");
    return pipe(this.scheduleNext2Hours());
  }

  scheduleNext2Hours() {
    return TE.tryCatch(
      async () => {
        const twoHoursFromNow = addHours(this.clock.now(), 2);
        const scheduledJobs = this.collection
          .where("scheduledAt", "<=", twoHoursFromNow)
          .onSnapshot((snapshot) => {
            console.log("Scheduled jobs: " + snapshot.size);
            snapshot.docs.forEach((doc) => console.log(doc.data()));
          });
      },
      (reason) => new Error(`Failed to schedule next 2 hours: ${reason}`)
    );
  }
}
