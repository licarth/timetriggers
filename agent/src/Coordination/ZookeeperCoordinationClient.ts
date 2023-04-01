import type { Client as ZK } from "node-zookeeper-client";
import ZooKeeper, { Exception } from "node-zookeeper-client";
import { Observable, ReplaySubject } from "rxjs";

import { te } from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import {
  ClusterNodeInformation,
  CoordinationClient,
} from "./CoordinationClient";

type ZookeeperCoordinationClientBuildProps = {
  namespace?: string;
};
type ZookeeperCoordinationClientProps = {
  zk: ZK;
  namespace: string;
};

const { CreateMode } = ZooKeeper;

export class ZookeeperCoordinationClient implements CoordinationClient {
  private readonly zk: ZK;
  private subject = new ReplaySubject<ClusterNodeInformation>(1); // Emit the most recent information to new subscribers
  private readonly path;
  private nodePath?: string;
  private readonly namespace: string;

  constructor(props: ZookeeperCoordinationClientProps) {
    this.zk = props.zk;
    this.namespace = props.namespace;
    this.path = `${this.namespace}/schedulers`;
  }

  static build(
    props: Partial<ZookeeperCoordinationClientBuildProps> = {}
  ): TE.TaskEither<Error, ZookeeperCoordinationClient> {
    const client = ZooKeeper.createClient(
      process.env.ZOOKEEPER_CONNECTION_STRING || "localhost:2181",
      {
        sessionTimeout: 500,
      }
    );

    const coordinationClient = new ZookeeperCoordinationClient({
      zk: client,
      namespace: props.namespace || "/default",
    });

    return pipe(
      coordinationClient.connect(),
      TE.chainW(() => coordinationClient.initialize()),
      TE.map(() => coordinationClient)
    );
  }

  initialize() {
    return pipe(
      this.createSchedulerNode(),
      TE.chainW(() => this.announceItself())
    );
  }

  private connect(): TE.TaskEither<Error, void> {
    return TE.tryCatch(
      () => {
        const clientConnectedPromise = new Promise<void>((resolve, reject) => {
          this.zk.once("connected", () => {
            resolve();
            console.log("Zookeeper connected !");

            this.zk.on("connected", () => {
              console.log("Zookeeper reconnected !");
              // check that we still own a node ?
              te.unsafeGetOrThrow(
                pipe(
                  this.isOwnerOfPath(),
                  TE.map((isOwner) => {
                    console.log(`Still owner? ${isOwner}`);
                  })
                )
              );
            });
          });
          this.zk.on("disconnected", () => {
            console.log("Zookeeper disconnected !");
          });

          this.zk.on("authenticationFailed", () => {
            console.log("Zookeeper authentication failed !");
          });

          // On SIGKILL, it should disconnect properly
          process.on(
            "SIGINT",
            pipe(() => {
              console.log("SIGINT received");
              this.zk.close();
            })
          );
        });
        this.zk.connect();
        return clientConnectedPromise;
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
      this.createNodeIfNotExists(this.path),
      TE.chainW(() => this.listenToClusterTopology(this.path))
    );
  }

  createNodeIfNotExists(path: string): TE.TaskEither<Error, void> {
    return pipe(
      this.nodeExists(path),
      TE.chainW((exists) =>
        exists ? TE.right(void 0) : this.createNodeWithPath(this.path)
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
        this.zk.getData(this.nodePath, (error, children, stat) => {
          // console.log(stat.ephemeralOwner);
        });
        return void 0;
      })
    );
  }

  isOwnerOfPath(): TE.TaskEither<Error, boolean> {
    // Check that we are the owner of our own path
    console.log(this.zk.getSessionId().toString("hex"));
    return TE.tryCatch(
      () =>
        new Promise<boolean>((resolve, reject) => {
          const nodePath = this.nodePath;
          if (!nodePath) {
            resolve(false);
          } else {
            this.zk.getData(nodePath, (error, children, stat) => {
              if (error) {
                reject(error);
              } else {
                //@ts-ignore
                const ephemeralOwner = stat.ephemeralOwner.toString("hex");
                resolve(
                  ephemeralOwner === this.zk.getSessionId().toString("hex")
                );
              }
            });
          }
        }),
      (e) =>
        new Error(`could not check if we are the owner of our own path: ${e}`)
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

                  console.log(
                    `Got node id ${currentNodeId} out of ${sortedChildren.length} nodes.`
                  );
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
    return this.subject.asObservable();
  }

  tryToRemoveEphemeralNode() {
    return TE.tryCatch(
      () =>
        new Promise<void>((resolve, reject) => {
          this.nodePath
            ? this.zk.remove(this.nodePath, (error) => {
                if (error) {
                  console.error(
                    `did not manage to remove node ${error}, ignoring...`
                  );
                  resolve();
                } else {
                  resolve();
                }
              })
            : resolve();
        }),
      (e) => new Error(`could not close zookeeper client: ${e}`)
    );
  }

  disconnectClient() {
    return TE.tryCatch(
      () =>
        new Promise<void>((resolve, reject) => {
          this.zk.once("disconnected", () => {
            resolve();
          });
          this.zk.close();
        }),
      (e) => new Error(`could not close zookeeper client: ${e}`)
    );
  }

  close(): TE.TaskEither<Error, void> {
    return pipe(
      this.tryToRemoveEphemeralNode(),
      TE.chainW(() => this.disconnectClient())
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
