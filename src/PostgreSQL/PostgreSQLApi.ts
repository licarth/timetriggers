import { AbstractApi, AbstractApiProps } from "@/AbstractApi";
import * as TE from "fp-ts/lib/TaskEither";
import { JobDefinition } from "../JobDefinition";
import { JobId } from "../JobId";

export type PostgreSQLApiProps = AbstractApiProps & {};

export class PostgreSQLApi extends AbstractApi {
  constructor(props: PostgreSQLApiProps) {
    super(props);
  }

  schedule(args: Omit<JobDefinition, "id">): TE.TaskEither<any, JobId> {
    const id = JobId.factory();
    return TE.right(id);
  }

  cancel(args: { jobId: JobId }) {
    return TE.right(undefined);
  }

  getNextPlanned(count: number) {
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
