import { Clock } from "@/Clock/Clock";
import {
  ClusterNodeInformation,
  CoordinationClient,
} from "@/Coordination/CoordinationClient";
import { withTimeout } from "@/fp-ts/withTimeout";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { ClusterTopologyDatastoreAware } from "./ClusterTopologyAware";
import { Datastore } from "./Datastore";

type SchedulerProps = {
  clock?: Clock;
  datastore: Datastore;
  coordinationClient?: CoordinationClient;
};

export class Scheduler extends ClusterTopologyDatastoreAware {
  private constructor(props: SchedulerProps) {
    super(props);
  }

  onClusterTopologyChange = (clusterTopology: ClusterNodeInformation) => {
    console.log(
      `New cluster topology ! currentNodeID: ${clusterTopology.currentNodeId},  nodeCount: ${clusterTopology.clusterSize}
Reaffecting shards...`
    );
  };

  close = () => {
    super.close();
  };

  static build(props: SchedulerProps): TE.TaskEither<Error, Scheduler> {
    const self = new Scheduler(props);
    return pipe(
      self,
      (clusterTopologyDatastoreAware) =>
        clusterTopologyDatastoreAware.startListeningToCluster(),
      TE.map(() => self),
      withTimeout(
        E.left(new Error("Cluster topology is not ready in 10 seconds")),
        10000
      )
    );
  }
}
