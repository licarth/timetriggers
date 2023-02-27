import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import { e, te } from "@/fp-ts";
import {
  Clock,
  HttpCallCompleted,
  HttpCallErrored,
  HttpCallLastStatus,
  JobDefinition,
  JobDocument,
  JobId,
  JobScheduleArgs,
  JobStatus,
  ProjectId,
  RegisteredAt,
  SystemClock,
} from "@timetriggers/domain";
import { format } from "date-fns";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { draw } from "io-ts/lib/Decoder.js";
import _ from "lodash";
import { Observable } from "rxjs";
import { emulatorFirestore } from "../emulatorFirestore";
import { isFirebaseError } from "../isFirebaseError";
import { shardedFirestoreQuery } from "../shardedFirestoreQuery";
import {
  Datastore,
  GetJobsScheduledBeforeArgs as GetJobsScheduledBetweenArgs,
  ShardingAlgorithm,
  WaitForRegisteredJobsByRegisteredAtArgs,
} from "./Datastore";
import { ShardsToListenTo, toShards } from "./ShardsToListenTo";
import * as E from "fp-ts/lib/Either.js";

type State = "starting" | "running" | "stopped";

const preloadedHashingFunction = consistentHashingFirebaseArrayPreloaded(15);

type FirestoreDatastoreProps = {
  clock?: Clock;
  firestore: Firestore;
  rootDocumentPath: string;
};

export class FirestoreDatastore implements Datastore {
  private readonly clock;
  private readonly firestore;
  private readonly rootDocumentPath;
  private state: State = "starting";

  constructor(props: FirestoreDatastoreProps) {
    this.clock = props.clock || new SystemClock();
    this.firestore = props.firestore;
    this.rootDocumentPath = props.rootDocumentPath;
    console.log(
      `Initializing FirestoreDatastore with root path: ${this.rootDocumentPath}`
    );
    this.state = "running";
  }

  schedule(
    args: JobScheduleArgs,
    shardingAlgorithm?: ShardingAlgorithm | undefined,
    projectId?: ProjectId
  ) {
    return TE.tryCatch(
      async () => {
        const id = JobId.factory();
        const jobDefinition = new JobDefinition({ ...args, id });
        const jobDocumentRef = this.firestore
          .collection(`${this.rootDocumentPath}`)
          .doc(id);
        const scheduledWithin =
          jobDefinition.scheduledAt.getTime() - this.clock.now().getTime();
        const doc = {
          ...JobDocument.codec("firestore").encode(
            new JobDocument({
              jobDefinition,
              projectId,
              shards: shardingAlgorithm
                ? shardingAlgorithm(id).map((s) => s.toString())
                : [],
              status: new JobStatus({
                value: "registered",
                registeredAt: RegisteredAt.fromDate(this.clock.now()), // Will be overriden by server timestamp !
              }),
            })
          ),
          scheduledWithin: {
            "1s": scheduledWithin < 1000,
            "1m": scheduledWithin < 1000 * 60,
            "10m": scheduledWithin < 1000 * 60 * 10,
            "1h": scheduledWithin < 1000 * 60 * 60,
            "2h": scheduledWithin < 1000 * 60 * 60 * 2,
          },
        };
        const newLocal = {
          ..._.merge(doc, {
            status: { registeredAt: FieldValue.serverTimestamp() },
          }),
        };
        await jobDocumentRef.set(newLocal);
        return id;
      },
      (reason) => `Failed to schedule job: ${reason}`
    );
  }

  close() {
    this.state = "stopped";
    return TE.right(undefined);
  }
  static factory(props: Partial<FirestoreDatastoreProps> = {}) {
    return new FirestoreDatastore({
      clock: props.clock,
      firestore: props.firestore || emulatorFirestore().firestore,
      rootDocumentPath: props.rootDocumentPath || "",
    });
  }

  // order by registeredAt, jobDefinition.id asc
  // where jobDefinition.id > lastKnownJob.id

  getRegisteredJobsByScheduledAt(
    {
      minScheduledAt,
      maxScheduledAt,
      offset,
      limit,
      lastKnownJob,
    }: GetJobsScheduledBetweenArgs,
    shardsToListenTo?: ShardsToListenTo
  ) {
    return TE.tryCatch(
      async () => {
        console.log("[Datastore] Fetching jobs until " + maxScheduledAt);
        let query = shardedFirestoreQuery(
          this.firestore.collection(`${this.rootDocumentPath}`),
          toShards(shardsToListenTo)
        );
        if (minScheduledAt) {
          query = query.where("jobDefinition.scheduledAt", ">", minScheduledAt);
        }
        query = query
          .where("jobDefinition.scheduledAt", "<=", maxScheduledAt)
          .where("status.value", "==", "registered")
          .where("scheduledWithin.1h", "==", false)
          .orderBy("jobDefinition.scheduledAt", "asc")
          .orderBy("jobDefinition.id", "asc")
          .orderBy("status.registeredAt", "asc")
          .limit(limit);
        if (offset) {
          query = query.offset(offset);
        }
        if (lastKnownJob) {
          query = query.startAfter(lastKnownJob.scheduledAt, lastKnownJob.id);
        }

        const snapshot = await query.get();

        return pipe(
          snapshot.docs.map((doc) =>
            pipe(doc.data(), JobDocument.codec("firestore").decode)
          ),
          e.split,
          ({ successes }) => successes
        );
      },
      (reason) => new Error(`Failed to schedule next period: ${reason}`)
    );
  }

  waitForRegisteredJobsByRegisteredAt(
    args: WaitForRegisteredJobsByRegisteredAtArgs,
    shardsToListenTo?: ShardsToListenTo
  ): TE.TaskEither<"too many previous jobs", Observable<JobDocument[]>> {
    const { registeredAfter, maxNoticePeriodMs } = args;
    return TE.tryCatch(
      async () => {
        return new Observable((subscriber) => {
          console.log(
            `[Datastore] 🕐 Waiting for new jobs to schedule (${
              shardsToListenTo ? `${toShards(shardsToListenTo)}` : "all shards"
            }) \n Args ${JSON.stringify(args, null, 2)}`
          );

          let queryRoot = shardedFirestoreQuery(
            this.firestore.collection(`${this.rootDocumentPath}`),
            toShards(shardsToListenTo)
          );
          if (registeredAfter) {
            queryRoot = queryRoot.where(
              "status.registeredAt",
              ">=",
              registeredAfter
            );
          }
          if (maxNoticePeriodMs > 60 * 60 * 1000) {
            throw new Error(
              `maxNoticePeriodMs must be less than 1h for Firestore, got ${maxNoticePeriodMs} ms`
            );
          }

          queryRoot = queryRoot
            .where("status.value", "==", "registered")
            .where("scheduledWithin.1h", "==", true) // TODO change this depending on maxNoticePeriodMs arg
            .orderBy("status.registeredAt", "asc")
            .orderBy("jobDefinition.id", "asc");

          const unsubscribe = queryRoot.onSnapshot(async (snapshot) => {
            const addedDocs = snapshot
              .docChanges()
              .filter(({ type }, i) => type === "added")
              .map(({ doc }) => doc);

            addedDocs.length > 0 &&
              console.log(
                `Jobs : \n`,
                addedDocs
                  .map((doc) =>
                    doc.data().jobDefinition.scheduledAt.toDate().toISOString()
                  )
                  .join("\n")
              );

            console.log(
              addedDocs
                .map(
                  (doc) =>
                    `${format(
                      doc.data().status.registeredAt.toDate() as Date,
                      "yyyy-MM-ddTHH:mm:ss.SSSxxx"
                    )} => ${doc.data().jobDefinition.id}`
                )
                .join("\n")
            );
            pipe(
              addedDocs.map((doc) =>
                pipe(doc.data(), JobDocument.codec("firestore").decode)
              ),
              e.split,
              ({ successes, errors }) => {
                if (errors.length > 0) {
                  console.log(
                    `❌ Could not decode ${errors.length} documents !`
                  );
                  console.log(errors.map((e) => draw(e)));
                }
                return successes;
              },
              (jobs) => {
                if (jobs.length > 0) {
                  subscriber.next(jobs);
                }
              }
            );
          });
          return () => {
            subscriber.complete();
            console.log(`[Datastore] 🔇 unsubscribing from registered jobs`);
            unsubscribe();
          };
        });
      },
      (reason) => "too many previous jobs" as const
    );
  }

  queueJobs(jobDefinitions: JobDefinition[]): TE.TaskEither<any, void> {
    const batchSize = 500;
    const batches = _.chunk(jobDefinitions, batchSize).map((batch) =>
      this._queueJobsBatch(batch)
    );
    return pipe(
      batches,
      te.executeAllInArray(),
      TE.fromTask,
      TE.map(() => undefined)
    );
  }

  private _queueJobsBatch(
    jobDefinitions: JobDefinition[]
  ): TE.TaskEither<any, void> {
    console.log(
      `[Datastore] Queueing job(s) ${jobDefinitions
        .map(({ id }) => id)
        .join(", ")}`
    );
    if (jobDefinitions.length === 0) {
      return TE.right(undefined);
    }
    return pipe(
      TE.tryCatch<Error, { nonExistingJobIds: string[] }>(
        async () => {
          const okResponse = { nonExistingJobIds: [] };
          try {
            // Check that we're still running
            if (this.state !== "running") {
              throw new Error(
                "Datastore is not running anymore, not queuing job"
              );
            }
            return await queueJobDocuments({
              firestore: this.firestore,
              jobDefinitions,
              fromCollectionPath: this.rootDocumentPath,
            });
          } catch (reason) {
            // If code is 5 (NOT_FOUND), then the job was already moved by another instance
            if (
              String(reason).includes(
                "The client has already been terminated"
              ) &&
              this.state === "stopped" // This is expected if we're stopping
            ) {
              return okResponse;
            } else {
              // Report this error somehow to the user !
              // This will not be caught by the caller of this function as it's running in a setTimeout !
              console.log(
                `[state=${this.state}] Failed to queue jobs ${jobDefinitions
                  .map(({ id }) => id)
                  .join(", ")}: ${reason}`
              );
              throw reason;
            }
          }
        },
        (reason) => {
          return new Error(`Failed to queue jobs: ${reason}`);
        }
      ),
      TE.chain(({ nonExistingJobIds }) => {
        if (nonExistingJobIds.length > 0) {
          return TE.left(
            new Error(`Some jobs do not exist: ${nonExistingJobIds.join(", ")}`)
          );
        } else {
          return TE.right(undefined);
        }
      })
    );
  }

  markJobAsRunning({
    jobId,
    status,
  }: {
    jobId: JobId;
    status: JobStatus;
  }): TE.TaskEither<any, void> {
    return TE.tryCatch<Error, void>(
      async () => {
        try {
          // Check that we're still running
          if (this.state !== "running") {
            throw new Error("Datastore is not running anymore, not taking job");
          }
          // Make sure it's not already marked as running
          return this.firestore.runTransaction(async (transaction) => {
            const docRef = this.firestore.doc(
              `${this.rootDocumentPath}/${jobId}`
            );
            const doc = await transaction.get(docRef);

            if (!doc.exists) {
              throw new Error(`Job ${jobId} does not exist !`);
            }
            if (doc.exists && doc.data()?.status.value !== "queued") {
              throw new Error(
                `🔸 Job ${jobId} is not queued, cannot mark as running ! Status: ${
                  doc.data()?.status.value
                }. job has probably been taken by another instance.`
              );
            }
            transaction.update(docRef, {
              status: JobStatus.codec("firestore").encode(status),
            });
          });
        } catch (reason) {
          // If code is 5 (NOT_FOUND), then the job was already moved by another instance
          if (isFirebaseError(reason) && Number(reason.code) === 5) {
            // console.log(
            //   `Ignoring job ${jobDefinition.id} as it was already moved by another instance`
            // );
            return undefined;
          } else if (
            String(reason).includes("The client has already been terminated") &&
            this.state === "stopped" // This is expected if we're stopping
          ) {
            console.error(reason);
            return undefined;
          } else {
            // Report this error somehow to the user !
            // This will not be caught by the caller of this function as it's running in a setTimeout !
            console.log(
              `[state=${this.state}] Failed to mark job as running ${jobId}: ${reason}`
            );
            throw reason;
          }
        }
      },
      (reason) => {
        return new Error(`Failed to mark job as running: ${reason}`);
      }
    );
  }

  markJobAsComplete({
    jobId,
    lastStatusUpdate,
    status,
  }: {
    jobId: JobId;
    lastStatusUpdate: HttpCallCompleted | HttpCallErrored;
    status: JobStatus;
  }) {
    return pipe(
      TE.of(lastStatusUpdate),
      TE.chainW(
        TE.tryCatchK(
          () => {
            console.log(`[Datastore] Marking job ${jobId} as complete`);

            // Make sure it's not already marked as completed
            return this.firestore.runTransaction(async (transaction) => {
              const docRef = this.firestore.doc(
                `${this.rootDocumentPath}/${jobId}`
              );
              return te.unsafeGetOrThrow(
                pipe(
                  TE.Do,
                  TE.chainFirstW(() =>
                    checkPreconditions({
                      docRef,
                      transaction,
                      preconditions: [
                        (jobDocument) => jobDocument.status.value === "running",
                      ],
                    })
                  ),
                  TE.bindW("executionLagMs", ({}) =>
                    pipe(status.executionLagMs(), TE.fromEither)
                  ),
                  TE.bindW("durationMs", ({}) =>
                    pipe(status.durationMs(), TE.fromEither)
                  ),
                  TE.map(({ executionLagMs, durationMs }) => {
                    transaction.update(docRef, {
                      lastStatusUpdate:
                        HttpCallLastStatus.codec.encode(lastStatusUpdate),
                      executionLagMs,
                      durationMs,
                      status: JobStatus.codec("firestore").encode(status),
                    });
                  })
                )
              );
            });
          },
          (e) => {
            return new Error(
              `🔴 Failed to mark job ${jobId} as complete !: ${e}`
            );
          }
        )
      ),
      TE.map(() => void 0)
    );
  }

  cancel(jobId: JobId) {
    return TE.tryCatch(
      async () => {
        const jobDefinitionRef = this.firestore
          .collection(`${this.rootDocumentPath}`)
          .doc(jobId);
        await this.firestore.runTransaction(async (transaction) => {
          const jobDefinitionDoc = await transaction.get(jobDefinitionRef);
          if (!jobDefinitionDoc.exists) {
            throw new Error(`Job ${jobId} does not exist`);
          } else if (jobDefinitionDoc.data()?.status.value !== "registered") {
            throw new Error(`Job ${jobId} is not registered anymore`);
          }
          transaction.delete(jobDefinitionRef, { exists: true });
        });
      },
      (reason) => new Error(`Failed to cancel job: ${reason}`)
    );
  }

  /**
   * Returns immediately if there is at least one job to run, otherwise waits for the next job(s) to be queued.
   */
  waitForNextJobsInQueue(
    shardsToListenTo?: ShardsToListenTo
  ): TE.TaskEither<Error, Observable<JobDocument[]>> {
    return pipe(
      TE.tryCatch(
        async () => {
          return new Observable<JobDocument[]>((observer) => {
            const u = shardedFirestoreQuery(
              this.firestore.collection(`${this.rootDocumentPath}`),
              toShards(shardsToListenTo)
            )
              .where("status.value", "==", "queued")
              .orderBy("jobDefinition.scheduledAt", "asc")
              .onSnapshot((snapshot) => {
                const newDocs = snapshot
                  .docChanges()
                  .filter((change) => change.type === "added")
                  .map((change) => change.doc);

                newDocs.length > 0 &&
                  console.log(
                    `[Datastore] found ${snapshot.size} docs in queue...`
                  );
                const { errors, successes } = pipe(
                  newDocs.map((doc) =>
                    JobDocument.codec("firestore").decode(doc.data())
                  ),
                  e.split
                );
                if (errors.length !== 0) {
                  // continue to wait, but log the error
                  console.warn(
                    `[Datastore] got next job with errors: 
${errors.map((e) => indent(draw(e), 4)).join("\n--\n")}]
`
                  );
                }
                if (successes.length !== 0) {
                  console.log(
                    `[Datastore] got next ${successes.length} valid next jobs...`
                  );
                  // Check here if jobs are valid. If not, just wait.
                  const jobdefinitions = successes;
                  observer.next(jobdefinitions);
                } else {
                  // Just wait
                }
              });

            return () => {
              console.log(`[Datastore] 🔇 unsubscribing from queued jobs`);
              observer.complete();
              u();
            };
          });
        },
        (e) => new Error(`Could not get next job to run: ${e}`)
      )
    );
  }
}

export const queueJobDocuments = ({
  firestore,
  jobDefinitions,
  fromCollectionPath,
}: {
  firestore: FirebaseFirestore.Firestore;
  jobDefinitions: JobDefinition[];
  fromCollectionPath: string;
}) => {
  return firestore.runTransaction(async (transaction) => {
    const jobDocuments = await transaction.getAll(
      ...jobDefinitions.map((jobDefinition) =>
        firestore.collection(fromCollectionPath).doc(jobDefinition.id)
      )
    );

    const [existingJobDocuments, nonExistingJobDocuments] = _.partition(
      jobDocuments,
      (jobDocument) => jobDocument.exists
    );

    const [registeredJobDocuments, notRegisteredJobDocuments] = _.partition(
      existingJobDocuments,
      (jobDocument) => jobDocument.data()?.status.value === "registered"
    );

    registeredJobDocuments.forEach((existingJobDocument) => {
      transaction.update(
        firestore
          .collection(fromCollectionPath)
          .doc(`${existingJobDocument.id}`),
        {
          "status.value": "queued",
          "status.queuedAt": FieldValue.serverTimestamp(),
        }
      );
    });

    return {
      nonExistingJobIds: nonExistingJobDocuments.map(({ id }) => id),
      notRegisteredJobIds: notRegisteredJobDocuments.map(({ id }) => id),
    };
  });
};

const indent = (str: string, spaces = 2) => {
  return str
    .split("\n")
    .map((line) => " ".repeat(spaces) + line)
    .join("\n");
};

const waitUntil = (date: Date) => {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, date.getTime() - Date.now());
    return () => clearTimeout(timeout);
  });
};

const checkPreconditions = ({
  docRef,
  preconditions,
  transaction,
}: {
  preconditions: Array<(jobDocument: JobDocument) => boolean>;
  docRef: FirebaseFirestore.DocumentReference;
  transaction: FirebaseFirestore.Transaction;
}) =>
  pipe(
    TE.Do,
    TE.bind("docData", () =>
      TE.tryCatch(
        () => transaction.get(docRef),
        (e) => "failed to get job document" as const
      )
    ),
    TE.filterOrElseW(
      ({ docData }) => docData.exists,
      () => "job document does not exist" as const
    ),
    TE.chainEitherKW(({ docData }) =>
      JobDocument.codec("firestore").decode(docData.data())
    ),
    TE.filterOrElseW(
      (jobDocument) =>
        preconditions.every((precondition) => precondition(jobDocument)),
      (jobDocument) =>
        `job ${jobDocument.jobDefinition.id} does not satisfy preconditions` as const
    ),
    TE.map(() => void 0)
  );

// const docRef = this.firestore.doc(
//   `${this.rootDocumentPath}/${jobId}`
// );
// const doc = await transaction.get(docRef);

// if (!doc.exists) {
//   throw new Error(`Job ${jobId} does not exist !`);
// }
// return pipe(
//   JobDocument.codec("firestore").decode(doc.data()),
//   E.filterOrElseW(
//     (jobDocument) => jobDocument.status.value === "running",
//     (jobDocument) =>
//       `🔴 Job ${jobId} is not running, cannot mark as completed ! Status: ${jobDocument.status.value}. Job may have got executed twice !`
//   ),
