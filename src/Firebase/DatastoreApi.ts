import { AbstractApi, AbstractApiProps } from "@/AbstractApi";
import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import { Shard } from "@/domain/Shard";
import * as TE from "fp-ts/lib/TaskEither.js";
import { JobDefinition } from "../domain/JobDefinition";
import { JobId } from "../domain/JobId";
import { Datastore } from "./Processor/Datastore";

const preloadedHashingFunction = consistentHashingFirebaseArrayPreloaded(15);

export type DatastoreApiProps = AbstractApiProps & {
  datastore: Datastore;
};

export class DatastoreApi extends AbstractApi {
  datastore;

  constructor(props: DatastoreApiProps) {
    super(props);
    this.datastore = props.datastore;
  }

  schedule(args: Omit<JobDefinition, "id">) {
    return this.datastore.schedule(args, (jobId: JobId) =>
      preloadedHashingFunction(jobId)
        .slice(1)
        .map((s) => {
          const parts = s.split("-");
          return new Shard({
            nodeCount: Number(parts[0]),
            nodeId: Number(parts[1]),
          });
        })
    );
  }

  cancel(args: { jobId: JobId }) {
    return this.datastore.cancel(args.jobId);
  }

  close() {
    return TE.right(undefined);
  }
}
