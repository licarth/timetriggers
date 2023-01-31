import { Clock } from "@/Clock/Clock";
import { SystemClock } from "@/Clock/SystemClock";
import { TestClock } from "@/Clock/TestClock";
import { JobDefinition } from "@/domain/JobDefinition";
import { JobId } from "@/domain/JobId";
import { JobScheduleArgs } from "@/domain/JobScheduleHttpArgs";
import { Shard } from "@/domain/Shard";
import { te } from "@/fp-ts";
import { HttpCallCompleted, HttpCallErrored } from "@/HttpCallStatusUpdate";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import Multimap from "multimap";
import { interval, Observable, Observer, Subscriber } from "rxjs";
import {
  Datastore,
  GetJobsScheduledBeforeArgs,
  ShardingAlgorithm,
} from "./Datastore";
import { distinctArray } from "./distinctArray";
import { ShardsToListenTo } from "./ShardsToListenTo";

type InMemoryDataStoreProps = {
  clock?: Clock;
  pollingInterval: number;
  registeredJobs: JobDefinition[];
  queuedJobs: JobDefinition[];
  completedJobs: JobDefinition[];
};

export class InMemoryDataStore implements Datastore {
  private clock;
  private pollingInterval;
  registeredJobs;
  queuedJobs;
  private queuesJobByShardIndex = new Multimap<string, JobId>(); // shardIndex "${nodeCount}-${nodeId}" -> jobId
  completedJobs;
  private shardsByJobId = new Map<JobId, Shard[]>();

  constructor(props: InMemoryDataStoreProps) {
    this.clock = props.clock || new SystemClock();
    this.pollingInterval = props.pollingInterval;
    this.registeredJobs = new Map<JobId, JobDefinition>(
      toEntries(props.registeredJobs)
    );
    this.queuedJobs = new Map<JobId, JobDefinition>(
      toEntries(props.queuedJobs)
    );
    this.completedJobs = new Map<JobId, JobDefinition>(
      toEntries(props.completedJobs)
    );
  }

  close(): TE.TaskEither<any, void> {
    return TE.right(undefined);
  }

  static factory(
    props: Partial<InMemoryDataStoreProps> & { clock: TestClock }
  ) {
    return new InMemoryDataStore({
      clock: props.clock,
      pollingInterval: props.pollingInterval || 1000,
      registeredJobs: props.registeredJobs || [],
      queuedJobs: props.queuedJobs || [],
      completedJobs: props.completedJobs || [],
    });
  }

  private jobsMatchingShard(
    jobMap: Map<JobId, JobDefinition>,
    shardsToListenTo?: ShardsToListenTo
  ) {
    return _(
      all(jobMap).filter((job) => {
        if (
          shardsToListenTo &&
          shardsToListenTo.nodeCount > 1 &&
          this.shardsByJobId.has(job.id)
        ) {
          const matchingShard = this.shardsByJobId.get(job.id)?.[
            shardsToListenTo.nodeCount - 2
          ];
          if (
            matchingShard &&
            shardsToListenTo.nodeIds.includes(matchingShard.nodeId)
          ) {
            return true;
          } else {
            return false;
          }
        }
        return true;
      })
    )
      .sortBy((j) => j.id)
      .valueOf();
  }

  listenToNewJobsBefore(
    args: {
      millisecondsFromNow: number;
    },
    shardsToListenTo?: ShardsToListenTo
  ): Observable<JobDefinition[]> {
    return pipe(
      new Observable((subscriber: Subscriber<JobDefinition[]>) => {
        const doCheck = () => {
          const jobs = this.jobsMatchingShard(
            this.registeredJobs,
            shardsToListenTo
          ).filter((job) => {
            const scheduledAt = job.scheduledAt.date.getTime();
            const now = this.clock.now().getTime();
            return scheduledAt <= now + args.millisecondsFromNow;
          });

          subscriber.next(jobs);
        };

        const intervalId = this.clock.setInterval(
          doCheck,
          this.pollingInterval
        );

        doCheck(); // Check once immediately
        return () => this.clock.clearInterval(intervalId);
      }),
      distinctArray(
        (JobDefinition) => JobDefinition.id,
        interval(10 * 60 * 1000) // 10 minutes
      )
    );
  }

  queueJobs(jobDefinitions: JobDefinition[]): TE.TaskEither<any, void> {
    jobDefinitions.forEach((jobDefinition) => {
      this.queuedJobs.set(jobDefinition.id, jobDefinition);
      this.registeredJobs.delete(jobDefinition.id);
    });
    return TE.right(undefined);
  }

  markJobAsRunning(jobDefinition: JobDefinition): TE.TaskEither<any, void> {
    this.queuedJobs.delete(jobDefinition.id);
    const shards = this.shardsByJobId.get(jobDefinition.id);
    // If document was sharded, remove it from map queuesJobByShardIndex.
    if (shards) {
      for (const shard of shards) {
        this.queuesJobByShardIndex.delete(shard.toString(), jobDefinition.id);
      }
    }
    return TE.right(undefined);
  }

  markJobAsComplete({
    jobDefinition,
  }: {
    jobDefinition: JobDefinition;
    lastStatusUpdate: HttpCallCompleted | HttpCallErrored;
    durationMs: number;
    executionStartDate: Date;
  }): TE.TaskEither<any, void> {
    this.completedJobs.set(jobDefinition.id, jobDefinition);
    this.queuedJobs.delete(jobDefinition.id);
    this.shardsByJobId.delete(jobDefinition.id);
    return TE.right(undefined);
  }

  cancel(jobId: JobId) {
    this.registeredJobs.delete(jobId);
    return TE.right(undefined);
  }

  schedule(
    jobDefinition: JobScheduleArgs,
    shardingAlgorithm?: ShardingAlgorithm
  ) {
    const jobId = JobId.factory();
    const shards = shardingAlgorithm ? shardingAlgorithm(jobId) : undefined;
    // Make sure shards start at 2 and increment 1 by 1:
    if (shards) {
      if (
        !_.isEqual(
          shards.map((s) => s.nodeCount),
          _.range(2, shards.length + 2)
        )
      ) {
        return TE.left(
          new Error("Shards must start at 2 and increment 1 by 1")
        );
      }
      this.shardsByJobId.set(jobId, shards);
    }
    this.registeredJobs.set(
      jobId,
      new JobDefinition({ ...jobDefinition, id: jobId })
    );
    if (shardingAlgorithm) {
      const shards = shardingAlgorithm(jobId);
      for (const shard of shards) {
        this.queuesJobByShardIndex.set(shard.toString(), jobId);
      }
    }
    return TE.of(jobId);
  }

  getJobsScheduledBefore(
    { millisecondsFromNow, limit, offset }: GetJobsScheduledBeforeArgs,
    shardsToListenTo?: ShardsToListenTo
  ) {
    return TE.of(
      _.take(
        this.jobsMatchingShard(this.registeredJobs, shardsToListenTo)
          .filter((job) => {
            const scheduledAt = job.scheduledAt.date.getTime();
            const now = this.clock.now().getTime();
            return scheduledAt <= now + millisecondsFromNow;
          })
          .map((job) => {
            return job;
          })
          .slice(offset),
        limit
      )
    );
  }

  waitForNextJobsInQueue(
    args: {
      limit: number;
    },
    shardsToListenTo?: ShardsToListenTo
  ): TE.TaskEither<Error, Observable<JobDefinition[]>> {
    return TE.of(
      new Observable<JobDefinition[]>((observer) => {
        this._waitForNextJobsInQueue(args, observer, shardsToListenTo);
      })
    );
  }

  private _waitForNextJobsInQueue(
    args: {
      limit: number;
    },
    observer: Subscriber<JobDefinition[]>,
    shardsToListenTo?: ShardsToListenTo
  ) {
    const jobs = _.sortBy(
      this.jobsMatchingShard(this.queuedJobs, shardsToListenTo),
      (i) => i.scheduledAt.date.getTime()
    ).splice(0, args.limit);

    if (jobs.length > 0) {
      observer.next(jobs);
    } else {
      setTimeout(() => {
        this._waitForNextJobsInQueue(args, observer, shardsToListenTo);
      }, 100);
    }
  }
}

const toEntries = (array: JobDefinition[]) =>
  _.entries(_.keyBy(array, "id")) as [JobId, JobDefinition][];

const all = (map: Map<JobId, JobDefinition>) => new Array(...map.values());
