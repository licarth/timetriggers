import { Clock } from "@/Clock/Clock";
import { SystemClock } from "@/Clock/SystemClock";
import _ from "lodash";
import { Observable, Subscriber } from "rxjs";
import { JobDefinition } from "src/JobDefinition";
import { JobId } from "src/JobId";
import { InMemoryScheduler } from "./InMemoryScheduler";
import { InMemoryWorker } from "./InMemoryWorker";

export class InMemoryDataStructure {
  private clock: Clock;
  plannedJobs: JobDefinition[] = [];
  subscriber?: Subscriber<JobDefinition>;

  queuedJobs: Observable<JobDefinition> = new Observable<JobDefinition>(
    (subscriber) => {
      this.subscriber = subscriber;
    }
  );

  doneJobs: JobDefinition[] = [];

  private scheduler;
  private worker = new InMemoryWorker(this);

  constructor(clock?: Clock) {
    if (clock) {
      this.clock = clock;
    } else {
      this.clock = new SystemClock();
    }
    this.scheduler = new InMemoryScheduler(this, this.clock);
  }

  cancel(jobId: JobId) {
    _.remove(this.plannedJobs, (job) => job.id === jobId);
  }

  cancellAllJobs() {
    this.plannedJobs = [];
    this.scheduler.cancelAllJobs();
  }

  schedule(jobDefinition: JobDefinition) {
    this.scheduler.schedule(jobDefinition);
    return this.plannedJobs.push(jobDefinition);
  }

  getNextPLanned(count: number) {
    return _.sortBy(this.plannedJobs, (job) =>
      job.scheduledAt.date.getTime()
    ).slice(0, count);
  }
}
