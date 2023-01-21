import { Clock } from "@/Clock/Clock";
import { HttpCallCompleted } from "@/HttpCallStatusUpdate/HttpCallCompleted";
import { HttpCallErrored } from "@/HttpCallStatusUpdate/HttpCallErrored";
import { HttpCallLastStatus } from "@/HttpCallStatusUpdate/HttpCallLastStatus";
import { HttpCallStarted } from "@/HttpCallStatusUpdate/HttpCallStarted";
import { JobDefinition } from "@/JobDefinition";
import { WorkerPool } from "@/WorkerPool";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import _ from "lodash";
import {
  COMPLETED_JOBS_COLL_PATH,
  QUEUED_JOBS_COLL_PATH,
  RUNNING_JOBS_COLL_PATH,
} from "./FirestoreScheduler";
import { isFirebaseError } from "./isFirebaseError";

type FirestoreProcessorProps = {
  firestore: FirebaseFirestore.Firestore;
  rootDocumentPath: string;
  clock: Clock;
  workerPool: WorkerPool;
};

export class FirestoreProcessor {
  firestore;
  rootDocumentPath;
  unsubscribe?: () => void;
  state: "idle" | "running" | "closed" = "idle";
  reject?: (reason?: any) => void;
  clock;
  workerPool;

  constructor(props: FirestoreProcessorProps) {
    this.firestore = props.firestore;
    this.rootDocumentPath = props.rootDocumentPath;
    this.clock = props.clock;
    this.workerPool = props.workerPool;
  }

  run() {
    this.state = "running";
    this.takeNextJob()();
    return TE.of(this);
  }

  waitForNextJob(): TE.TaskEither<any, JobDefinition> {
    if (this.state === "closed") {
      return TE.left(new Error("Processor is not running"));
    }
    return pipe(
      TE.tryCatch(
        // Listen to the queue and check if there is a job to run
        () =>
          new Promise<
            FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>
          >((resolve, reject) => {
            this.reject = reject;
            this.unsubscribe = this.firestore
              .collection(`${this.rootDocumentPath}${QUEUED_JOBS_COLL_PATH}`)
              .orderBy("scheduledAt", "asc")
              .limit(5)
              .onSnapshot((snapshot) => {
                if (snapshot.size !== 0) {
                  this.unsubscribe && this.unsubscribe(); // Stop listenning if the job can run
                  resolve(snapshot);
                } else {
                  // Just wait
                }
              }, reject);
          }),
        (e) => new Error("Could not get next job")
      ),
      // Todo execute only one update at a time ?
      TE.chainW((snapshot) =>
        pipe(
          TE.of(snapshot),
          TE.chainW((snapshot) => {
            if (snapshot.size === 0) {
              // continue to wait for the next job
              return this.waitForNextJob();
            }
            return this.takeFirstValidAvailableJob(_.shuffle(snapshot.docs), 0);
          })
        )
      )
    );
  }

  takeFirstValidAvailableJob(
    docs: FirebaseFirestore.QueryDocumentSnapshot[],
    index: number
  ): TE.TaskEither<any, JobDefinition> {
    const jobDocument = docs[index];
    if (!jobDocument) {
      return this.waitForNextJob();
    }
    return pipe(
      JobDefinition.firestoreCodec.decode(jobDocument.data()),
      TE.fromEither,
      TE.chainFirstW(this.markJobAsRunning(jobDocument)), // Must fail if the job is already running
      TE.orElseW(() => this.takeFirstValidAvailableJob(docs, index + 1))
      // Take next one if it fails
    );
  }

  takeNextJob(): TE.TaskEither<any, void> {
    return pipe(
      this.waitForNextJob(),
      TE.chainFirstW((jobDefinition) => pipe(this.processJob(jobDefinition))),
      TE.chainW(() => this.takeNextJob())
    );
  }

  markJobAsRunning(jobDocument: FirebaseFirestore.QueryDocumentSnapshot) {
    return TE.tryCatchK(
      async () => {
        await this.firestore
          .runTransaction(async (transaction) => {
            transaction.delete(jobDocument.ref, { exists: true });
            transaction.create(
              this.firestore.doc(
                `${this.rootDocumentPath}${RUNNING_JOBS_COLL_PATH}/${jobDocument.id}`
              ),
              jobDocument.data()
            );
          })
          .catch((e) => {
            if (isFirebaseError(e)) {
              throw new Error(
                "Cannot process job, it's already taken by another worker"
              );
            } else {
              throw e;
            }
          });
      },
      (e) => e
    );
  }

  processJob(jobDefinition: JobDefinition) {
    return pipe(
      TE.of({ executionStartDate: this.clock.now(), jobDefinition }),
      TE.bindW("worker", () => this.workerPool.nextWorker()),
      TE.bindW(
        "lastStatusUpdate",
        // send job to worker (local or remote) and listen to result stream.
        ({ worker, jobDefinition }) =>
          TE.tryCatch(
            () =>
              new Promise<HttpCallLastStatus>((resolve, reject) =>
                worker.execute(jobDefinition).subscribe((next) => {
                  if (next instanceof HttpCallStarted) {
                    // Report Call started
                  } else if (next instanceof HttpCallCompleted) {
                    resolve(next);
                  } else if (next instanceof HttpCallErrored) {
                    resolve(next);
                  }
                })
              ),
            (e) => new Error("Could not execute job")
          )
      ),
      TE.map(({ lastStatusUpdate, executionStartDate }) => ({
        lastStatusUpdate,
        durationMs: this.clock.now().getTime() - executionStartDate.getTime(),
        executionStartDate,
      })),
      TE.chainW(this.markJobAsComplete(jobDefinition))
    );
  }

  markJobAsComplete(jobDefinition: JobDefinition) {
    return ({
      lastStatusUpdate,
      durationMs,
      executionStartDate,
    }: {
      lastStatusUpdate: HttpCallLastStatus;
      durationMs: number;
      executionStartDate: Date;
    }) =>
      pipe(
        TE.of(lastStatusUpdate),
        TE.chainW(
          TE.tryCatchK(
            async () => {
              await this.firestore.runTransaction(async (transaction) => {
                transaction.create(
                  this.firestore.doc(
                    `${this.rootDocumentPath}${COMPLETED_JOBS_COLL_PATH}/${jobDefinition.id}`
                  ),
                  {
                    jobDefinition:
                      JobDefinition.firestoreCodec.encode(jobDefinition),
                    lastStatusUpdate:
                      HttpCallLastStatus.codec.encode(lastStatusUpdate),
                    executionLagMs:
                      executionStartDate.getTime() -
                      jobDefinition.scheduledAt.date.getTime(),
                    durationMs,
                  }
                );
                transaction.delete(
                  this.firestore.doc(
                    `${this.rootDocumentPath}${RUNNING_JOBS_COLL_PATH}/${jobDefinition.id}`
                  ),
                  { exists: true }
                );
              });
            },
            (e) => {
              // console.log("Error: " + e);
              return TE.of(undefined);
            }
          )
        )
      );
  }

  close() {
    this.state = "closed";
    this.unsubscribe && this.unsubscribe();
    this.reject && this.reject();
  }
}
