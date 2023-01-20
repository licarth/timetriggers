import { AbstractApi, AbstractApiProps } from "@/AbstractApi";
import { Clock } from "@/Clock/Clock";
import { SystemClock } from "@/Clock/SystemClock";
import * as TE from "fp-ts/lib/TaskEither";
import { Api } from "../Api";
import { JobDefinition } from "../JobDefinition";
import { JobId } from "../JobId";
import { InMemoryDataStructure } from "./InMemoryDataStructure";

export type InMemoryApiProps = AbstractApiProps & {};
export class InMemoryApi extends AbstractApi {
  private dataStructure;

  constructor({ clock }: InMemoryApiProps) {
    super({ clock });
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
