import { AbstractApi, AbstractApiProps } from "@/AbstractApi";
import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import { JobScheduleArgs, ProjectId, Shard } from "@timetriggers/domain";
import * as TE from "fp-ts/lib/TaskEither.js";
import { JobDefinition } from "@timetriggers/domain";
import { JobId } from "@timetriggers/domain";
import { Datastore } from "./Processor/Datastore";

const preloadedHashingFunction = consistentHashingFirebaseArrayPreloaded(11);

export type DatastoreApiProps = AbstractApiProps & {
  datastore: Datastore;
};

export class DatastoreApi extends AbstractApi {
  datastore;

  constructor(props: DatastoreApiProps) {
    super(props);
    this.datastore = props.datastore;
  }

  schedule(args: JobScheduleArgs, projectId?: ProjectId) {
    return this.datastore.schedule(
      args,
      (jobId: JobId) =>
        preloadedHashingFunction(jobId)
          .slice(1)
          .map((s) => {
            const parts = s.split("-");
            return new Shard({
              nodeCount: Number(parts[0]),
              nodeId: Number(parts[1]),
            });
          }),
      projectId
    );
  }

  cancel(args: { jobId: JobId }) {
    return this.datastore.cancel(args.jobId);
  }

  close() {
    return TE.right(undefined);
  }
}
