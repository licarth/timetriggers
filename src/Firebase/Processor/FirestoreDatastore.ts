import { Clock } from "@/Clock/Clock";
import { SystemClock } from "@/Clock/SystemClock";
import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import { FirestoreJobDocument } from "@/domain/FirebaseJobDocument";
import { JobDefinition } from "@/domain/JobDefinition";
import { JobId } from "@/domain/JobId";
import { JobScheduleArgs } from "@/domain/JobScheduleArgs";
import { RegisteredAt } from "@/domain/RegisteredAt";
import { e } from "@/fp-ts";
import {
  HttpCallCompleted,
  HttpCallErrored,
  HttpCallLastStatus,
} from "@/HttpCallStatusUpdate";
import { addMilliseconds } from "date-fns";
import type { Firestore } from "firebase-admin/firestore";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { draw } from "io-ts/lib/Decoder.js";
import { Observable } from "rxjs";
import { emulatorFirestore } from "../emulatorFirestore";
import { isFirebaseError } from "../isFirebaseError";
import { shardedFirestoreQuery } from "../shardedFirestoreQuery";
import {
  Datastore,
  GetJobsScheduledBeforeArgs,
  ShardingAlgorithm,
} from "./Datastore";
import { ShardsToListenTo, toShards } from "./ShardsToListenTo";

const REGISTERED_JOBS_COLL_PATH = `/registered`;
const QUEUED_JOBS_COLL_PATH = `/queued`;
const RUNNING_JOBS_COLL_PATH = `/running`;
const COMPLETED_JOBS_COLL_PATH = `/completed`;

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
    shardingAlgorithm?: ShardingAlgorithm | undefined
  ): TE.TaskEither<Error, JobId> {
    return TE.tryCatch(
      async () => {
        const id = JobId.factory();
        const jobDefinition = new JobDefinition({ ...args, id });
        const jobDocumentRef = this.firestore
          .collection(`${this.rootDocumentPath}${REGISTERED_JOBS_COLL_PATH}`)
          .doc(id);
        await jobDocumentRef.set(
          FirestoreJobDocument.codec.encode({
            jobDefinition,
            shards: shardingAlgorithm
              ? shardingAlgorithm(id).map((s) => s.toString())
              : [],
            registeredAt: RegisteredAt.fromDate(this.clock.now()),
          })
        );
        return id;
      },
      (reason) => new Error(`Failed to schedule job: ${reason}`)
    );
  }

  close(): TE.TaskEither<any, void> {
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

  getJobsScheduledBefore(
    { millisecondsFromNow, offset, limit }: GetJobsScheduledBeforeArgs,
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
          this.firestore.collection(
            `${this.rootDocumentPath}${REGISTERED_JOBS_COLL_PATH}`
          ),
          toShards(shardsToListenTo)
        )
          .where("jobDefinition.scheduledAt", "<=", periodFromNow)
          // .where("registeredAt", ">",  ) // After last known registeredAt
          .limit(limit);

        if (offset) {
          query = query.offset(offset);
        }

        const snapshot = await query.get();

        return pipe(
          snapshot.docs.map((doc) =>
            pipe(
              doc.data(),
              FirestoreJobDocument.codec.decode,
              E.map((x) => x.jobDefinition)
            )
          ),
          e.split,
          ({ successes }) => successes
        );
      },
      (reason) => new Error(`Failed to schedule next period: ${reason}`)
    );
  }

  listenToNewlyRegisteredJobs(
    {}: {},
    shardsToListenTo?: ShardsToListenTo
  ): TE.TaskEither<"too many previous jobs", Observable<JobDefinition[]>> {
    return TE.tryCatch(
      async () => {
        return new Observable((subscriber) => {
          console.log(
            `[Datastore] Listening to jobs for shards ${toShards(
              shardsToListenTo
            )}`
          );

          const unsubscribe = shardedFirestoreQuery(
            this.firestore.collection(
              `${this.rootDocumentPath}${REGISTERED_JOBS_COLL_PATH}`
            ),
            toShards(shardsToListenTo)
          )
            .where("registeredAt", ">", this.clock.now())
            .limitToLast(1)
            .orderBy("registeredAt", "asc")
            .onSnapshot((snapshot) => {
              const changes = snapshot
                .docChanges()
                .filter(({ type }, i) => type === "added"); // New jobs only
              console.log(
                `[Datastore] Received ${snapshot.size} new jobs with ${changes.length} changes!`
              );
              pipe(
                changes.map((change) =>
                  pipe(
                    change.doc.data(),
                    FirestoreJobDocument.codec.decode,
                    E.map((x) => x.jobDefinition)
                  )
                ),
                e.split,
                ({ successes, errors }) => {
                  if (errors.length > 0) {
                    console.log(
                      `❌ Could not decode ${errors.length} documents !`
                    );
                  }
                  return successes;
                },
                (jobs) => subscriber.next(jobs)
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
              fromCollectionPath: `${this.rootDocumentPath}${REGISTERED_JOBS_COLL_PATH}`,
              toCollectionPath: `${this.rootDocumentPath}${QUEUED_JOBS_COLL_PATH}`,
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
          await moveJobDefinition({
            firestore: this.firestore,
            jobDefinition,
            fromCollectionPath: `${this.rootDocumentPath}${QUEUED_JOBS_COLL_PATH}`,
            toCollectionPath: `${this.rootDocumentPath}${RUNNING_JOBS_COLL_PATH}`,
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
  }): TE.TaskEither<any, void> {
    return pipe(
      TE.of(lastStatusUpdate),
      TE.chainW(
        TE.tryCatchK(
          () => {
            return this.firestore.runTransaction(async (transaction) => {
              console.log(
                `[Datastore] Marking job ${jobDefinition.id} as complete`
              );
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
            return new Error(
              `🔴 Failed to mark job ${jobDefinition.id} as complete !: ${e}`
            );
          }
        )
      )
    );
  }

  cancel(jobId: JobId) {
    return TE.tryCatch(
      async () => {
        const jobDefinitionRef = this.firestore
          .collection(`${this.rootDocumentPath}${REGISTERED_JOBS_COLL_PATH}`)
          .doc(jobId);
        await jobDefinitionRef.delete();
      },
      (reason) => new Error(`Failed to cancel job: ${reason}`)
    );
  }

  waitForNextJobsInQueue(
    {
      limit,
    }: {
      limit: number;
    },
    shardsToListenTo?: ShardsToListenTo
  ): TE.TaskEither<Error, Observable<JobDefinition[]>> {
    if (this.state === "stopped") {
      return TE.left(new Error("Processor is not running"));
    }

    return pipe(
      TE.tryCatch<Error, Observable<JobDefinition[]>>(
        // Listen to the queue and check if there is a job to run
        () =>
          new Promise((resolve, reject) => {
            let unsubscribe: () => void = () => {
              console.error(
                `[Datastore] ❌ unsubscribe called but no listener was set`
              );
            };
            let next: (value: JobDefinition[] | undefined) => void;
            const observable = new Observable<JobDefinition[]>((observer) => {
              next = observer.next.bind(observer); // bind necessary ?
              return unsubscribe;
            });
            resolve(observable);
            const u = shardedFirestoreQuery(
              this.firestore.collection(
                `${this.rootDocumentPath}${QUEUED_JOBS_COLL_PATH}`
              ),
              toShards(shardsToListenTo)
            )
              .orderBy("jobDefinition.scheduledAt", "asc")
              .limit(limit)
              .onSnapshot((snapshot) => {
                // console.log(`[Datastore] found ${snapshot.size} docs...`);
                const { errors, successes } = pipe(
                  snapshot.docs.map((doc) =>
                    FirestoreJobDocument.codec.decode(doc.data())
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
                  unsubscribe && unsubscribe(); // Stop listening if the job can run
                  const jobdefinitions = successes.map(
                    (doc) => doc.jobDefinition
                  );
                  next(jobdefinitions);
                } else {
                  // Just wait
                }
              }, reject);
            unsubscribe = () => {
              console.log(`[Datastore] ✅ unsubscribe called...`);
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
}

export const moveJobDefinitions = ({
  firestore,
  jobDefinitions,
  fromCollectionPath,
  toCollectionPath,
}: {
  firestore: FirebaseFirestore.Firestore;
  jobDefinitions: JobDefinition[];
  fromCollectionPath: string;
  toCollectionPath: string;
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
      transaction.delete(
        firestore
          .collection(fromCollectionPath)
          .doc(`${existingJobDocument.id}`),
        { exists: true }
      );
      transaction.set(
        firestore.collection(toCollectionPath).doc(existingJobDocument.id),
        existingJobDocument.data()
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
