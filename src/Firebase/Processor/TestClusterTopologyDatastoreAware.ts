import { ClusterNodeInformation } from "@/Coordination/CoordinationClient";
import { withTimeout } from "@/fp-ts/withTimeout";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import {
  ClusterTopologyDatastoreAware,
  ClusterTopologyDatastoreAwareProps,
} from "./ClusterTopologyAware";

export class TestClusterTopologyDatastoreAware extends ClusterTopologyDatastoreAware {
  onClusterTopologyChange(clusterTopology: ClusterNodeInformation) {
    return;
  }

  static build(
    props: ClusterTopologyDatastoreAwareProps
  ): TE.TaskEither<Error, ClusterTopologyDatastoreAware> {
    const self = new TestClusterTopologyDatastoreAware(props);
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
