import { JobId, JobScheduleArgs, ProjectId } from "@timetriggers/domain";
import * as TE from "fp-ts/lib/TaskEither.js";

/**
 * Main interface for scheduling a callback.
 */
export interface Api {
  // Schedule or re-schedule if exists
  schedule(
    args: JobScheduleArgs,
    projectId?: ProjectId
  ): TE.TaskEither<any, JobId>;
  cancel(args: { jobId: JobId }): TE.TaskEither<any, void>;
  close(): TE.TaskEither<any, void>;
}
