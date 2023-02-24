import { Clock } from "@timetriggers/domain";
import { SystemClock } from "@timetriggers/domain";
import { getShardsToListenToObject } from "@/ConsistentHashing/ConsistentHashing";
import {
  ClusterNodeInformation,
  CoordinationClient,
} from "@/Coordination/CoordinationClient";
import { externallyResolvablePromise } from "@/externallyResolvablePromise";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { Datastore } from "./Datastore";
import { ShardsToListenTo } from "./ShardsToListenTo";
import { debounceTime } from "rxjs";

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
  shardsToListenTo?: ShardsToListenTo; // undefined means listen to all shards

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
        .pipe(debounceTime(1000))
        .subscribe(({ currentNodeId, clusterSize }) => {
          this.shardsToListenTo =
            getShardsToListenToObject(currentNodeId, clusterSize) || undefined;
          this.onClusterTopologyChange({ currentNodeId, clusterSize });
          resolve(); // do only once.
        });
    } else {
      this.onClusterTopologyChange({ currentNodeId: 0, clusterSize: 1 });
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
            this.shardsToListenTo === undefined
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

  close(): TE.TaskEither<Error, void> {
    this.coordinationClientSubscription?.unsubscribe();
    return TE.of(undefined);
  }
}
