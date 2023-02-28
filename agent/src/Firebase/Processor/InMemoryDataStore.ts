import {
  Clock,
  CompletedAt,
  JobDefinition,
  JobDocument,
  JobId,
  JobScheduleArgs,
  JobStatus,
  QueuedAt,
  RateLimit,
  RegisteredAt,
  Shard,
  StartedAt,
  SystemClock,
} from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import Multimap from "multimap";
import { interval, Observable, Subscriber } from "rxjs";
import {
  Datastore,
  GetJobsScheduledBeforeArgs,
  ShardingAlgorithm,
  WaitForRegisteredJobsByRegisteredAtArgs,
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

  close(): TE.TaskEither<any, void> {
    return TE.right(undefined);
  }

  static factory(props: Partial<InMemoryDataStoreProps> & { clock: Clock }) {
    props.queuedJobs?.forEach((j) => {
      j.status = new JobStatus({
        registeredAt: RegisteredAt.fromDate(props.clock.now()),
        value: "queued",
      });
    });

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
          shardsToListenTo.prefix > 1 &&
          this.shardsByJobId.has(job.jobDefinition.id)
        ) {
          const matchingShard = this.shardsByJobId.get(job.jobDefinition.id)?.[
            shardsToListenTo.prefix - 2
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
    { maxNoticePeriodMs }: WaitForRegisteredJobsByRegisteredAtArgs,
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
              return scheduledAt <= now + maxNoticePeriodMs;
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
      jobDocument.status.enqueue(QueuedAt.fromDate(this.clock.now()));
      this.queuedJobs.set(jobDefinition.id, jobDocument);
    });
    return TE.right(undefined);
  }

  markJobAsRunning({
    jobId,
  }: {
    jobId: JobId;
    status: JobStatus;
  }): TE.TaskEither<any, void> {
    const jobDocument = this.queuedJobs.get(jobId);
    if (!jobDocument) {
      return TE.left(new Error(`Job ${jobId} not found in queued jobs`));
    }
    this.queuedJobs.delete(jobId);
    jobDocument.status.markAsRunning(StartedAt.fromDate(this.clock.now()));
    this.runningJobs.set(jobId, jobDocument);
    const shards = this.shardsByJobId.get(jobId);
    // If document was sharded, remove it from map queuesJobByShardIndex.
    if (shards) {
      for (const shard of shards) {
        this.queuesJobByShardIndex.delete(shard.toString(), jobId);
      }
    }
    return TE.right(undefined);
  }

  markRateLimited(jobDocument: JobDocument, rateLimits: RateLimit[]) {
    return TE.of(undefined);
  }

  markAsDead(jobDocument: JobDocument) {
    return TE.of(undefined);
  }

  markJobAsComplete({ jobId }: { jobId: JobId }): TE.TaskEither<any, void> {
    const jobDocument = this.runningJobs.get(jobId);
    if (!jobDocument) {
      return TE.left(new Error(`Job ${jobId} not found in running jobs`));
    }
    jobDocument.status.markAsCompleted(CompletedAt.fromDate(this.clock.now()));
    this.completedJobs.set(jobId, jobDocument);
    this.runningJobs.delete(jobId);
    this.shardsByJobId.delete(jobId);
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

  getRegisteredJobsByScheduledAt(
    { maxScheduledAt, limit, offset }: GetJobsScheduledBeforeArgs,
    shardsToListenTo?: ShardsToListenTo
  ) {
    return TE.of(
      _.take(
        this.jobsMatchingShard(this.registeredJobs, shardsToListenTo)
          .filter((job) => {
            const scheduledAt = job.jobDefinition.scheduledAt.getTime();
            return scheduledAt <= maxScheduledAt.getTime();
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
    shardsToListenTo?: ShardsToListenTo
  ): TE.TaskEither<Error, Observable<JobDocument[]>> {
    return TE.of(
      new Observable<JobDocument[]>((observer) => {
        this._waitForNextJobsInQueue(observer, shardsToListenTo);
      })
    );
  }

  private _waitForNextJobsInQueue(
    observer: Subscriber<JobDocument[]>,
    shardsToListenTo?: ShardsToListenTo
  ) {
    const jobs = _.sortBy(
      this.jobsMatchingShard(this.queuedJobs, shardsToListenTo),
      (i) => i.jobDefinition.scheduledAt.getTime()
    );

    if (jobs.length > 0) {
      observer.next(jobs);
    } else {
      setTimeout(() => {
        this._waitForNextJobsInQueue(observer, shardsToListenTo);
      }, 100);
    }
  }
}

const toEntries = (array: JobDocument[]) =>
  _.entries(_.keyBy(array, "jobDefinition.id")) as [JobId, JobDocument][];

const all = (map: Map<JobId, JobDocument>) => new Array(...map.values());
