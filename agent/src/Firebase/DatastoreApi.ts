import { AbstractApi, AbstractApiProps } from "@/AbstractApi";
import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import {
  JobDefinition,
  JobDocument,
  JobId,
  JobScheduleArgs,
  JobStatus,
  ProjectId,
  ScheduledWithin,
  Shard,
} from "@timetriggers/domain";
import * as TE from "fp-ts/lib/TaskEither.js";
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
    const id = JobId.factory();
    const shardingAlgorithm = (jobId: JobId) =>
      preloadedHashingFunction(jobId)
        .slice(1)
        .map((s) => {
          const parts = s.split("-");
          return new Shard({
            nodeCount: Number(parts[0]),
            nodeId: Number(parts[1]),
          });
        });

    const jobDocument = new JobDocument({
      jobDefinition: new JobDefinition({ ...args, id }),
      projectId,
      shards: shardingAlgorithm
        ? shardingAlgorithm(id).map((s) => s.toString())
        : [],
      status: JobStatus.registeredNow(this.clock),
      scheduledWithin: ScheduledWithin.fromScheduledAt(
        args.scheduledAt,
        this.clock
      ),
    });

    return this.datastore.schedule(jobDocument);
  }

  cancel(args: { jobId: JobId }) {
    return this.datastore.cancel(args.jobId);
  }

  close() {
    return TE.right(undefined);
  }
}
