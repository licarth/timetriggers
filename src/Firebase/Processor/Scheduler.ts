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
import { ClusterTopologyDatastoreAware } from "./ClusterTopologyAware";
import { Datastore } from "./Datastore";

const HOUR = 1000 * 60 * 60;

/**
 * Amount of time to schedule jobs in advance locally for.
 */
const SCHEDULE_ADVANCE_MS = 1 * HOUR;

type SchedulerProps = {
  clock?: Clock;
  datastore: Datastore;
  coordinationClient?: CoordinationClient;
};

export class Scheduler extends ClusterTopologyDatastoreAware {
  plannedTimeouts = new Map<JobId, NodeJS.Timeout>();
  unsubscribeListeningToNewJobs?: () => void;
  unsubscribeSchedulingNextPeriod?: () => void;

  private constructor(props: SchedulerProps) {
    super(props);
  }

  onClusterTopologyChange = (clusterTopology: ClusterNodeInformation) => {
    console.log(
      `New cluster topology ! currentNodeID: ${clusterTopology.currentNodeId},  nodeCount: ${clusterTopology.clusterSize}
Reaffecting shards..., now listening to: ${this.shardsToListenTo}`
    );
    this.unsubscribeListeningToNewJobs && this.unsubscribeListeningToNewJobs();
    this.unsubscribeSchedulingNextPeriod &&
      this.unsubscribeSchedulingNextPeriod();
    this.startListening();
  };

  close() {
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
    this.runEveryMs(Math.floor(SCHEDULE_ADVANCE_MS / 2), () => {
      te.unsafeGetOrThrow(this.scheduleNextPeriod());
    });
    return this.startListeningToNewJobs();
  }

  runEveryMs = (ms: number, f: () => void) => {
    f();
    const id = this.clock.setInterval(() => {
      f();
    }, ms);
    this.unsubscribeSchedulingNextPeriod = () => {
      this.clock.clearInterval(id);
    };
  };

  startListeningToNewJobs() {
    const subscription = this.datastore
      .newlyRegisteredJobsBefore(
        {
          millisecondsFromNow: SCHEDULE_ADVANCE_MS,
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

  /**
   * This method should be called regularily, at least twice per period (if period = 2h, then once an hour)
   * */
  scheduleNextPeriod() {
    console.log("Scheduling jobs for period: " + SCHEDULE_ADVANCE_MS);

    return pipe(
      this.datastore.getJobsScheduledAfter(
        {
          limit: 5,
          millisecondsFromNow: SCHEDULE_ADVANCE_MS,
        },
        this.shardsToListenTo
      ),
      TE.map((jobs) => {
        jobs.forEach((job) => {
          this.scheduleSetTimeout(job);
        });
      })
    );
  }

  scheduleSetTimeout(jobDefinition: JobDefinition) {
    const timeoutId = this.clock.setTimeout(() => {
      this.datastore.queueJob(jobDefinition);
    }, Math.max(0, jobDefinition.scheduledAt.date.getTime() - this.clock.now().getTime()));
    this.plannedTimeouts.set(jobDefinition.id, timeoutId);
  }
}
