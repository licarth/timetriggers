import { Clock } from "@/Clock/Clock";
import { SystemClock } from "@/Clock/SystemClock";
import { JobDefinition } from "@/domain/JobDefinition";
import { JobId } from "@/domain/JobId";
import { JobScheduleArgs } from "@/domain/JobScheduleHttpArgs";
import { te } from "@/fp-ts";
import { HttpCallCompleted, HttpCallErrored } from "@/HttpCallStatusUpdate";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import { interval, Observable, Subscriber } from "rxjs";
import { Datastore } from "./Datastore";
import { distinctArray } from "./distinctArray";

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
  private registeredJobs;
  private queuedJobs;
  private completedJobs;

  constructor(props: InMemoryDataStoreProps) {
    this.clock = props.clock || new SystemClock();
    this.pollingInterval = props.pollingInterval;
    this.registeredJobs = props.registeredJobs;
    this.queuedJobs = props.queuedJobs;
    this.completedJobs = props.completedJobs;
  }

  static factory(props: Partial<InMemoryDataStoreProps> = {}) {
    return new InMemoryDataStore({
      clock: props.clock,
      pollingInterval: props.pollingInterval || 1000,
      registeredJobs: props.registeredJobs || [],
      queuedJobs: props.queuedJobs || [],
      completedJobs: props.completedJobs || [],
    });
  }

  newlyRegisteredJobsBefore(args: {
    millisecondsFromNow: number;
  }): Observable<JobDefinition[]> {
    return pipe(
      new Observable((subscriber: Subscriber<JobDefinition[]>) => {
        const interval = this.clock.setInterval(() => {
          const jobs = _.filter(this.registeredJobs, (job) => {
            const scheduledAt = job.scheduledAt.date.getTime();
            const now = this.clock.now().getTime();
            return scheduledAt < now + args.millisecondsFromNow;
          });

          subscriber.next(jobs);
        }, this.pollingInterval);

        return () => this.clock.clearInterval(interval);
      }),
      distinctArray(
        (JobDefinition) => JobDefinition.id,
        interval(10 * 60 * 1000) // 10 minutes
      )
    );
  }

  queueJob(jobDefinition: JobDefinition): TE.TaskEither<any, void> {
    this.queuedJobs.push(jobDefinition);
    _.remove(this.registeredJobs, (job) => job.id === jobDefinition.id);
    return TE.right(undefined);
  }

  markJobAsRunning(jobDefinition: JobDefinition): TE.TaskEither<any, void> {
    _.remove(this.queuedJobs, (job) => job.id === jobDefinition.id);
    return TE.right(undefined);
  }

  markJobAsComplete(args: {
    jobDefinition: JobDefinition;
    lastStatusUpdate: HttpCallCompleted | HttpCallErrored;
    durationMs: number;
    executionStartDate: Date;
  }): TE.TaskEither<any, void> {
    this.completedJobs.push(args.jobDefinition);
    _.remove(this.queuedJobs, (job) => job.id === args.jobDefinition.id);
    return TE.right(undefined);
  }

  cancel(jobId: JobId) {
    _.remove(this.registeredJobs, (job) => job.id === jobId);
    return TE.right(undefined);
  }

  schedule(jobDefinition: JobScheduleArgs) {
    const id = JobId.factory();
    this.registeredJobs.push(new JobDefinition({ ...jobDefinition, id }));
    return TE.of(id);
  }

  getJobsScheduledAfter(args: { millisecondsFromNow: number; limit: number }) {
    return TE.of(
      _.filter(this.registeredJobs, (job) => {
        const scheduledAt = job.scheduledAt.date.getTime();
        const now = this.clock.now().getTime();
        return scheduledAt > now + args.millisecondsFromNow;
      })
    );
  }

  waitForNextJobsInQueue(args: {
    limit: number;
  }): TE.TaskEither<any, JobDefinition[]> {
    return TE.tryCatch(
      () =>
        new Promise((resolve) => {
          const jobs = _.sortBy(this.queuedJobs, (i) =>
            i.scheduledAt.date.getTime()
          ).splice(0, args.limit);

          if (jobs.length > 0) {
            resolve(jobs);
          } else {
            setTimeout(() => {
              resolve(te.unsafeGetOrThrow(this.waitForNextJobsInQueue(args)));
            }, 100);
          }
        }),
      (e) => new Error("Error waiting for next job in queue: " + e)
    );
  }

  getNextPLanned(count: number) {
    return _.sortBy(this.registeredJobs, (job) =>
      job.scheduledAt.date.getTime()
    ).slice(0, count);
  }
}
