import { JobDefinition } from "@/domain/JobDefinition";
import { Observable } from "rxjs";
import * as TE from "fp-ts/lib/TaskEither.js";
import { HttpCallLastStatus } from "@/HttpCallStatusUpdate";
import { JobScheduleArgs } from "@/domain/JobScheduleHttpArgs";
import { JobId } from "@/domain/JobId";
import { Shard } from "@/domain/Shard";
import { ShardsToListenTo } from "./InMemoryDataStore";

export type ShardingAlgorithm = (job: JobId) => Shard[];
// For firestore, we'll just pretend that we have more nodes than we actually have.
// Each processor will take more than one shard.

export interface Datastore {
  schedule(
    args: JobScheduleArgs,
    shardingAlgorithm?: ShardingAlgorithm
  ): TE.TaskEither<Error, JobId>;
  cancel(jobId: JobId): TE.TaskEither<Error, void>;

  /**
   * This is a stream of registered jobs.
   *
   * It's ok to emit the same job multiple times occasionally,
   * as long as performance is not affected too much,
   * this is because the transaction will make sure to not add the same job twice to the queue.
   *
   * This can be implemented as a poll (e.g. MySQL) or as a blocking get if supported (e.g. Firestore).
   *
   * __NOTE: TODO:__ This could be improved by getting this directly from the Api.
   * This would allow us to avoid polling the datastore, even if it's PostgreSQL.
   *
   * But then this means we'd need to give this to the right Shard. This could be an internal endpoint of
   * our Api. (Api => Scheduler directly).
   *
   * The first call must return all jobs that are scheduled within the next millisecondsFromNow.
   *
   */
  newlyRegisteredJobsBefore(
    args: {
      millisecondsFromNow: number;
    },
    shardsToListenTo?: ShardsToListenTo
  ): Observable<JobDefinition[]>;

  /**
   * Returns all jobs scheduled after msFromNow, up to limit items.
   * They must be ordered by scheduledAt.
   *
   */
  getJobsScheduledAfter(
    args: {
      millisecondsFromNow: number;
      limit: number;
    },
    shardsToListenTo?: ShardsToListenTo
  ): TE.TaskEither<any, JobDefinition[]>;

  // Some datastores support watching for added / modified jobs. For these, we can avoid high-frequency polling.
  // => 1. listen to jobs newly (re-)scheduled within a given time range from now (and in the past).
  // => 2. and poll for jobs beyond that time range.

  // If the datastore does not support watching for added / modified jobs, we can use the following methods:
  // => 1. poll for jobs that are scheduled within a given time range from now (and in the past). (e.g. MySQL - poll every second)
  // => 2. and poll for jobs beyond that time range.

  // For the poll version of 1., we should keep in memory the list of jobs already discovered,
  // and only warn again except if nothing has happened for 5 minutes and the job is still registered.

  /**
   * Waits for the next job in the queue.
   *
   * If the datastore does not support blocking gets, this can be implemented as a poll.
   *
   * returns the next job(s) in the queue, up to limit.
   *
   */
  waitForNextJobsInQueue(
    args: {
      limit: number;
    },
    shardsToListenTo?: ShardsToListenTo
  ): TE.TaskEither<any, JobDefinition[]>;

  /**
   * Moves this job to the queue so that it's immediately picked up by the processor(s).
   * This must fail on the second call with the same jobDefinition.
   */
  queueJob(jobDefinition: JobDefinition): TE.TaskEither<any, void>;

  /**
   * Marks the job as running.
   * This must fail if the job (any of):
   *   - is not in the queue.
   *   - is already running.
   *   - is already complete.
   */
  markJobAsRunning(jobDefinition: JobDefinition): TE.TaskEither<any, void>;

  /**
   * Marks the job as complete.
   */
  markJobAsComplete(args: {
    jobDefinition: JobDefinition;
    lastStatusUpdate: HttpCallLastStatus;
    durationMs: number;
    executionStartDate: Date;
  }): TE.TaskEither<any, void>;

  close(): TE.TaskEither<any, void>;
}
