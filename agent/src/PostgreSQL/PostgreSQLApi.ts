import { AbstractApi, AbstractApiProps } from "@/AbstractApi";
import * as TE from "fp-ts/lib/TaskEither.js";
import { JobDefinition } from "@timetriggers/domain";
import { JobId } from "@timetriggers/domain";

export type PostgreSQLApiProps = AbstractApiProps & {};

export class PostgreSQLApi extends AbstractApi {
  // Table jobs

  // id: incremental
  // created_at: timestamp
  // updated_at: timestamp
  // job_definition: Bytes (ideally not in Postgres, but in a cheaper storage)

  // status: registered, queued, running, completed

  // Scheduler
  // Processor that takes jobs from the table and puts them in the queue

  constructor(props: PostgreSQLApiProps) {
    super(props);
  }

  static build = (props: PostgreSQLApiProps) => {
    return TE.of(new PostgreSQLApi(props));
  };

  schedule(args: Omit<JobDefinition, "id">): TE.TaskEither<any, JobId> {
    const id = JobId.factory();
    // Insert into table 'jobs' in a transaction
    return TE.right(id);
  }

  cancel(args: { jobId: JobId }) {
    // Remove from table in a transaction
    return TE.right(undefined);
  }

  getNextPlanned(count: number) {
    // get all jobs from table where status is planned
    return TE.of([]);
  }

  cancelAllJobs() {
    return TE.right(undefined);
  }

  close() {
    // Nothing to do here
    return TE.right(undefined);
  }
}
