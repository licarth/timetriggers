import { Clock } from "@/Clock/Clock";
import { SystemClock } from "@/Clock/SystemClock";
import { getShardsToListenToObject } from "@/ConsistentHashing/ConsistentHashing";
import {
  ClusterNodeInformation,
  CoordinationClient,
} from "@/Coordination/CoordinationClient";
import { externallyResolvablePromise } from "@/externallyResolvablePromise";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { Datastore } from "./Datastore";
import { ShardsToListenTo } from "./InMemoryDataStore";

export type ClusterTopologyDatastoreAwareProps = {
  clock?: Clock;
  datastore: Datastore;
  coordinationClient?: CoordinationClient;
};

export abstract class ClusterTopologyDatastoreAware {
  protected clock;
  datastore;

  coordinationClient;
  coordinationClientSubscription;
  clusterTopologyIsReadyPromise;
  shardsToListenTo?: ShardsToListenTo | "all";

  protected constructor(props: ClusterTopologyDatastoreAwareProps) {
    this.clock = props.clock || new SystemClock();
    this.datastore = props.datastore;
    this.coordinationClient = props.coordinationClient;
    const { promise: clusterTopologyIsReadyPromise, resolve } =
      externallyResolvablePromise<void>();
    this.clusterTopologyIsReadyPromise = clusterTopologyIsReadyPromise;
    if (this.coordinationClient) {
      this.coordinationClientSubscription = this.coordinationClient
        .getClusterNodeInformation()
        .subscribe(({ currentNodeId, clusterSize }) => {
          this.shardsToListenTo =
            getShardsToListenToObject(currentNodeId, clusterSize) || "all";
          this.onClusterTopologyChange({ currentNodeId, clusterSize });
          resolve();
        });
    } else {
      resolve();
    }
  }

  abstract onClusterTopologyChange(
    clusterNodeInformation: ClusterNodeInformation
  ): void;

  protected startListeningToCluster() {
    this.coordinationClient
      ? console.log(
          `Starting, listening to ${
            this.shardsToListenTo === "all"
              ? "all shards"
              : `shards ${this.shardsToListenTo?.nodeIds.join(", ")}`
          }.`
        )
      : console.log(`Starting, listening... (no shards)`);

    // We should wait until shardsToListenTo is set
    return pipe(
      // Run coordination client if it exists
      () => this.clusterTopologyIsReadyPromise,
      TE.fromTask
    );
  }

  close = () => {
    this.coordinationClientSubscription?.unsubscribe();
  };
}
