import { JobDefinition } from "@/JobDefinition";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import axios, { AxiosResponse } from "axios";
import * as T from "fp-ts/lib/Task";
import _ from "lodash";
import { Clock } from "@/Clock/Clock";
import {
  COMPLETE_JOBS_COLL_PATH,
  QUEUED_JOBS_COLL_PATH,
  RUNNING_JOBS_COLL_PATH,
} from "./FirestoreScheduler";
import { isFirebaseError } from "./isFirebaseError";

export class FirestoreProcessor {
  firestore;
  rootDocumentPath;
  unsubscribe?: () => void;
  state: "idle" | "running" | "closed" = "idle";
  reject?: (reason?: any) => void;
  clock;

  constructor(props: {
    firestore: FirebaseFirestore.Firestore;
    rootDocumentPath: string;
    clock: Clock;
  }) {
    this.firestore = props.firestore;
    this.rootDocumentPath = props.rootDocumentPath;
    this.clock = props.clock;
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
      TE.bindW(
        "executionResult",
        pipe(
          TE.tryCatchK(
            async ({ jobDefinition }) => {
              try {
                const axiosResponse = await axios.post(jobDefinition.url, {
                  callbackId: jobDefinition.id,
                });
                return {
                  axiosResponse,
                };
              } catch (e) {
                if (axios.isAxiosError(e)) {
                  return {
                    axiosResponse: e.response,
                    errorMessage: e.message,
                  };
                } else if (e instanceof Error) {
                  return {
                    errorMessage: e.message,
                  };
                }
                throw e;
              }
            },
            (e) => e
          )
          // TE.orElseW((e) =>
          //   TE.of({
          //     errorMessage: "Unknown error",
          //   })
          // )
        )
      ),
      TE.map(({ executionResult, executionStartDate }) => ({
        ...executionResult,
        durationMs: this.clock.now().getTime() - executionStartDate.getTime(),
        executionStartDate,
      })),
      TE.map((x) => x),
      TE.chainW(this.markJobAsComplete(jobDefinition))
    );
  }

  markJobAsComplete(jobDefinition: JobDefinition) {
    return ({
      axiosResponse,
      durationMs,
      executionStartDate,
    }: {
      axiosResponse?: AxiosResponse;
      durationMs: number;
      executionStartDate: Date;
    }) =>
      pipe(
        TE.of(axiosResponse),
        TE.chainW(
          TE.tryCatchK(
            async () => {
              await this.firestore.runTransaction(async (transaction) => {
                transaction.create(
                  this.firestore.doc(
                    `${this.rootDocumentPath}${COMPLETE_JOBS_COLL_PATH}/${jobDefinition.id}`
                  ),
                  {
                    jobDefinition:
                      JobDefinition.firestoreCodec.encode(jobDefinition),
                    status: axiosResponse?.status,
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
