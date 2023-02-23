import {
  Clock,
  JobDocument,
  RegisteredAt,
  ScheduledAt,
} from "@timetriggers/domain";
import {
  ClusterNodeInformation,
  CoordinationClient,
} from "@/Coordination/CoordinationClient";
import { JobDefinition } from "@timetriggers/domain";
import { JobId } from "@timetriggers/domain";
import { te } from "@/fp-ts";
import { withTimeout } from "@/fp-ts/withTimeout";
import { getOrReportToSentry } from "@/Sentry/getOrReportToSentry";
import chalk from "chalk";
import { addMilliseconds, addMinutes, addSeconds, max } from "date-fns";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import { ClusterTopologyDatastoreAware } from "./ClusterTopologyAware";
import {
  Datastore,
  LastKnownRegisteredJob,
  LastKnownScheduledJob,
} from "./Datastore";
import {
  humanReadibleCountdownBetween2Dates,
  humanReadibleMs,
} from "./humanReadibleMs";
import { debounceTime, distinct, interval, pipe as pipeObs } from "rxjs";
import { distinctArray } from "./distinctArray";

const MINUTE = 1000 * 60;
const HOUR = 1000 * 60 * 60;

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

type SchedulingPeriod = {
  minScheduledAt: ScheduledAt | undefined;
  maxScheduledAt: ScheduledAt;
};

export class Scheduler extends ClusterTopologyDatastoreAware {
  plannedTimeouts = new Map<JobId, NodeJS.Timeout>();
  listeningToNewJobUnsubscribeHooks: UnsubsribeHook[] = [];
  schedulingNextPeriodUnsubscribeHooks: UnsubsribeHook[] = [];

  scheduleAdvanceMs: number;
  scheduleBatch: number;
  schedulePeriodMs: number;

  private lastKnownRegisteredJob?: LastKnownRegisteredJob;
  private currentPeriod: SchedulingPeriod;

  private constructor(props: SchedulerProps) {
    super(props);
    this.scheduleAdvanceMs = props.scheduleAdvanceMs || 10 * MINUTE;
    this.scheduleBatch = props.scheduleBatch || 100;
    this.schedulePeriodMs =
      props.schedulePeriodMs || Math.ceil(this.scheduleAdvanceMs / 2);
    // Initialize current period to now
    this.currentPeriod = {
      minScheduledAt: undefined,
      maxScheduledAt: ScheduledAt.fromDate(
        addMilliseconds(this.clock.now(), this.scheduleAdvanceMs)
      ),
    };
  }

  private switchToNextPeriod() {
    this.currentPeriod = {
      minScheduledAt: this.currentPeriod.maxScheduledAt,
      maxScheduledAt: ScheduledAt.fromDate(
        addMilliseconds(
          this.currentPeriod.maxScheduledAt,
          this.scheduleAdvanceMs
        )
      ),
    };
    return this.currentPeriod;
  }

  onClusterTopologyChange(clusterTopology: ClusterNodeInformation) {
    console.log(
      `New cluster topology ! currentNodeID: ${clusterTopology.currentNodeId},  nodeCount: ${clusterTopology.clusterSize}
Reaffecting shards..., now listening to: ${this.shardsToListenTo}`
    );
    getOrReportToSentry(this.restart());
  }

  unsubscribeNewJobsListening() {
    this.listeningToNewJobUnsubscribeHooks.forEach((u) => u());
    this.listeningToNewJobUnsubscribeHooks = [];
  }

  unsubscribeSchedulingNextPeriod() {
    this.schedulingNextPeriodUnsubscribeHooks.forEach((u) => u());
    this.schedulingNextPeriodUnsubscribeHooks = [];
  }

  clearAllPlannedTimeouts() {
    this.plannedTimeouts.forEach((timeout) => {
      this.clock.clearTimeout(timeout);
    });
    this.plannedTimeouts.clear();
  }

  close() {
    this.clearAllPlannedTimeouts();
    this.unsubscribeSchedulingNextPeriod();
    this.unsubscribeNewJobsListening();
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
        this.unsubscribeSchedulingNextPeriod();
      },
      TE.fromTask,
      TE.chainFirstW(() => {
        this.unsubscribeNewJobsListening();
        return this.startListening();
      })
    );
  }

  startListening() {
    return pipe(
      pipe(
        this.scheduleNextPeriod(),
        TE.chainFirstW(() =>
          pipe(
            this.waitForNewJobs(),
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
        te.sideEffect(() => {
          const timeoutId = this.clock.setTimeout(() => {
            this.switchToNextPeriod();
            getOrReportToSentry(this.scheduleNextPeriod());
          }, this.currentPeriod.maxScheduledAt.getTime() - this.clock.now().getTime());

          this.schedulingNextPeriodUnsubscribeHooks.push(() => {
            this.clock.clearTimeout(timeoutId);
          });
        })
      )
    );
  }

  private waitForNewJobs() {
    return pipe(
      this.datastore.waitForRegisteredJobsByRegisteredAt(
        {
          registeredAfter: RegisteredAt.fromDate(
            this.currentPeriod.minScheduledAt
              ? this.currentPeriod.minScheduledAt
              : this.clock.now()
          ),
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

        this.listeningToNewJobUnsubscribeHooks.push(() =>
          subscription.unsubscribe()
        );
        return undefined;
      })
    );
  }

  private _scheduleNextPeriod({ offset }: { offset: number }) {
    // Here we should get into a loop until
    // we have a result that returns no jobs
    return pipe(
      this.datastore.getRegisteredJobsByScheduledAt(
        {
          limit: this.scheduleBatch,
          minScheduledAt: this.currentPeriod.minScheduledAt,
          maxScheduledAt: this.currentPeriod.maxScheduledAt,
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
          }))
        );
        // jobs that are to schedule before a certain date & with an offset ?
        // return { resultCount: jobs.length };
      })
    );
  }

  private _scheduleNewJobs(jobs: JobDocument[]) {
    const jobsWithinTimeRange = jobs.filter(
      (job) =>
        job.jobDefinition.scheduledAt <
        addMilliseconds(this.clock.now(), this.scheduleAdvanceMs)
    );
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

  /**
   * This method should be called regularily, at least twice per period (if period = 2h, then once an hour)
   * */
  scheduleNextPeriod(): TE.TaskEither<Error, void> {
    this.unsubscribeNewJobsListening();

    console.log(
      `[Scheduler] 🕞 Scheduling jobs for period between ${
        this.currentPeriod.minScheduledAt
          ? humanReadibleCountdownBetween2Dates(
              this.currentPeriod.minScheduledAt,
              this.clock.now()
            )
          : "forever in the past"
      } from now and ${chalk.green(
        humanReadibleCountdownBetween2Dates(
          this.currentPeriod.maxScheduledAt,
          this.clock.now()
        )
      )} from now.`
    );
    let offset = 0;
    let totalJobs = 0;
    return pipe(
      async () => offset,
      TE.fromTask,
      TE.chain((offset) => this._scheduleNextPeriod({ offset })),
      te.repeatUntil(
        ({ resultCount }) => {
          const isOver = offset === 0 && resultCount < this.scheduleBatch;
          if (!isOver) {
            totalJobs += resultCount;
            if (resultCount === this.scheduleBatch) {
              offset += resultCount;
            } else {
              offset = 0;
            }
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
