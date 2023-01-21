import { Clock } from "@/Clock/Clock";
import { JobDefinition } from "@/JobDefinition";
import { JobId } from "@/JobId";
import { WorkerPool } from "@/WorkerPool";
import { addMilliseconds } from "date-fns";
import type { Firestore } from "firebase-admin/firestore";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import { isFirebaseError } from "./isFirebaseError";
import { moveJobDefinition } from "./moveJobFromCollectionToCollection";

export const REGISTERED_JOBS_COLL_PATH = `/registered`;
export const QUEUED_JOBS_COLL_PATH = `/queued`;
export const RUNNING_JOBS_COLL_PATH = `/running`;
export const COMPLETED_JOBS_COLL_PATH = `/completed`;

/**
 * Amount of time to schedule jobs in advance locally for.
 */
const SCHEDULE_ADVANCE_MS = 10 * 60 * 1000; // 10 minutes

type State = "starting" | "running" | "stopped";

type FirestoreSchedulerProps = {
  clock: Clock;
  firestore: Firestore;
  rootDocumentPath: string;
};

export class FirestoreScheduler {
  clock;
  firestore;
  rootDocumentPath;
  state: State = "starting";
  // Acquire a lock on the namespace
  // Listen to changes in the scheduled jobs collection

  plannedTimeouts = new Map<JobId, NodeJS.Timeout>();

  unsubscribeListeningToNewJobs?: () => void;

  constructor(props: FirestoreSchedulerProps) {
    this.clock = props.clock;
    this.firestore = props.firestore;
    this.rootDocumentPath = props.rootDocumentPath;
  }

  runEveryMs = (ms: number, f: () => void) => () => {
    const id = setInterval(() => {
      f();
    }, ms);
    clearInterval(id);
  };

  run() {
    this.state = "running";
    this.runEveryMs(Math.floor(SCHEDULE_ADVANCE_MS / 2), () => {
      this.scheduleNext2Hours();
    });
    return pipe(this.startListeningToNewJobs());

    // TODO fix
    // 1. Listen to only newly added jobs with onSnapshot(), and for every 'new document' that has a scheduled date within the next 2 hours, schedule the queuing operation
    // --. Listen to document changes to find rescheduling of existing jobs, and reschedule them  => Won't do for now
    // 3. Once listening is started, schedule the next 2 hours only by running a query with firestore.get() to find all documents to schedule in the next 2 hours
    // 4. Rerun that query every hour, by making sure that we're not rescheduling jobs that are already scheduled
  }

  startListeningToNewJobs() {
    return TE.tryCatch(
      async () => {
        let isFirst = true;
        this.unsubscribeListeningToNewJobs = this.firestore
          .collection(`${this.rootDocumentPath}${REGISTERED_JOBS_COLL_PATH}`)
          .onSnapshot((snapshot) => {
            // Ignore first snapshot
            if (isFirst) {
              isFirst = false;
              return;
            }
            snapshot
              .docChanges()
              .filter(({ type }, i) => type === "added") // New jobs only
              .forEach((change) =>
                pipe(
                  change.doc.data(),
                  JobDefinition.firestoreCodec.decode,
                  E.foldW(
                    () => {},
                    (jobDefinition) => {
                      this.scheduleJobLocally(jobDefinition);
                    }
                  )
                )
              );
          });
      },
      (reason) => new Error(`Failed to schedule next 2 hours: ${reason}`)
    );
  }

  getDocumentPath(jobDefinition: JobDefinition) {
    return `${this.rootDocumentPath}${REGISTERED_JOBS_COLL_PATH}/${jobDefinition.id}`;
  }

  async queueJob(jobDefinition: JobDefinition) {
    try {
      // Check that we're still running
      if (this.state !== "running") {
        return;
      }
      await moveJobDefinition({
        firestore: this.firestore,
        jobDefinition,
        fromCollectionPath: `${this.rootDocumentPath}${REGISTERED_JOBS_COLL_PATH}`,
        toCollectionPath: `${this.rootDocumentPath}${QUEUED_JOBS_COLL_PATH}`,
      }).catch((reason) => {
        // If code is 5 (NOT_FOUND), then the job was already moved by another instance
        if (isFirebaseError(reason) && Number(reason.code) === 5) {
          // console.log(
          //   `Ignoring job ${jobDefinition.id} as it was already moved by another instance`
          // );
          return;
        }
        console.log(`Failed to queue job ${jobDefinition.id}: ${reason}`);
      });
    } catch (reason) {
      // Report this error somehow to the user !
      // This will not be caught by the caller of this function as it's running in a setTimeout !
      console.log(`Failed to queue job ${jobDefinition.id} locally: ${reason}`);
    }
  }

  scheduleJobLocally(jobDefinition: JobDefinition) {
    const timeoutId = this.clock.setTimeout(() => {
      this.queueJob(jobDefinition);
    }, jobDefinition.scheduledAt.date.getTime() - this.clock.now().getTime());
    this.plannedTimeouts.set(jobDefinition.id, timeoutId);
  }

  /**
   * This method should be called regularily, at least twice per period (if period = 2h, then once an hour)
   * */
  scheduleNext2Hours() {
    return TE.tryCatch(
      async () => {
        const periodFromNow = addMilliseconds(
          this.clock.now(),
          SCHEDULE_ADVANCE_MS
        );
        const snapshot = await this.firestore
          .collection(`${this.rootDocumentPath}${REGISTERED_JOBS_COLL_PATH}`)
          .where("scheduledAt", "<=", periodFromNow)
          .get();
        // console.log("Scheduled jobs: " + snapshot.size);
        snapshot.docs.forEach((doc) =>
          pipe(
            doc.data(),
            JobDefinition.firestoreCodec.decode,
            E.foldW(
              () => {},
              (jobDefinition) => {
                this.scheduleJobLocally(jobDefinition);
              }
            )
          )
        );
      },
      (reason) => new Error(`Failed to schedule next 2 hours: ${reason}`)
    );
  }

  close() {
    return TE.tryCatch(
      async () => {
        this.unsubscribeListeningToNewJobs &&
          this.unsubscribeListeningToNewJobs();
      },
      (reason) => new Error(`Failed to close firestore scheduler: ${reason}`)
    );
  }

  cancelAllJobs() {
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
