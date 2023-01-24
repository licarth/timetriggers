import type { Client as ZK } from "node-zookeeper-client";
import ZooKeeper, { Exception } from "node-zookeeper-client";
import { debounceTime, Observable, ReplaySubject } from "rxjs";

import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import {
  ClusterNodeInformation,
  CoordinationClient,
} from "./CoordinationClient";

type ZookeeperCoordinationClientV2BuildProps = {
  namespace?: string;
};
type ZookeeperCoordinationClientV2Props = {
  zk: ZK;
  namespace: string;
};

const { CreateMode } = ZooKeeper;

/**
 * This is a new version of the Zookeeper coordination client that uses a better
 * algorithm for creating nodes in Zookeeper.
 *
 * It always tries to have contiguous node numbers. When there is a server disconnection,
 * (e.g. node 2/5 becomes unavailable), then node 5 takes the place of node 2.
 *
 * This is because some environment do not allow us to control which node to remove on a scale down (e.g.
 * Kubernetes Deployment). This would not be needed with a StatefulSet, but we don't want to enforce using
 * StatefulSets necessarily.
 *
 * The algorithm is as follows:
 * 1. get current children
 * 2. try to get the first available node (including holes)
 *   on success, go to step 4
 *   on failure, go to step 1
 * 3. listen to children changes
 *
 * on children change:
 * 4. get current children
 * 5. determine whether nodes are contiguous
 *   if they are contiguous, go to step 3
 *   if they are not, go to step 8
 * 6. determine wether current node is the last one
 *   if current node = last node, restart the node algithm
 *   else, go to step 3
 */

export class ZookeeperCoordinationClientV2 implements CoordinationClient {
  private readonly zk: ZK;
  private subject = new ReplaySubject<ClusterNodeInformation>(1); // Emit the most recent information to new subscribers
  private nodePath?: string;
  private readonly namespace: string;

  constructor(props: ZookeeperCoordinationClientV2Props) {
    this.zk = props.zk;
    this.namespace = props.namespace;
  }

  static build(
    props: Partial<ZookeeperCoordinationClientV2BuildProps> = {}
  ): TE.TaskEither<Error, ZookeeperCoordinationClientV2> {
    const client = ZooKeeper.createClient("localhost:2181", {
      sessionTimeout: 500,
    });

    const coordinationClient = new ZookeeperCoordinationClientV2({
      zk: client,
      namespace: props.namespace || "/default",
    });

    return pipe(
      coordinationClient.connect(),
      TE.chainW(() => coordinationClient.createSchedulerNode()),
      TE.chainW(() => coordinationClient.announceItself()),
      TE.map(() => coordinationClient)
    );
  }

  connect(): TE.TaskEither<Error, void> {
    return TE.tryCatch(
      () => {
        const newLocal = new Promise<void>((resolve, reject) => {
          this.zk.once("connected", () => {
            resolve();
          });
        });
        this.zk.connect();
        return newLocal;
      },
      (e) => new Error(`could not connect to zookeeper: ${e}`)
    );
  }

  createNodeWithPath(path: string): TE.TaskEither<Error, void> {
    // use a transaction
    return TE.tryCatch(
      () => {
        // console.log(`creating node with path ${path}`);
        const pathElements = _.compact(path.split("/"));
        const pathPrefixes = pathElements.reduce(
          (acc, next) =>
            acc.length > 0
              ? [...acc, `${acc[acc.length - 1]}/${next}`]
              : [`/${next}`],
          [] as string[]
        );

        return executePromiseArraySequentially(
          pathPrefixes.map(
            (pathPrefix) =>
              new Promise<void>((resolve, reject) => {
                this.zk.create(
                  pathPrefix,
                  CreateMode.PERSISTENT,
                  (error, path) => {
                    resolve();
                  }
                );
              })
          )
        );
      },
      (e) => new Error(`could not create node with path ${path}: ${e}`)
    );
  }

  createSchedulerNode(): TE.TaskEither<Error, void> {
    return pipe(
      this.createNodeIfNotExists(`${this.namespace}/schedulers`),
      TE.chainW(() =>
        this.listenToClusterTopology(`${this.namespace}/schedulers`)
      )
    );
  }

  createNodeIfNotExists(path: string): TE.TaskEither<Error, void> {
    return pipe(
      this.nodeExists(path),
      TE.chainW((exists) =>
        exists
          ? TE.right(void 0)
          : this.createNodeWithPath(`${this.namespace}/schedulers`)
      )
    );
  }

  nodeExists(path: string): TE.TaskEither<Error, boolean> {
    return TE.tryCatch(
      () =>
        new Promise<boolean>((resolve, reject) => {
          this.zk.exists(path, (error, stat) => {
            if (error) {
              reject(error);
            } else {
              const exists = stat !== null;
              // console.log(`node ${path} exists: ${exists}`);
              resolve(exists);
            }
          });
        }),
      (e) => new Error(`could not check if node exists: ${e}`)
    );
  }

  announceItself(): TE.TaskEither<Error, void> {
    return pipe(
      TE.tryCatch(
        () =>
          new Promise<string>((resolve, reject) => {
            const nodePath = `${this.namespace}/schedulers/scheduler-`;
            // console.log(`creating ephemeral node ${nodePath}`);
            this.zk.create(
              nodePath,
              CreateMode.EPHEMERAL_SEQUENTIAL,
              (error, path) => {
                if (!error) {
                  // console.log(`created ephemeral node ${path}`);
                  resolve(path);
                } else {
                  reject(error);
                }
              }
            );
          }),
        (e) => new Error(`could not create zookeper client: ${e}`)
      ),
      TE.map((path) => {
        this.nodePath = path;
        return void 0;
      })
    );
  }

  listenToClusterTopology(path: string): TE.TaskEither<Error, void> {
    return TE.tryCatch(
      () =>
        new Promise<void>((resolve, reject) => {
          // console.log(`listening to cluster topology at ${path}`);
          this.zk.getChildren(
            path,
            (event) => {
              // need to listen again now..
              this.listenToClusterTopology(path)();
            },
            (error, children, stat) => {
              if (error) {
                reject(error);
              } else {
                // console.log(`found children: ${children}`);
                const sortedChildren = _.sortBy(children);
                const currentNodeId = sortedChildren.indexOf(
                  this.nodePath?.split("/").pop() ?? ""
                );

                if (currentNodeId !== -1) {
                  // console.log(
                  //   "nodePath",
                  //   this.nodePath,
                  //   "sortedChildren",
                  //   sortedChildren
                  // );

                  this.subject.next({
                    currentNodeId,
                    clusterSize: children.length,
                  });
                }
                resolve();
              }
            }
          );
        }),
      (e) => new Error(`could not listen to cluster topology: ${e}`)
    );
  }

  getClusterNodeInformation(): Observable<ClusterNodeInformation> {
    return pipe(this.subject.asObservable(), debounceTime(300));
  }

  close(): TE.TaskEither<Error, void> {
    return pipe(
      TE.tryCatch(
        () =>
          new Promise<void>((resolve, reject) => {
            this.nodePath
              ? this.zk.remove(this.nodePath, (error) => {
                  if (error) {
                    console.error(error);
                    reject(error);
                  } else {
                    resolve();
                  }
                })
              : resolve();
          }),
        (e) => new Error(`could not close zookeeper client: ${e}`)
      ),
      TE.chainW(
        TE.tryCatchK(
          () =>
            new Promise<void>((resolve, reject) => {
              this.zk.once("disconnected", () => {
                resolve();
              });
              this.zk.close();
            }),
          (e) => new Error(`could not close zookeeper client: ${e}`)
        )
      )
    );
  }
}

const isZookeeperException = (
  reason: Error | Exception
): reason is Exception => {
  return (reason as Exception).code !== undefined;
};

const executePromiseArraySequentially = (promises: Promise<any>[]) => {
  return promises.reduce(async (promiseChain, currentTask) => {
    const chainResults = await promiseChain;
    const currentResult = await currentTask;
    return [...chainResults, currentResult];
  }, Promise.resolve([]));
};
