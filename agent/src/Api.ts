import * as TE from "fp-ts/lib/TaskEither.js";
import { JobId } from "@timetriggers/domain";
import { JobScheduleArgs } from "@timetriggers/domain";

/**
 * Main interface for scheduling a callback.
 */
export interface Api {
  schedule(args: JobScheduleArgs): TE.TaskEither<any, JobId>;
  cancel(args: { jobId: JobId }): TE.TaskEither<any, void>;
  close(): TE.TaskEither<any, void>;
}
