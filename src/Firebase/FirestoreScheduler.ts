import { Clock } from "@/Clock/Clock";
import { pipe } from "fp-ts/lib/function";
import type { Firestore } from "firebase-admin/firestore";
import * as TE from "fp-ts/lib/TaskEither";
import { addHours } from "date-fns";
import { JobDefinition } from "@/JobDefinition";
import * as E from "fp-ts/lib/Either";
import { JobId } from "@/JobId";

export class FirestoreScheduler {
  clock;
  firestore;
  rootDocumentPath;
  // Acquire a lock on the namespace
  // Listen to changes in the scheduled jobs collection

  plannedTimeouts = new Map<JobId, NodeJS.Timeout>();

  unsubscribe?: () => void;

  constructor(props: {
    clock: Clock;
    firestore: Firestore;
    rootDocumentPath: string;
  }) {
    this.clock = props.clock;
    this.firestore = props.firestore;
    this.rootDocumentPath = props.rootDocumentPath;
  }

  run() {
    console.log("Running firestore scheduler");
    return pipe(this.scheduleNext2Hours());
  }

  scheduleNext2Hours() {
    return TE.tryCatch(
      async () => {
        const twoHoursFromNow = addHours(this.clock.now(), 2);
        this.unsubscribe = this.firestore
          .collection(`${this.rootDocumentPath}/registered`)
          .where("scheduledAt", "<=", twoHoursFromNow)
          .onSnapshot((snapshot) => {
            // console.log("Scheduled jobs: " + snapshot.size);
            snapshot.docs.forEach(
              (doc) =>
                pipe(
                  doc.data(),
                  JobDefinition.firestoreCodec.decode,
                  E.foldW(
                    () => {},
                    (jobDefinition) => {
                      const timeoutId = this.clock.setTimeout(async () => {
                        await this.firestore.runTransaction(
                          async (transaction) => {
                            transaction.delete(doc.ref);
                            transaction.set(
                              this.firestore
                                .collection(`${this.rootDocumentPath}/queued`)
                                .doc(`${jobDefinition.id}`),
                              JobDefinition.firestoreCodec.encode(jobDefinition)
                            );
                          }
                        );
                      }, jobDefinition.scheduledAt.date.getTime() - this.clock.now().getTime());
                      this.plannedTimeouts.set(jobDefinition.id, timeoutId);
                    }
                  )
                )
              // // Schedule locally to move the job to the queued collection
              // this.clock.setTimeout(() => {

              // },
              // doc.get("scheduledAt").toDate().getTime() - this.clock.now().getTime());
            );
          });
      },
      (reason) => new Error(`Failed to schedule next 2 hours: ${reason}`)
    );
  }

  close() {
    return TE.tryCatch(
      async () => {
        this.unsubscribe && this.unsubscribe();
      },
      (reason) => new Error(`Failed to close firestore scheduler: ${reason}`)
    );
  }

  cancellAllJobs() {
    // Will cancell all jobs that have not been put in the queue yet
    return TE.tryCatch(
      async () => {
        this.plannedTimeouts.forEach((timeout) => {
          clearTimeout(timeout);
        });
        this.plannedTimeouts.clear();
      },
      (reason) => new Error(`Failed to cancel all jobs: ${reason}`)
    );
  }
}
