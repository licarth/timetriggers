import { Clock } from "@/Clock/Clock";
import { SystemClock } from "@/Clock/SystemClock";
import * as TE from "fp-ts/lib/TaskEither";
import { Api } from "../Api";
import { JobDefinition } from "../JobDefinition";
import { JobId } from "../JobId";
import { InMemoryDataStructure } from "./InMemoryDataStructure";

export class InMemoryApi implements Api {
  private clock: Clock;
  private dataStructure;

  constructor(clock?: Clock) {
    if (clock) {
      this.clock = clock;
    } else {
      this.clock = new SystemClock();
    }
    this.dataStructure = new InMemoryDataStructure(this.clock);
  }

  schedule(args: Omit<JobDefinition, "id">): TE.TaskEither<any, JobId> {
    const id = JobId.factory();
    this.dataStructure.schedule(new JobDefinition({ ...args, id }));
    return TE.right(id);
  }

  cancel(args: { jobId: JobId }) {
    this.dataStructure.cancel(args.jobId);
    return TE.right(undefined);
  }

  // getJobStatus(args: { jobId: JobId }) {
  //   const job = this.dataStructure.plannedJobs.find(
  //     (job) => job.id === args.jobId
  //   );
  //   if (job) {
  //     return TE.right(JobStatusUpdate.planned);
  //   }
  //   return TE.right(JobStatusUpdate.completed);
  // }

  getNextPlanned(count: number) {
    return TE.of(this.dataStructure.getNextPLanned(count));
  }

  cancelAllJobs() {
    this.dataStructure.plannedJobs = [];
    this.dataStructure.cancellAllJobs();
    return TE.right(undefined);
  }

  close() {
    // Nothing to do here
    return TE.right(undefined);
  }
}
