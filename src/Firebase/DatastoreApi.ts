import { AbstractApi, AbstractApiProps } from "@/AbstractApi";
import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as O from "fp-ts/lib/Option.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import * as C from "io-ts/lib/Codec.js";
import { JobDefinition } from "../domain/JobDefinition";
import { JobId } from "../domain/JobId";
import { withTimeout } from "../fp-ts/withTimeout";
import { REGISTERED_JOBS_COLL_PATH } from "./FirestoreScheduler";
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

  static build(props: DatastoreApiProps) {}

  schedule(args: Omit<JobDefinition, "id">) {
    return this.datastore.schedule(args);
  }

  cancel(args: { jobId: JobId }) {
    return this.datastore.cancel(args.jobId);
  }

  close() {
    return TE.right(undefined);
  }
}
