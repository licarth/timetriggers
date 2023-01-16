import { Clock } from "@/Clock/Clock";
import { SystemClock } from "@/Clock/SystemClock";
import { JobDefinition } from "src/JobDefinition";
import { JobId } from "src/JobId";
import { InMemoryDataStructure } from "./InMemoryDataStructure";

export class InMemoryScheduler {
  private dataStructure;
  private clock: Clock = new SystemClock();

  plannedTimeouts = new Map<JobId, NodeJS.Timeout>();

  constructor(dataStructure: InMemoryDataStructure, clock?: Clock) {
    this.dataStructure = dataStructure;
    if (clock) {
      this.clock = clock;
    }
  }

  schedule(jobDefinition: JobDefinition) {
    const waitMs = Math.max(
      0,
      jobDefinition.scheduledAt.date.getTime() - this.clock.now().getTime()
    );
    const timeoutId = this.clock.setTimeout(() => {
      this.dataStructure.subscriber?.next(jobDefinition);
      this.plannedTimeouts.delete(jobDefinition.id);
    }, waitMs);
    this.plannedTimeouts.set(jobDefinition.id, timeoutId);
  }

  cancel(jobId: JobId) {
    const timeout = this.plannedTimeouts.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
    }
  }

  cancelAllJobs() {
    this.plannedTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.plannedTimeouts.clear();
  }
}
