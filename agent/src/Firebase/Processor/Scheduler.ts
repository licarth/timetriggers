import {
  ClusterNodeInformation,
  CoordinationClient,
} from "@/Coordination/CoordinationClient";
import { te } from "@/fp-ts";
import { withTimeout } from "@/fp-ts/withTimeout";
import { getOrReportToSentry } from "@/Sentry/getOrReportToSentry";
import {
  Clock,
  JobDefinition,
  JobDocument,
  JobId,
  RegisteredAt,
  ScheduledAt,
} from "@timetriggers/domain";
import chalk from "chalk";
import { addMilliseconds, addMinutes, addSeconds } from "date-fns";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import { ClusterTopologyDatastoreAware } from "./ClusterTopologyAware";
import { Datastore, LastKnownScheduledJob } from "./Datastore";
import {
  humanReadibleCountdownBetween2Dates,
  humanReadibleMs,
} from "./humanReadibleMs";
import { unsubscribeAll } from "./unsubscribeAll";

const MINUTE = 1000 * 60;
const SECOND = 1000;

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
  datastoreNewJobsHooks: UnsubsribeHook[] = [];
  nextPeriodSchedulingHooks: UnsubsribeHook[] = [];

  schedulePeriodMs: number;
  scheduleBatch: number;

  private constructor(props: SchedulerProps) {
    super(props);
    this.schedulePeriodMs = props.scheduleAdvanceMs || 10 * MINUTE;
    this.scheduleBatch = props.scheduleBatch || 100;
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
        unsubscribeAll(this.nextPeriodSchedulingHooks);
        unsubscribeAll(this.datastoreNewJobsHooks);
      },
      TE.fromTask,
      TE.chainFirstW(() => this.startListening())
    );
  }

  startListening() {
    const originPeriod = this.originPeriod(); // Cathup until now +
    const firstPeriod = this.nextPeriod(originPeriod);
    return pipe(
      pipe(
        this.schedulePeriod(originPeriod),
        TE.chainFirstW(() =>
          pipe(
            this.listenToShortNoticeJobs({
              registeredAfter: RegisteredAt.fromDate(
                addSeconds(this.clock.now(), -10)
              ),
            }),
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
  private listenToShortNoticeJobs({
    registeredAfter,
  }: {
    registeredAfter: RegisteredAt;
  }) {
    return pipe(
      this.datastore.waitForRegisteredJobsByRegisteredAt(
        {
          registeredAfter,
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
    // .filter(
    //   (job) =>
    //     job.jobDefinition.scheduledAt <
    //     addMilliseconds(this.clock.now(), this.scheduleAdvanceMs)
    // );
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
      this.scheduleSetTimeout(job.jobDefinition);
    });

    if (jobsInThePast.length > 0) {
      return this.datastore.queueJobs(
        jobsInThePast.map((j) => j.jobDefinition)
      );
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

  scheduleSetTimeout(jobDefinition: JobDefinition) {
    if (this.plannedTimeouts.has(jobDefinition.id)) {
      // Rescheduling a job that is already scheduled
      console.warn(
        `Job ${jobDefinition.id} is already scheduled, rescheduling it`
      );
      return;
    }
    console.log(
      `[Scheduler] Scheduling job ${
        jobDefinition.id
      } for in ${humanReadibleDifferenceWithDateFns(
        jobDefinition.scheduledAt,
        this.clock.now()
      )}`
    );
    const timeoutId = this.clock.setTimeout(() => {
      getOrReportToSentry(this.datastore.queueJobs([jobDefinition]));
      this.plannedTimeouts.delete(jobDefinition.id);
    }, Math.max(0, jobDefinition.scheduledAt.getTime() - this.clock.now().getTime()));
    this.plannedTimeouts.set(jobDefinition.id, timeoutId);
  }

  //TODO: cancel jobs
}

const humanReadibleDifferenceWithDateFns = (date1: Date, date2: Date) => {
  const diff = Math.abs(date1.getTime() - date2.getTime());
  return humanReadibleMs(diff);
};
