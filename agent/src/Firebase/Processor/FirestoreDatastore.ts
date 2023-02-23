import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import { e } from "@/fp-ts";
import {
  HttpCallCompleted,
  HttpCallErrored,
  HttpCallLastStatus,
} from "@/HttpCallStatusUpdate";
import {
  Clock,
  JobDefinition,
  JobDocument,
  JobId,
  JobScheduleArgs,
  JobStatus,
  ProjectId,
  RegisteredAt,
  SystemClock,
} from "@timetriggers/domain";
import {
  addMilliseconds,
  addSeconds,
  differenceInSeconds,
  format,
} from "date-fns";
import type { Firestore } from "firebase-admin/firestore";
import * as E from "fp-ts/lib/Either.js";
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
  GetJobsScheduledBeforeArgs,
  LastKnownRegisteredJob,
  ShardingAlgorithm,
  WaitForRegisteredJobsByRegisteredAtArgs,
} from "./Datastore";
import { ShardsToListenTo, toShards } from "./ShardsToListenTo";
import { FieldValue } from "firebase-admin/firestore";
import { Timestamp } from "@google-cloud/firestore";

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
        console.log(newLocal);
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
  // where status.registeredAt >= lastKnownJob.registeredAt
  getScheduledJobsByScheduledAt(
    {
      millisecondsFromNow,
      offset,
      limit,
      lastKnownJob,
    }: GetJobsScheduledBeforeArgs,
    shardsToListenTo?: ShardsToListenTo
  ) {
    return TE.tryCatch(
      async () => {
        const periodFromNow = addMilliseconds(
          this.clock.now(),
          millisecondsFromNow
        );
        console.log("[Datastore] Fetching jobs until " + periodFromNow);
        let query = shardedFirestoreQuery(
          this.firestore.collection(`${this.rootDocumentPath}`),
          toShards(shardsToListenTo)
        )
          .where("jobDefinition.scheduledAt", "<=", periodFromNow)
          .where("status.value", "==", "registered")
          .orderBy("jobDefinition.scheduledAt", "asc")
          .orderBy("jobDefinition.id", "asc")
          .orderBy("status.registeredAt", "asc")
          .limit(limit);
        if (lastKnownJob) {
          query = query;
          // .where("jobDefinition.id", ">", lastKnownJob.id)
          // .where("status.registeredAt", ">=", lastKnownJob.registeredAt);
        }
        if (offset) {
          query = query.offset(offset);
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
    const { registeredAfter, offset, limit, lastKnownJob } = args;
    console.log(
      `[Scheduler] 🕐 Waiting for new jobs... ${JSON.stringify(args, null, 2)}`
    );
    return TE.tryCatch(
      async () => {
        return new Observable((subscriber) => {
          console.log(
            `[Datastore] Listening to jobs for shards ${toShards(
              shardsToListenTo
            )}`
          );

          let queryRoot = shardedFirestoreQuery(
            this.firestore.collection(`${this.rootDocumentPath}`),
            toShards(shardsToListenTo)
          )
            .where("status.registeredAt", ">=", registeredAfter)
            .where("status.value", "==", "registered")
            .where("scheduledWithin.1h", "==", true)
            .orderBy("status.registeredAt", "asc")
            .orderBy("jobDefinition.id", "asc");

          if (offset) {
            queryRoot = queryRoot.offset(offset);
          }
          if (limit) {
            queryRoot = queryRoot.limit(limit);
          }

          let paginatedQuery = queryRoot;

          if (lastKnownJob) {
            paginatedQuery = queryRoot.startAfter(
              lastKnownJob.registeredAt,
              lastKnownJob.id
            );
          }
          const unsubscribe = paginatedQuery.limit(1).onSnapshot(async (s) => {
            // Unsubsribe only if there are some results
            s.docs.length > 0 && unsubscribe();

            console.log(
              `Snapshot with ${s.docs.length} docs received: `,
              s.readTime.toDate().toISOString()
            );

            s.docs.length > 0 &&
              console.log(
                `Jobs : \n`,
                s.docs
                  .map((doc) =>
                    doc.data().jobDefinition.scheduledAt.toDate().toISOString()
                  )
                  .join("\n")
              );
            // const changes = snapshot
            //   .docChanges()
            //   .filter(({ type }, i) => type === "added"); // New jobs only
            // console.log(
            //   `[Datastore] Received ${snapshot.size} new jobs with ${changes.length} changes!`
            // );

            // If paginated, wait until 1 second after lastKnownJob.registeredAt to let Firestore distribute documents (we won't come back)
            // TODO : add a mechanism that checks from time to time if we did not miss any jobs (in case Firestore takes more than 1 second to distribute jobs)

            const t0 = this.clock.now();
            const t1 = addSeconds(
              addSeconds(t0, 10),
              -differenceInSeconds(t0, lastKnownJob?.registeredAt || t0)
            );
            console.log(
              "lastKnownJob",
              lastKnownJob?.registeredAt?.toISOString()
            );
            console.log("t0", t0.toISOString());
            console.log("t1", t1.toISOString());
            // if (lastKnownJob?.registeredAt) {
            await waitUntil(t1);
            // }
            let pQuery = queryRoot.where("status.registeredAt", "<", t0);
            if (lastKnownJob) {
              paginatedQuery = queryRoot.startAfter(
                lastKnownJob.registeredAt,
                lastKnownJob.id
              );
            }
            const snapshot = await pQuery.get();

            console.log(
              snapshot.docs
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
              snapshot.docs.map((doc) =>
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
                  subscriber.complete();
                  console.log(
                    `[Datastore] 🔇 unsubscribing from registered jobs`
                  );
                }
              }
            );
          });
          return () => {
            console.log("Unsubscribing from new jobs");
            subscriber.complete();
            unsubscribe();
          };
        });
      },
      (reason) => "too many previous jobs" as const
    );
  }

  queueJobs(jobDefinitions: JobDefinition[]): TE.TaskEither<any, void> {
    console.log(
      `[Datastore] Queueing job(s) ${jobDefinitions
        .map((s) => s.id)
        .join(", ")}...`
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
            return await moveJobDefinitions({
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
                `[state=${
                  this.state
                }] Failed to queue jobs ${jobDefinitions.join(", ")}: ${reason}`
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

  markJobAsRunning(jobDefinition: JobDefinition): TE.TaskEither<any, void> {
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
              `${this.rootDocumentPath}/${jobDefinition.id}`
            );
            const doc = await transaction.get(docRef);

            if (!doc.exists) {
              throw new Error(`Job ${jobDefinition.id} does not exist !`);
            }
            if (doc.exists && doc.data()?.status.value !== "queued") {
              throw new Error(
                `🔸 Job ${
                  jobDefinition.id
                } is not queued, cannot mark as running ! Status: ${
                  doc.data()?.status.value
                }. job has probably been taken by another instance.`
              );
            }
            transaction.update(docRef, {
              "status.value": "running",
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
              `[state=${this.state}] Failed to mark job as running ${jobDefinition.id}: ${reason}`
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
    jobDefinition,
    lastStatusUpdate,
    durationMs,
    executionStartDate,
  }: {
    jobDefinition: JobDefinition;
    lastStatusUpdate: HttpCallCompleted | HttpCallErrored;
    durationMs: number;
    executionStartDate: Date;
  }) {
    return pipe(
      TE.of(lastStatusUpdate),
      TE.chainW(
        TE.tryCatchK(
          () => {
            console.log(
              `[Datastore] Marking job ${jobDefinition.id} as complete`
            );

            const docRef = this.firestore.doc(
              `${this.rootDocumentPath}/${jobDefinition.id}`
            );
            // Make sure it's not already marked as completed
            return this.firestore.runTransaction(async (transaction) => {
              const doc = await transaction.get(docRef);
              if (!doc.exists) {
                throw new Error(`Job ${jobDefinition.id} does not exist !`);
              }
              if (doc.exists && doc.data()?.status.value !== "running") {
                throw new Error(
                  `🔴 Job ${
                    jobDefinition.id
                  } is not running, cannot mark as completed ! Status: ${
                    doc.data()?.status.value
                  }. Job may have got executed twice !`
                );
              }
              transaction.update(docRef, {
                jobDefinition:
                  JobDefinition.codec("firestore").encode(jobDefinition),
                lastStatusUpdate:
                  HttpCallLastStatus.codec.encode(lastStatusUpdate),
                executionLagMs:
                  executionStartDate.getTime() -
                  jobDefinition.scheduledAt.getTime(),
                durationMs,
                "status.value": "completed",
              });
            });
          },
          (e) => {
            return new Error(
              `🔴 Failed to mark job ${jobDefinition.id} as complete !: ${e}`
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
    {
      limit,
    }: {
      limit: number;
    },
    shardsToListenTo?: ShardsToListenTo
  ): TE.TaskEither<Error, Observable<JobDocument[]>> {
    return pipe(
      TE.tryCatch<Error, Observable<JobDocument[]>>(
        // Listen to the queue and check if there is a job to run
        () =>
          new Promise((resolve, reject) => {
            let unsubscribe: () => void = () => {
              console.error(
                `[Datastore] ❌ unsubscribe called but no listener was set`
              );
            };
            let next: (value: JobDocument[] | undefined) => void;
            let complete: () => void;
            const observable = new Observable<JobDocument[]>((observer) => {
              next = observer.next.bind(observer); // bind necessary ?
              complete = observer.complete.bind(observer);
              return unsubscribe;
            });
            resolve(observable);
            const u = shardedFirestoreQuery(
              this.firestore.collection(`${this.rootDocumentPath}`),
              toShards(shardsToListenTo)
            )
              .where("status.value", "==", "queued")
              .orderBy("jobDefinition.scheduledAt", "asc")
              .limit(limit)
              .onSnapshot((snapshot) => {
                console.log(
                  `[Datastore] found ${snapshot.size} docs in queue...`
                );
                const { errors, successes } = pipe(
                  snapshot.docs.map((doc) =>
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
                  unsubscribe();
                  console.log(
                    `[Datastore] got next ${successes.length} valid next jobs...`
                  );
                  // Check here if jobs are valid. If not, just wait.
                  // unsubscribe && unsubscribe(); // Stop listening if the job can run
                  const jobdefinitions = successes;
                  next(jobdefinitions);
                  complete();
                } else {
                  // Just wait
                }
              }, reject);
            unsubscribe = () => {
              console.log(`[Datastore] ✅ queue unsubscribe called...`);
              u();
            };
          }),
        (e) => new Error(`Could not get next job to run: ${e}`)
      )
      // Todo execute only one update at a time ?
      // TE.chainW((snapshot) =>
      //   pipe(
      //     TE.of(snapshot),
      //     TE.chainW((snapshot) => {
      //       console.log(`Found ${snapshot.size} jobs in the queue`);
      //       if (snapshot.size === 0) {
      //         // continue to wait for the next job
      //         return this.waitForNextJob();
      //       }
      //       return this.takeFirstValidAvailableJob(_.shuffle(snapshot.docs), 0);
      //     })
      //   )
      // )
    );
  }

  getJobsInQueue(
    { offset, limit }: GetJobsScheduledBeforeArgs,
    shardsToListenTo?: ShardsToListenTo
  ) {
    return TE.tryCatch(
      async () => {
        console.log("[Datastore] Fetching queued jobs ");
        let query = shardedFirestoreQuery(
          this.firestore.collection(`${this.rootDocumentPath}`),
          toShards(shardsToListenTo)
        )
          .where("status.value", "==", "queued")
          .limit(limit);

        if (offset) {
          query = query.offset(offset);
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
      (reason) =>
        new Error(`[Datastore] Failed to get next jobs from queue: ${reason}`)
    );
  }
}

export const moveJobDefinitions = ({
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

    const existingJobDocuments = jobDocuments.filter(
      (jobDocument) => jobDocument.exists
    );

    const nonExistingJobDocuments = jobDocuments.filter(
      (jobDocument) => !jobDocument.exists
    );

    existingJobDocuments.forEach((existingJobDocument) => {
      transaction.update(
        firestore
          .collection(fromCollectionPath)
          .doc(`${existingJobDocument.id}`),
        {
          "status.value": "queued",
        }
      );
    });

    return { nonExistingJobIds: nonExistingJobDocuments.map(({ id }) => id) };
  });
};

export const moveJobDefinition = ({
  firestore,
  jobDefinition,
  fromCollectionPath,
  toCollectionPath,
}: {
  firestore: FirebaseFirestore.Firestore;
  jobDefinition: JobDefinition;
  fromCollectionPath: string;
  toCollectionPath: string;
}) => {
  return firestore.runTransaction(async (transaction) => {
    const existingJobDocument = await transaction.get(
      firestore.collection(fromCollectionPath).doc(jobDefinition.id)
    );
    if (!existingJobDocument.exists) {
      throw new Error(
        `Document ${jobDefinition.id} does not exist in ${fromCollectionPath}`
      );
    }
    transaction.delete(
      firestore.collection(fromCollectionPath).doc(`${jobDefinition.id}`),
      { exists: true }
    );
    transaction.set(
      firestore.collection(toCollectionPath).doc(jobDefinition.id),
      existingJobDocument.data()
    );
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
