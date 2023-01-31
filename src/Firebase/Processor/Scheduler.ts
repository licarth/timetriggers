import { Clock } from "@/Clock/Clock";
import {
  ClusterNodeInformation,
  CoordinationClient,
} from "@/Coordination/CoordinationClient";
import { JobDefinition } from "@/domain/JobDefinition";
import { JobId } from "@/domain/JobId";
import { te } from "@/fp-ts";
import { withTimeout } from "@/fp-ts/withTimeout";
import { addMilliseconds } from "date-fns";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import { ClusterTopologyDatastoreAware } from "./ClusterTopologyAware";
import { Datastore } from "./Datastore";

const MINUTE = 1000 * 60 * 60;
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

export class Scheduler extends ClusterTopologyDatastoreAware {
  plannedTimeouts = new Map<JobId, NodeJS.Timeout>();
  unsubscribeListeningToNewJobs?: () => void;
  unsubscribeSchedulingNextPeriod?: () => void;

  scheduleAdvanceMs: number;
  scheduleBatch: number;
  schedulePeriodMs: number;

  private isScheduling = false;

  private constructor(props: SchedulerProps) {
    super(props);
    this.scheduleAdvanceMs = props.scheduleAdvanceMs || 10 * MINUTE;
    this.scheduleBatch = props.scheduleBatch || 100;
    this.schedulePeriodMs =
      props.schedulePeriodMs || Math.ceil(this.scheduleAdvanceMs / 2);
  }

  onClusterTopologyChange = (clusterTopology: ClusterNodeInformation) => {
    console.log(
      `New cluster topology ! currentNodeID: ${clusterTopology.currentNodeId},  nodeCount: ${clusterTopology.clusterSize}
Reaffecting shards..., now listening to: ${this.shardsToListenTo}`
    );
    this.unsubscribeSchedulingNextPeriod &&
      this.unsubscribeSchedulingNextPeriod();
    if (this.unsubscribeListeningToNewJobs) {
      this.unsubscribeListeningToNewJobs();
      te.getOrLog(this.startListening());
    }
  };

  close() {
    this.unsubscribeSchedulingNextPeriod &&
      this.unsubscribeSchedulingNextPeriod();
    this.unsubscribeListeningToNewJobs && this.unsubscribeListeningToNewJobs();
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
      TE.chainFirstW(() => self.startListening())
    );
  }

  startListening() {
    return pipe(
      pipe(
        this.scheduleNextPeriod(),
        te.sideEffect(() => {
          const timeoutId = this.clock.setTimeout(() => {
            te.getOrLog(this.scheduleNextPeriod());
          }, this.schedulePeriodMs);
          this.unsubscribeSchedulingNextPeriod = () => {
            this.clock.clearTimeout(timeoutId);
          };
        })
      ),
      TE.chainW(() => this.startListeningToNewJobs()) // Not required for now...
    );
  }

  // runEveryMs = (ms: number, f: () => void) => {
  //   f();
  //   const id = this.clock.setInterval(() => {
  //     f();
  //   }, ms);
  //   this.unsubscribeSchedulingNextPeriod = () => {
  //     this.clock.clearInterval(id);
  //   };
  // };

  startListeningToNewJobs() {
    const subscription = this.datastore
      .listenToNewJobsBefore(
        {
          millisecondsFromNow: this.scheduleAdvanceMs,
        },
        this.shardsToListenTo
      )
      .subscribe((jobs) => {
        jobs.forEach((job) => {
          this.scheduleSetTimeout(job);
        });
      });

    this.unsubscribeListeningToNewJobs = () => subscription.unsubscribe();
    return TE.right(undefined);
  }

  private _scheduleNextPeriod({
    offset,
  }: {
    offset: number;
  }): TE.TaskEither<Error, { resultCount: number }> {
    console.log(
      `Looking at next period with offset ${offset} and limit ${this.scheduleBatch} in next ${this.scheduleAdvanceMs}ms`
    );
    // Here we should get into a loop until
    // we have a result that returns no jobs
    return pipe(
      this.datastore.getJobsScheduledBefore(
        {
          offset,
          limit: this.scheduleBatch,
          millisecondsFromNow: this.scheduleAdvanceMs,
        },
        this.shardsToListenTo
      ),
      TE.map((jobs) => {
        console.debug(`Found ${jobs.length} jobs to schedule`);
        // Optimization: all jobs that are scheduled in the past should be scheduled immediately
        // in a single transaction
        const [jobsInThePast, jobsIntheFuture] = _.partition(
          jobs,
          (job) => job.scheduledAt.date < this.clock.now()
        );

        te.getOrLog(this.datastore.queueJobs(jobsInThePast));

        // Possible optimization: all jobs that are scheduled at the same time
        // should be scheduled in a single transaction, but this requires changes
        // in the way we track setTimeouts
        jobsIntheFuture.forEach((job) => {
          this.scheduleSetTimeout(job);
        });
        // jobs that are to schedule before a certain date & with an offset ?
        return { resultCount: jobs.length };
      })
    );
  }

  /**
   * This method should be called regularily, at least twice per period (if period = 2h, then once an hour)
   * */
  scheduleNextPeriod(): TE.TaskEither<Error, void> {
    if (this.isScheduling) {
      console.log("Already scheduling, skipping this one...");
      return TE.right(undefined);
    }

    this.isScheduling = true;
    console.log(
      `Scheduling jobs for period: [now, now + ${this.scheduleAdvanceMs} ms]`
    );
    let offset = 0;
    return pipe(
      async () => offset,
      TE.fromTask,
      TE.chain((offset) => this._scheduleNextPeriod({ offset })),
      te.repeatUntil(
        ({ resultCount }) => {
          const isOver = offset === 0 && resultCount < this.scheduleBatch;
          if (!isOver) {
            if (resultCount < this.scheduleBatch) {
              offset = 0;
            } else {
              offset += resultCount;
            }
          }
          return isOver;
        },
        {
          maxAttempts: 300,
        }
      ),
      TE.map(() => {
        this.isScheduling = false;
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
      `Scheduling job ${jobDefinition.id} for ${
        jobDefinition.scheduledAt.date
      } (now: ${this.clock.now()}`
    );
    const timeoutId = this.clock.setTimeout(() => {
      te.getOrLog(this.datastore.queueJobs([jobDefinition]));
      this.plannedTimeouts.delete(jobDefinition.id);
    }, Math.max(0, jobDefinition.scheduledAt.date.getTime() - this.clock.now().getTime()));
    this.plannedTimeouts.set(jobDefinition.id, timeoutId);
  }

  //TODO: cancel jobs
}
