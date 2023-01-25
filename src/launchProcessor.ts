import { pipe } from "fp-ts/lib/function.js";
import { AxiosWorkerPool } from "./AxiosWorkerPool.js";
import { getShardsToListenTo } from "./ConsistentHashing/ConsistentHashing.js";
import { ZookeeperCoordinationClient } from "./Coordination/ZookeeperCoordinationClient.js";
import { FirestoreApi } from "./Firebase/FirestoreApi.js";
import { FirestoreProcessor } from "./Firebase/FirestoreProcessor.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { te } from "./fp-ts/te.js";
import { FirestoreScheduler } from "./Firebase/FirestoreScheduler.js";
import { SystemClock } from "./Clock/SystemClock.js";

export function launchProcessor(
  api: FirestoreApi,
  rootDocumentPath: string,
  zookeeperNamespace: string
) {
  console.log(`server launching`);
  return pipe(
    ZookeeperCoordinationClient.build({ namespace: zookeeperNamespace }),
    TE.chainW((zk) => {
      console.log(`Coordination client launched.`);
      let currentProcessor: FirestoreProcessor | undefined;
      let currentScheduler: FirestoreScheduler | undefined;
      zk.getClusterNodeInformation().subscribe((newInfo) => {
        console.log(
          `(re)starting processor because of new cluster info: ${
            newInfo.currentNodeId + 1
          }/${newInfo.clusterSize}`
        );
        currentProcessor && currentProcessor.close();
        currentScheduler && te.unsafeGetOrThrow(currentScheduler.close());
        const shardsToListenTo = getShardsToListenTo(
          newInfo.currentNodeId,
          newInfo.clusterSize
        );
        currentProcessor = new FirestoreProcessor({
          firestore: api.firestore,
          rootDocumentPath,
          workerPool: new AxiosWorkerPool({
            minSize: 1,
            maxSize: 50,
          }),
          shardsToListenTo,
        });
        currentScheduler = new FirestoreScheduler({
          firestore: api.firestore,
          clock: new SystemClock(),
          rootDocumentPath,
          shardsToListenTo,
        });
        te.unsafeGetOrThrow(currentProcessor.run());
        te.unsafeGetOrThrow(currentScheduler.run());
      });
      return TE.right(undefined);
    })
  );
}
