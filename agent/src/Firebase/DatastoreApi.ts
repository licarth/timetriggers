import { AbstractApi, AbstractApiProps } from "@/AbstractApi";
import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import { JobId, JobScheduleArgs, ProjectId, Shard } from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { CancelProps, Datastore } from "./Processor/Datastore";

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
    return pipe(
      this.datastore.schedule(
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
      ),
      TE.map(({ jobDocument }) => jobDocument.jobDefinition.id)
    );
  }

  cancel(args: CancelProps) {
    return this.datastore.cancel(args);
  }

  close() {
    return TE.right(undefined);
  }
}
