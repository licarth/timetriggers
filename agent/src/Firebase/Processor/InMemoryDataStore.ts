import { HttpCallCompleted, HttpCallErrored } from "@/HttpCallStatusUpdate";
import {
  Clock,
  JobDefinition,
  JobDocument,
  JobId,
  JobScheduleArgs,
  JobStatus,
  RegisteredAt,
  Shard,
  SystemClock,
} from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import Multimap from "multimap";
import { interval, Observable, Subscriber } from "rxjs";
import {
  Datastore,
  GetJobsInQueueArgs,
  GetJobsScheduledBeforeArgs,
  ShardingAlgorithm,
} from "./Datastore";
import { distinctArray } from "./distinctArray";
import { ShardsToListenTo } from "./ShardsToListenTo";

type InMemoryDataStoreProps = {
  clock?: Clock;
  pollingInterval: number;
  registeredJobs: JobDocument[];
  queuedJobs: JobDocument[];
  completedJobs: JobDocument[];
  runningJobs: JobDocument[];
};

export class InMemoryDataStore implements Datastore {
  private clock;
  private pollingInterval;
  registeredJobs;
  queuedJobs;
  runningJobs;
  private queuesJobByShardIndex = new Multimap<string, JobId>(); // shardIndex "${nodeCount}-${nodeId}" -> jobId
  completedJobs;
  private shardsByJobId = new Map<JobId, Shard[]>();

  constructor(props: InMemoryDataStoreProps) {
    this.clock = props.clock || new SystemClock();
    this.pollingInterval = props.pollingInterval;
    this.registeredJobs = new Map<JobId, JobDocument>(
      toEntries(props.registeredJobs)
    );
    this.queuedJobs = new Map<JobId, JobDocument>(toEntries(props.queuedJobs));
    this.runningJobs = new Map<JobId, JobDocument>(
      toEntries(props.runningJobs)
    );
    this.completedJobs = new Map<JobId, JobDocument>(
      toEntries(props.completedJobs)
    );
  }
  getJobsInQueue(
    args: GetJobsInQueueArgs,
    shardsToListenTo?: ShardsToListenTo | undefined
  ): TE.TaskEither<any, JobDocument[]> {
    const jobs = _.sortBy(
      this.jobsMatchingShard(this.queuedJobs, shardsToListenTo),
      (i) => i.jobDefinition.scheduledAt.getTime()
    ).splice(0, args.limit);

    return TE.right(jobs);
  }

  close(): TE.TaskEither<any, void> {
    return TE.right(undefined);
  }

  static factory(props: Partial<InMemoryDataStoreProps> & { clock: Clock }) {
    return new InMemoryDataStore({
      clock: props.clock,
      pollingInterval: props.pollingInterval || 1000,
      registeredJobs: props.registeredJobs || [],
      queuedJobs: props.queuedJobs || [],
      completedJobs: props.completedJobs || [],
      runningJobs: props.runningJobs || [],
    });
  }

  private jobsMatchingShard(
    jobMap: Map<JobId, JobDocument>,
    shardsToListenTo?: ShardsToListenTo
  ) {
    return _(
      all(jobMap).filter((job) => {
        if (
          shardsToListenTo &&
          shardsToListenTo.nodeCount > 1 &&
          this.shardsByJobId.has(job.jobDefinition.id)
        ) {
          const matchingShard = this.shardsByJobId.get(job.jobDefinition.id)?.[
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
      .sortBy((j) => j.jobDefinition.id)
      .valueOf();
  }

  waitForRegisteredJobsByRegisteredAt(
    args: {} = {},
    shardsToListenTo?: ShardsToListenTo
  ): TE.TaskEither<never, Observable<JobDocument[]>> {
    return TE.of(
      pipe(
        new Observable((subscriber: Subscriber<JobDocument[]>) => {
          const doCheck = () => {
            const jobs = this.jobsMatchingShard(
              this.registeredJobs,
              shardsToListenTo
            ).filter((job) => {
              const scheduledAt = job.jobDefinition.scheduledAt.getTime();
              const now = this.clock.now().getTime();
              // return scheduledAt <= now + args.millisecondsFromNow;
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
          (d) => d.jobDefinition.id,
          interval(10 * 60 * 1000) // 10 minutes
        )
      )
    );
  }

  queueJobs(jobDefinitions: JobDefinition[]): TE.TaskEither<any, void> {
    jobDefinitions.forEach((jobDefinition) => {
      const jobDocument = this.registeredJobs.get(jobDefinition.id);
      if (!jobDocument) {
        return TE.left(
          new Error(`Job ${jobDefinition.id} not found in registered jobs`)
        );
      }
      this.registeredJobs.delete(jobDefinition.id);
      this.queuedJobs.set(jobDefinition.id, jobDocument);
    });
    return TE.right(undefined);
  }

  markJobAsRunning(jobDefinition: JobDefinition): TE.TaskEither<any, void> {
    const jobDocument = this.queuedJobs.get(jobDefinition.id);
    if (!jobDocument) {
      return TE.left(
        new Error(`Job ${jobDefinition.id} not found in queued jobs`)
      );
    }
    this.queuedJobs.delete(jobDefinition.id);
    this.runningJobs.set(jobDefinition.id, jobDocument);
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
    const jobDocument = this.runningJobs.get(jobDefinition.id);
    if (!jobDocument) {
      return TE.left(
        new Error(`Job ${jobDefinition.id} not found in running jobs`)
      );
    }
    this.completedJobs.set(jobDefinition.id, jobDocument);
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
  ): TE.TaskEither<Error, JobId> {
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
    if (shardingAlgorithm && shards) {
      for (const shard of shards) {
        this.queuesJobByShardIndex.set(shard.toString(), jobId);
      }
    }
    this.registeredJobs.set(
      jobId,
      new JobDocument({
        jobDefinition: { ...jobDefinition, id: jobId },
        shards: shards?.map((s) => String(s)) || [],
        status: new JobStatus({
          value: "registered",
          registeredAt: RegisteredAt.fromDate(this.clock.now()),
        }),
      })
    );
    return TE.of(jobId);
  }

  getScheduledJobsByScheduledAt(
    { millisecondsFromNow, limit, offset }: GetJobsScheduledBeforeArgs,
    shardsToListenTo?: ShardsToListenTo
  ) {
    return TE.of(
      _.take(
        this.jobsMatchingShard(this.registeredJobs, shardsToListenTo)
          .filter((job) => {
            const scheduledAt = job.jobDefinition.scheduledAt.getTime();
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
  ): TE.TaskEither<Error, Observable<JobDocument[]>> {
    return TE.of(
      new Observable<JobDocument[]>((observer) => {
        this._waitForNextJobsInQueue(args, observer, shardsToListenTo);
      })
    );
  }

  private _waitForNextJobsInQueue(
    args: {
      limit: number;
    },
    observer: Subscriber<JobDocument[]>,
    shardsToListenTo?: ShardsToListenTo
  ) {
    const jobs = _.sortBy(
      this.jobsMatchingShard(this.queuedJobs, shardsToListenTo),
      (i) => i.jobDefinition.scheduledAt.getTime()
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

const toEntries = (array: JobDocument[]) =>
  _.entries(_.keyBy(array, "jobDefinition.id")) as [JobId, JobDocument][];

const all = (map: Map<JobId, JobDocument>) => new Array(...map.values());
