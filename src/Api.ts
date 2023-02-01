import * as TE from "fp-ts/lib/TaskEither.js";
import { JobDefinition } from "./domain/JobDefinition";
import { JobId } from "./domain/JobId";

/**
 * Main interface for scheduling a callback.
 */
export interface Api {
  schedule(args: Omit<JobDefinition, "id">): TE.TaskEither<any, JobId>;
  cancel(args: { jobId: JobId }): TE.TaskEither<any, void>;
  // getNextPlanned(count: number): TE.TaskEither<any, JobDefinition[]>;
  // cancelAllJobs(): TE.TaskEither<any, void>;
  close(): TE.TaskEither<any, void>;
}
