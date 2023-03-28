import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import {
  ClusterNodeInformation,
  CoordinationClient,
} from "@/Coordination/CoordinationClient";
import { te } from "@/fp-ts";
import { withTimeout } from "@/fp-ts/withTimeout";
import { getOrReportToSentry } from "@/Sentry/getOrReportToSentry";
import {
  Clock,
  JobDocument,
  JobId,
  RateLimit,
  RateLimitKey,
  ScheduledAt,
} from "@timetriggers/domain";
import chalk from "chalk";
import { addMilliseconds } from "date-fns";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import PQueue from "p-queue";
import { ClusterTopologyDatastoreAware } from "./ClusterTopologyAware";
import { Datastore, LastKnownScheduledJob } from "./Datastore";
import {
  humanReadibleCountdownBetween2Dates,
  humanReadibleMs,
} from "./humanReadibleMs";
import { unsubscribeAll } from "./unsubscribeAll";

const MINUTE = 1000 * 60;
const TLD_QPS = 0.3;

const qpsForRateLimit = (rateLimit: RateLimit): number => {
  if (rateLimit.key.startsWith("tld")) {
    return TLD_QPS;
  } else if (rateLimit.key.startsWith("project")) {
    return 5;
  }
  return 1;
};

type SchedulerProps = {
  clock?: Clock;
  datastore: Datastore;
  coordinationClient?: CoordinationClient;
  /**
   * Amount of time to schedule jobs in advance locally for.
   */
  scheduleAdvanceMs?: number;
  scheduleBatch?: number;
  schedulePeriodMs?: number;
  noRateLimits?: boolean;
};

type UnsubsribeHook = () => void;

type OriginPeriod = {
  minScheduledAt: undefined;
  maxScheduledAt: ScheduledAt;
};

type SchedulingPeriod = {
  minScheduledAt: ScheduledAt;
  maxScheduledAt: ScheduledAt;
};

export class Scheduler extends ClusterTopologyDatastoreAware {
  plannedTimeouts = new Map<JobId, NodeJS.Timeout>();
  rateLimitQueues = new Map<RateLimitKey, PQueue>();

  datastoreNewJobsHooks: UnsubsribeHook[] = [];
  nextPeriodSchedulingHooks: UnsubsribeHook[] = [];

  schedulePeriodMs: number;
  scheduleBatch: number;

  noRateLimits: boolean;

  private constructor(props: SchedulerProps) {
    super(props);
    this.schedulePeriodMs = props.scheduleAdvanceMs || 10 * MINUTE;
    this.scheduleBatch = props.scheduleBatch || 100;
    this.noRateLimits = props.noRateLimits || false;
    // Initialize current period to now
  }

  private originPeriod() {
    return {
      minScheduledAt: undefined,
      maxScheduledAt: ScheduledAt.fromDate(
        addMilliseconds(this.clock.now(), this.schedulePeriodMs)
      ),
    };
  }

  private nextPeriod(
    period: SchedulingPeriod | OriginPeriod
  ): SchedulingPeriod {
    return {
      minScheduledAt: period.maxScheduledAt,
      maxScheduledAt: ScheduledAt.fromDate(
        addMilliseconds(period.maxScheduledAt, this.schedulePeriodMs)
      ),
    };
  }

  onClusterTopologyChange(clusterTopology: ClusterNodeInformation) {
    console.log(
      `New cluster topology ! currentNodeID: ${clusterTopology.currentNodeId},  nodeCount: ${clusterTopology.clusterSize}
Reaffecting shards..., now listening to: ${this.shardsToListenTo}`
    );
    getOrReportToSentry(this.restart());
  }

  clearAllPlannedTimeouts() {
    this.plannedTimeouts.forEach((timeout) => {
      this.clock.clearTimeout(timeout);
    });
    this.plannedTimeouts.clear();
  }

  close() {
    this.clearAllPlannedTimeouts();
    unsubscribeAll(this.datastoreNewJobsHooks);
    unsubscribeAll(this.nextPeriodSchedulingHooks);
    for (const queue of this.rateLimitQueues.values()) {
      queue.clear();
      // TODO: wait for all ongoing to be done ? => not necessarily as they are in a transaction...
    }
    return super.close();
  }

  static build(props: SchedulerProps): TE.TaskEither<Error, Scheduler> {
    const self = new Scheduler(props);
    return pipe(
      self,
      (clusterTopologyDatastoreAware) =>
        clusterTopologyDatastoreAware.startListeningToCluster(),
      TE.map(() => self),
      withTimeout(
        E.left(new Error("Cluster topology is not ready in 10 seconds")),
        10000
      ),
      TE.mapLeft((e) => new Error("message" in e ? e.message : e))
    );
  }

  restart() {
    return pipe(
      async () => {
        this.clearAllPlannedTimeouts(); // TODO: do a diff of the shards we're listening to and the shards we're supposed to listen to, and only clear the ones that are no longer needed.
        unsubscribeAll(this.nextPeriodSchedulingHooks);
        unsubscribeAll(this.datastoreNewJobsHooks);
      },
      TE.fromTask,
      TE.chainFirstW(() => this.startListeningToRateLimits()),
      TE.chainFirstW(() => this.startListeningToJobs())
    );
  }

  startListeningToRateLimits() {
    return pipe(
      this.datastore.listenToRateLimits(this.shardsToListenTo),
      TE.map((rateLimits) => {
        const s = rateLimits.subscribe((rateLimit) => {
          rateLimit.forEach((rl) => {
            console.log(
              `[Scheduler] 🔸 Rate limit found for ${rl.key} (job ${rl.jobId}}`
            );
            if (!this.rateLimitQueues.get(rl.key)) {
              const q = new PQueue({
                interval: Math.floor(1000 / qpsForRateLimit(rl)),
                intervalCap: 1,
              });
              this.rateLimitQueues.set(rl.key, q);
            }
            this.rateLimitQueues.get(rl.key)?.add(
              () => {
                getOrReportToSentry(this.datastore.markRateLimitSatisfied(rl));
              },
              { priority: -rl.scheduledAt.getTime() }
            );
          });
        });
        this.datastoreNewJobsHooks.push(() => s.unsubscribe());
      })
    );
  }

  startListeningToJobs() {
    const originPeriod = this.originPeriod(); // Cathup until now +
    const firstPeriod = this.nextPeriod(originPeriod);
    return pipe(
      pipe(
        this.schedulePeriod(originPeriod),
        TE.chainFirstW(() =>
          pipe(
            this.listenToShortNoticeJobs(),
            TE.orElse((reason) => {
              if (reason === "not implemented") {
                console.log(
                  "[Scheduler] 🔸 Not listening to new jobs, not implemented."
                );
              } else if (reason === "too many previous jobs") {
                console.log(
                  "[Scheduler] ❗️ Not listening to new jobs, too many previous jobs."
                );
              }
              return TE.right(undefined);
            })
          )
        ),
        TE.chainFirstW(() => this.schedulePeriodRecursively(firstPeriod))
      )
    );
  }

  private schedulePeriodRecursively(period: SchedulingPeriod) {
    unsubscribeAll(this.nextPeriodSchedulingHooks);
    return pipe(
      this.schedulePeriod(period),
      te.sideEffect(() => {
        //Plan next sceduling
        const timeoutId = this.clock.setTimeout(() => {
          getOrReportToSentry(
            this.schedulePeriodRecursively(this.nextPeriod(period))
          );
        }, period.minScheduledAt.getTime() - this.clock.now().getTime());

        this.nextPeriodSchedulingHooks.push(() => {
          this.clock.clearTimeout(timeoutId);
        });
      })
    );
  }

  /**
   * This listens to jobs that have a short notice period where notice period is the time between the job's registeredAt and its scheduledAt properties.
   *
   * These jobs are not caught by long polling, so we need to listen to them somehow.
   *
   */
  private listenToShortNoticeJobs() {
    return pipe(
      this.datastore.waitForRegisteredJobsByRegisteredAt(
        {
          maxNoticePeriodMs: 60 * 1000, // 1 minute
        },
        this.shardsToListenTo
      ),
      TE.map((observable) => {
        const subscription = observable.subscribe(
          (jobs) => {
            // Trigger a check for new jobs
            getOrReportToSentry(pipe(this._scheduleNewJobs(jobs)));
          },
          () => {},
          () => {}
        );

        this.datastoreNewJobsHooks.push(() => subscription.unsubscribe());
        return undefined;
      })
    );
  }

  private _scheduleJobsAfter({
    lastKnownJob,
    limit,
    minScheduledAt,
    maxScheduledAt,
  }: {
    lastKnownJob?: LastKnownScheduledJob;
    limit: number;
    minScheduledAt?: ScheduledAt;
    maxScheduledAt: ScheduledAt;
  }) {
    // Here we should get into a loop until
    // we have a result that returns no jobs
    return pipe(
      this.datastore.getRegisteredJobsByScheduledAt(
        {
          limit,
          minScheduledAt,
          maxScheduledAt,
          lastKnownJob,
        },
        this.shardsToListenTo
      ),
      TE.chainW((jobs) => {
        // Optimization: all jobs that are scheduled in the past should be scheduled immediately
        // in a single transaction
        return pipe(
          this._scheduleNewJobs(jobs),
          TE.map(() => ({
            resultCount: jobs.length,
            lastKnownJob: jobs[jobs.length - 1],
          }))
        );
      })
    );
  }

  private _scheduleNewJobs(jobs: JobDocument[]) {
    const jobsWithinTimeRange = jobs;
    const [jobsInThePast, jobsIntheFuture] = _.partition(
      jobsWithinTimeRange,
      (job) => job.jobDefinition.scheduledAt < this.clock.now()
    );

    console.log(
      `[Scheduler] 🔸 Scheduling ${jobsWithinTimeRange.length} jobs.`
    );
    // Possible optimization: all jobs that are scheduled at the same time
    // should be scheduled in a single transaction, but this requires changes
    // in the way we track setTimeouts
    jobsIntheFuture.forEach((job) => {
      this.scheduleSetTimeout(job);
    });

    if (jobsInThePast.length > 0) {
      return this.rateLimitOrQueue(jobsInThePast);
    } else {
      return TE.right(undefined);
    }
  }

  schedulePeriod({
    minScheduledAt,
    maxScheduledAt,
  }: {
    minScheduledAt?: ScheduledAt;
    maxScheduledAt: ScheduledAt;
  }): TE.TaskEither<Error, void> {
    unsubscribeAll(this.nextPeriodSchedulingHooks);

    console.log(
      `[Scheduler] 🕞 Scheduling jobs for period between ${
        minScheduledAt
          ? humanReadibleCountdownBetween2Dates(
              minScheduledAt,
              this.clock.now()
            )
          : "forever in the past"
      } from now and ${chalk.green(
        humanReadibleCountdownBetween2Dates(maxScheduledAt, this.clock.now())
      )} from now.`
    );
    let lastKnownJob: LastKnownScheduledJob;
    let totalJobs = 0;
    return pipe(
      async () => lastKnownJob,
      TE.fromTask,
      TE.chain((lastKnownJob) =>
        this._scheduleJobsAfter({
          limit: this.scheduleBatch,
          lastKnownJob,
          minScheduledAt,
          maxScheduledAt,
        })
      ),
      te.repeatUntil(
        ({ resultCount, lastKnownJob: lkj }) => {
          const isOver = resultCount < this.scheduleBatch;
          totalJobs += resultCount;
          if (isOver) {
            return isOver;
          } else {
            lastKnownJob = {
              id: lkj.jobDefinition.id,
              scheduledAt: lkj.jobDefinition.scheduledAt,
            };
          }
          return isOver;
        },
        {
          maxAttempts: 300,
        }
      ),
      TE.map(() => {
        if (totalJobs === 0) {
          console.log(`[Scheduler] - No jobs to schedule.`);
        } else {
          console.log(`[Scheduler] ✅ Scheduled ${totalJobs} jobs`);
        }
        return void 0;
      })
    );
  }

  scheduleSetTimeout(jobDocument: JobDocument) {
    const { jobDefinition } = jobDocument;
    const { id, scheduledAt } = jobDefinition;
    if (this.plannedTimeouts.has(id)) {
      // Rescheduling a job that is already scheduled
      console.warn(`Job ${id} is already scheduled, rescheduling it`);
      return;
    }
    console.log(
      `[Scheduler] Scheduling job ${id} for in ${humanReadibleDifferenceWithDateFns(
        scheduledAt,
        this.clock.now()
      )}`
    );
    const timeoutId = this.clock.setTimeout(() => {
      getOrReportToSentry(this.rateLimitOrQueue([jobDocument]));
      this.plannedTimeouts.delete(id);
    }, Math.max(0, scheduledAt.getTime() - this.clock.now().getTime()));
    this.plannedTimeouts.set(id, timeoutId);
  }

  private rateLimitOrQueue(jobDocuments: JobDocument[]) {
    const [rateLimitedDocuments, nonRateLimitedDocuments] = _.partition(
      jobDocuments.map((jobDocument) => ({
        rateLimits: this.getRateLimits(jobDocument),
        jobDocument,
      })),
      (jobDocument) => jobDocument.rateLimits.length > 0
    );

    return pipe(
      this.datastore.queueJobs(
        nonRateLimitedDocuments.map((j) => j.jobDocument.jobDefinition)
      ),
      TE.chainW(() => {
        // Mark each rate limited job
        return pipe(
          rateLimitedDocuments.map(
            ({ jobDocument, rateLimits }) => {
              jobDocument.rateLimitKeys = rateLimits.map((rl) => rl.key);
              return pipe(
                this.datastore.markRateLimited(jobDocument, rateLimits),
                TE.orElseW((e) => {
                  console.error(`Failed to mark job as rate limited: ${e}`);
                  return TE.of(undefined);
                })
              );
            }
            // What if this fails?
          ),
          TE.sequenceArray
        );
      }),
      TE.map(() => undefined)
    );
  }
  getRateLimits = (jobDocument: JobDocument) => {
    const rateLimits = [] as RateLimit[];
    if (this.noRateLimits) {
      return rateLimits;
    }
    const tld = jobDocument.jobDefinition.http?.tld();
    if (tld) {
      rateLimits.push(
        RateLimit.tld(
          tld,
          jobDocument.jobDefinition.id,
          jobDocument.jobDefinition.scheduledAt,
          preloadedHashingFunction(tld)
        )
      );
    }
    if (jobDocument.projectId) {
      rateLimits.push(
        RateLimit.project(
          jobDocument.jobDefinition.id,
          jobDocument.projectId,
          jobDocument.jobDefinition.scheduledAt,
          preloadedHashingFunction(jobDocument.projectId)
        )
      );
    }

    return rateLimits;
  };
}

const humanReadibleDifferenceWithDateFns = (date1: Date, date2: Date) => {
  const diff = Math.abs(date1.getTime() - date2.getTime());
  return humanReadibleMs(diff);
};

const preloadedHashingFunction = consistentHashingFirebaseArrayPreloaded(11);
