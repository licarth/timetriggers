import {
  Clock,
  CustomKey,
  e,
  getOneFromFirestore,
  HttpCallCompleted,
  HttpCallErrored,
  HttpCallLastStatus,
  JobDefinition,
  JobDocument,
  JobId,
  JobScheduleArgs,
  JobStatus,
  ProjectId,
  RateLimit,
  RegisteredAt,
  SystemClock,
  te,
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
  CancelProps,
  Datastore,
  GetJobsScheduledBeforeArgs as GetJobsScheduledBetweenArgs,
  ShardingAlgorithm,
  WaitForRegisteredJobsByRegisteredAtArgs,
} from "./Datastore";
import { ShardsToListenTo, toShards } from "./ShardsToListenTo";

type State = "starting" | "running" | "stopped";

type FirestoreDatastoreProps = {
  clock?: Clock;
  firestore: Firestore;
  namespace: string;
};

export class FirestoreDatastore implements Datastore {
  private readonly clock;
  private readonly firestore;
  private readonly namespace;
  readonly rootJobsCollectionPath;
  readonly rootProjectsCollectionPath;

  private state: State = "starting";

  constructor(props: FirestoreDatastoreProps) {
    this.clock = props.clock || new SystemClock();
    this.firestore = props.firestore;
    this.namespace = props.namespace;
    this.rootJobsCollectionPath = `/namespaces/${props.namespace}/jobs`;
    this.rootProjectsCollectionPath = `/namespaces/${props.namespace}/projects`;
    console.log(
      `Initializing FirestoreDatastore with root path: ${this.rootJobsCollectionPath}`
    );
    this.state = "running";
  }

  markRateLimited(jobDocument: JobDocument, rateLimits: RateLimit[]) {
    const id = jobDocument.jobDefinition.id;
    const jobDocRef = this.jobDocRef(id);
    const rateLimitCollection = this.jobDocRef(id).collection("rate-limits");
    console.log(
      `[Datastore] Marking job ${id} as rate limited : [${jobDocument.rateLimitKeys?.join(
        ","
      )}]`
    );
    return pipe(
      TE.tryCatch(
        () =>
          this.firestore.runTransaction(async (t) => {
            return await te.unsafeGetOrThrow(
              pipe(
                TE.Do,
                TE.chainW(() =>
                  pipe(
                    checkPreconditions({
                      docRef: jobDocRef,
                      transaction: t,
                      preconditions: [
                        (jobDocument) => ({
                          test: jobDocument.status.value === "registered",
                          errorMessage:
                            `should be registered, is ${jobDocument.status.value} instead.` as const,
                        }),
                      ],
                    }),
                    te.sideEffect(() => {
                      t.set(
                        jobDocRef,
                        {
                          status: {
                            value: "rate-limited",
                            rateLimitedAt: FieldValue.serverTimestamp(),
                          },
                          rateLimitKeys: jobDocument.rateLimitKeys,
                        },
                        { merge: true }
                      );
                      rateLimits.forEach((rateLimit) => {
                        t.create(
                          rateLimitCollection.doc(rateLimit.key),
                          {
                            ...RateLimit.codec("firestore").encode(rateLimit),
                            createdAt: FieldValue.serverTimestamp(),
                          } // TODO Move this to the domain
                        );
                      });
                    })
                  )
                )
              )
            );
          }),
        (reason) =>
          `Failed to mark job ${id} as rate limited: ${reason}` as const
      ),
      TE.map(() => undefined)
    );
  }

  schedule(
    args: JobScheduleArgs,
    shardingAlgorithm?: ShardingAlgorithm | undefined,
    projectId?: ProjectId
  ) {
    return TE.tryCatch(
      async () => {
        const newJobId = JobId.factory();
        const jobDefinition = new JobDefinition({ ...args, id: newJobId });
        const scheduledWithin =
          jobDefinition.scheduledAt.getTime() - this.clock.now().getTime();
        const doc = {
          ...JobDocument.codec("firestore").encode(
            new JobDocument({
              jobDefinition,
              projectId,
              shards: shardingAlgorithm
                ? shardingAlgorithm(newJobId).map((s) => s.toString())
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
        const jobWithServerTimestamp = {
          ..._.merge(doc, {
            status: { registeredAt: FieldValue.serverTimestamp() },
          }),
        };
        await this.firestore.runTransaction(async (t) => {
          const customKeyAlreadyExists =
            (args.customKey &&
              (await t.get(this.customKeyRef(projectId, args.customKey)))
                .exists) ||
            false;
          const existingJobIdFromCustomKey =
            args.customKey &&
            ((await t.get(this.customKeyRef(projectId, args.customKey))).get(
              "id"
            ) as JobId);
          if (args.id) {
            const existingJobRef = this.jobDocRef(args.id);
            // trigger id provided
            // it has to exist already
            const existingJobDoc = await t.get(existingJobRef).then((doc) => {
              if (!doc.exists) {
                throw `Failed to reschedule job ${newJobId}: job does not exist` as const;
              }
              return pipe(
                JobDocument.codec("firestore").decode(doc.data()!),
                e.unsafeGetOrThrow
              );
            });
            if (args.customKey || existingJobDoc.jobDefinition.customKey) {
              if (existingJobDoc.jobDefinition.customKey === args.customKey) {
                // Same custom key, nothing to do
              } else {
                // New custom key, just make sure no other job already has it, in the same project
                if (customKeyAlreadyExists) {
                  throw `Failed to reschedule job ${newJobId}: custom key ${args.customKey} already exists` as const;
                }
                t.delete(
                  this.customKeyRef(
                    projectId,
                    existingJobDoc.jobDefinition.customKey!
                  )
                );
              }
              // Make sure no other job has the same custom key, except the existing one
            }
            // t.update(existingJobRef, {});
          }
          t.create(this.jobDocRef(newJobId), jobWithServerTimestamp);
          // custom key without id provided, 2 possibilities: schedule or reschedule
          if (args.customKey) {
            if (customKeyAlreadyExists && existingJobIdFromCustomKey) {
              t.set(
                this.jobDocRef(existingJobIdFromCustomKey),
                {
                  status: {
                    value: "cancelled",
                    cancelledAt: FieldValue.serverTimestamp(),
                  },
                },
                { merge: true }
              );
            }
            if (!projectId) {
              throw `projectId is required when using customKey` as const;
            }
            // Store in subcollection  project > custom-keys > {customKey} the job id
            t.set(this.customKeyRef(projectId, args.customKey), {
              id: newJobId,
            });
          }
        });
        return newJobId;
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
      namespace: props.namespace || "local",
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
          this.firestore.collection(`${this.rootJobsCollectionPath}`),
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
  ) {
    const { registeredAfter, maxNoticePeriodMs } = args;
    return TE.tryCatch(
      async () => {
        return new Observable<JobDocument[]>((subscriber) => {
          console.log(
            `[Datastore] 🕐 Waiting for new jobs to schedule (${
              shardsToListenTo ? `${toShards(shardsToListenTo)}` : "all shards"
            }) \n Args ${JSON.stringify(args, null, 2)}`
          );

          let queryRoot = shardedFirestoreQuery(
            this.firestore.collection(`${this.rootJobsCollectionPath}`),
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
              console.debug(
                `Jobs : \n`,
                addedDocs
                  .map((doc) =>
                    doc.data().jobDefinition.scheduledAt.toDate().toISOString()
                  )
                  .join("\n")
              );

            console.debug(
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
      (reason) => `cannot listen to registered jobs ${reason}` as const
    );
  }

  listenToRateLimits(shardsToListenTo?: ShardsToListenTo) {
    return TE.tryCatch(
      async () => {
        return new Observable<RateLimit[]>((subscriber) => {
          let queryRoot = shardedFirestoreQuery(
            this.firestore.collectionGroup(`rate-limits`),
            toShards(shardsToListenTo)
          );
          queryRoot = queryRoot.where("satisfiedAt", "==", null);

          const unsubscribe = queryRoot.onSnapshot(async (snapshot) => {
            const addedDocs = snapshot
              .docChanges()
              .filter(({ type }, i) => type === "added")
              .map(({ doc }) => doc);

            pipe(
              addedDocs.map((doc) =>
                pipe(doc.data(), RateLimit.codec("firestore").decode)
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
            console.log(`[Datastore] 🔇 unsubscribing from rate limits`);
            unsubscribe();
          };
        });
      },
      (reason) => `cannot listen to registered jobs ${reason}` as const
    );
  }

  private checkAllRateLimitsSatisfied(id: JobId) {
    return pipe(
      // get jobDocument
      getOneFromFirestore(
        JobDocument,
        `jobs/${id}`
      )({
        firestore: this.firestore,
        namespace: this.namespace,
      }),
      TE.chainW((jobDocument) => {
        const rateLimitKeys = jobDocument.rateLimitKeys || [];
        return pipe(
          rateLimitKeys.map((k) =>
            getOneFromFirestore(
              RateLimit,
              `jobs/${id}/rate-limits/${k}`
            )({
              firestore: this.firestore,
              namespace: this.namespace,
            })
          ),
          te.executeAllInArray({ parallelism: 10 }),
          TE.fromTask,
          te.sideEffect(({ errors }) => {
            if (errors.length > 0) {
              console.log(`❌ Could not read ${errors.length} documents !`);
              console.log(errors.map((e) => console.log(e._tag)));
            }
          }),
          TE.map(({ successes }) => successes),
          TE.chainW((rateLimits) => {
            if (
              rateLimits.every((rateLimit) => rateLimit.satisfiedAt !== null)
            ) {
              console.log(
                `[Datastore] All rate limits are satisfied, queuing job...`
              );
              return pipe(
                this.queueJobs([jobDocument.jobDefinition]),
                TE.orElseW(() => TE.right(undefined)) // Ignore if we cannot queue it... (someone else might have done it)
              );
            } else {
              console.log(
                `[Datastore] Some rate limits are not satisfied yet...`
              );
              return TE.right(undefined);
            }
          })
        );
      })
    );
  }

  markRateLimitSatisfied(rateLimit: RateLimit) {
    return pipe(
      TE.tryCatch(
        () =>
          this.firestore.runTransaction(async (t) => {
            const jobDocRef = this.jobDocRef(rateLimit.jobId);
            return await te.unsafeGetOrThrow(
              pipe(
                TE.Do,
                TE.map(() => {
                  const docRef = jobDocRef
                    .collection("rate-limits")
                    .doc(rateLimit.key);
                  t.update(docRef, {
                    satisfiedAt: FieldValue.serverTimestamp(),
                  });
                })
              )
            );
          }),
        (reason) => `cannot mark rate limit as satisfied ${reason}` as const
      ),
      TE.chainW(() => this.checkAllRateLimitsSatisfied(rateLimit.jobId))
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
      TE.tryCatch(
        async () => {
          const okResponse = { nonExistingJobIds: [] };
          try {
            // Check that we're still running
            if (this.state !== "running") {
              throw new Error(
                "Datastore is not running anymore, not queuing job"
              );
            }
            const { nonExistingJobIds, notRegisteredJobIds } =
              await queueJobDocuments({
                firestore: this.firestore,
                jobDefinitions,
                fromCollectionPath: this.rootJobsCollectionPath,
              });
            if (nonExistingJobIds.length > 0) {
              throw new Error(
                `Some jobs do not exist: ${nonExistingJobIds.join(", ")}`
              );
            } else if (notRegisteredJobIds.length > 0) {
              throw new Error(
                `Some jobs do not have the proper status: ${notRegisteredJobIds.join(
                  ", "
                )}`
              );
            }
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
              // console.log(
              //   `[state=${this.state}] Failed to queue jobs ${jobDefinitions
              //     .map(({ id }) => id)
              //     .join(", ")}: ${reason}`
              // );
              throw reason;
            }
          }
        },
        (reason) => {
          return new Error(`Failed to queue jobs: ${reason}`);
        }
      ),
      TE.map(() => undefined)
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
            const docRef = this.jobDocRef(jobId);
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
          if (isFirebaseError(reason) && Number(reason?.code) === 5) {
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

  markAsDead(jobId: JobId) {
    return pipe(
      TE.tryCatch(
        async () =>
          await this.jobDocRef(jobId).set(
            {
              "status.value": "dead",
            },
            { merge: true }
          ),
        (reason) => `failed to mark job ${jobId} as dead` as const
      ),
      TE.map(() => undefined)
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
            const docRef = this.jobDocRef(jobId);

            // Make sure it's not already marked as completed
            return this.firestore.runTransaction(async (transaction) => {
              return te.unsafeGetOrThrow(
                pipe(
                  TE.Do,
                  TE.bindW("jobDocument", () =>
                    checkPreconditions({
                      docRef,
                      transaction,
                      preconditions: [
                        (jobDocument) => ({
                          test: jobDocument.status.value === "running",
                          errorMessage: `should be running, is ${jobDocument.status.value} instead. 🔴 Job may have been executed twice !`,
                        }),
                      ],
                    })
                  ),
                  TE.bindW(
                    "executionLagMs",
                    ({
                      jobDocument: {
                        jobDefinition: { scheduledAt },
                      },
                    }) =>
                      pipe(status.executionLagMs(scheduledAt), TE.fromEither)
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
  cancel(args: CancelProps) {
    return TE.tryCatch(
      async () => {
        await this.firestore.runTransaction(async (t) => {
          const doc = await this.getJobDefinitionDocument(t, args);
          if (!doc.exists) {
            throw `Job does not exist` as const;
          } else if (doc.data()?.status.value !== "registered") {
            throw `Job is not registered anymore` as const;
          }
          if (args._tag === "CustomKey") {
            t.delete(this.customKeyRef(args.projectId, args.customKey));
          }

          t.set(
            doc.ref,
            {
              status: {
                value: "cancelled",
                cancelledAt: FieldValue.serverTimestamp(),
              },
            },
            { merge: true }
          );
        });
      },
      (reason) => new Error(`Failed to cancel job: ${reason}`)
    );
  }

  private async getJobDefinitionDocument(
    t: FirebaseFirestore.Transaction,
    args: CancelProps
  ) {
    if (args._tag === "CustomKey") {
      const customKeyDoc = await t.get(
        this.customKeyRef(args.projectId, args.customKey)
      );
      if (!customKeyDoc.exists) {
        throw `Custom key ${args.customKey} does not exist` as const;
      }
      return await t.get(this.jobDocRef(customKeyDoc.data()?.id));
    } else {
      return await t.get(this.jobDocRef(args.jobId));
    }
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
              this.firestore.collection(`${this.rootJobsCollectionPath}`),
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

  jobDocRef(jobId: JobId) {
    return this.firestore.collection(this.rootJobsCollectionPath).doc(jobId);
  }

  customKeyRef(projectId: ProjectId | undefined, customKey: CustomKey) {
    return this.firestore.doc(
      `${this.rootProjectsCollectionPath}/${projectId}/custom-keys/${customKey}`
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
      (jobDocument) =>
        jobDocument.data()?.status.value === "registered" ||
        jobDocument.data()?.status.value === "rate-limited"
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

const checkPreconditions = ({
  docRef,
  preconditions,
  transaction,
}: {
  preconditions: Array<
    (jobDocument: JobDocument) => { test: boolean; errorMessage?: string }
  >;
  docRef: FirebaseFirestore.DocumentReference;
  transaction: FirebaseFirestore.Transaction;
}) =>
  pipe(
    TE.Do,
    TE.bind("docData", () =>
      TE.tryCatch(
        () => transaction.get(docRef),
        (e) => `failed to get job document ${docRef}` as const
      )
    ),
    TE.filterOrElseW(
      ({ docData }) => docData.exists,
      () => "job document does not exist" as const
    ),
    TE.bindW("jobDocument", ({ docData }) =>
      TE.fromEither(JobDocument.codec("firestore").decode(docData.data()))
    ),
    TE.bindW("failedPreconditions", ({ jobDocument }) =>
      TE.of(
        preconditions
          .map((precondition) => {
            const p = precondition(jobDocument);
            return {
              isValid: p.test,
              errorMessage: p.errorMessage,
            };
          })
          .filter(({ isValid }) => isValid === false)
      )
    ),
    TE.filterOrElseW(
      ({ failedPreconditions }) => failedPreconditions.length === 0,
      ({ jobDocument, failedPreconditions }) =>
        `job ${
          jobDocument.jobDefinition.id
        } does not satisfy preconditions: ${failedPreconditions.map(
          (p) => p.errorMessage
        )}` as const
    ),
    TE.map(({ jobDocument }) => jobDocument)
  );
