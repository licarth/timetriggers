import { AxiosWorkerPool } from "@/AxiosWorkerPool";
import { Clock } from "@/Clock/Clock";
import { SystemClock } from "@/Clock/SystemClock";
import {
  getShardsToListenTo,
  getShardsToListenToObject,
} from "@/ConsistentHashing/ConsistentHashing";
import { CoordinationClient } from "@/Coordination/CoordinationClient";
import { JobDefinition } from "@/domain/JobDefinition";
import { Shard } from "@/domain/Shard";
import { externallyResolvablePromise } from "@/externallyResolvablePromise";
import { te } from "@/fp-ts";
import { HttpCallCompleted } from "@/HttpCallStatusUpdate/HttpCallCompleted";
import { HttpCallErrored } from "@/HttpCallStatusUpdate/HttpCallErrored";
import { HttpCallLastStatus } from "@/HttpCallStatusUpdate/HttpCallLastStatus";
import { HttpCallStarted } from "@/HttpCallStatusUpdate/HttpCallStarted";
import { WorkerPool } from "@/WorkerPool";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { Datastore } from "./Datastore";
import { InMemoryDataStore, ShardsToListenTo } from "./InMemoryDataStore";

type ProcessorProps = {
  clock?: Clock;
  workerPool: WorkerPool;
  datastore: Datastore;
  coordinationClient?: CoordinationClient;
};

export class Processor {
  clock;
  workerPool;
  datastore;
  isProcessing = false;
  state: "not_started" | "running" | "closing" | "closed" = "not_started";
  closedHook = () => {};

  coordinationClient;
  coordinationClientSubscription;
  clusterTopologyIsReadyPromise;
  shardsToListenTo?: ShardsToListenTo | "all"; // "all" means listen to all shards

  constructor(props: ProcessorProps) {
    this.clock = props.clock || new SystemClock();
    this.workerPool = props.workerPool;
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
          resolve();
        });
    } else {
      resolve();
    }
  }

  run() {
    this.state = "running";

    this.coordinationClient
      ? console.log(
          `Starting processor, listening to ${
            this.shardsToListenTo === "all"
              ? "all shards"
              : `shards ${this.shardsToListenTo?.nodeIds.join(", ")}`
          }.`
        )
      : console.log(`Starting processor, listening... (no shards)`);

    // We should wait until shardsToListenTo is set
    te.unsafeGetOrThrow(
      pipe(
        // Run coordination client if it exists
        () => this.clusterTopologyIsReadyPromise,
        TE.fromTask,
        TE.chain(() => this.takeNextJob())
      )
    );
    return TE.of(this);
  }

  takeNextJob(): TE.TaskEither<Error, void> {
    const shards = this.coordinationClient
      ? this.shardsToListenTo === "all"
        ? undefined
        : this.shardsToListenTo
      : undefined;
    return pipe(
      this.datastore.waitForNextJobsInQueue({ limit: 1 }, shards),
      TE.chain((jobs) => {
        if (this.state === "closing") {
          this.state = "closed";
          this.closedHook();
          return TE.of(undefined);
        } else {
          this.isProcessing = true;
          return pipe(
            TE.of(jobs),
            TE.chainFirstTaskK((jobDefinition) =>
              pipe(
                jobDefinition.map((job) => this.processJob(job)), // We could stop processing if we changed Shards
                te.executeAllInArray({ parallelism: 1 })
              )
            )
          );
        }
      }),
      TE.chain(() => {
        this.isProcessing = false;
        if (this.state === "closing") {
          this.state = "closed";

          this.closedHook();
          return TE.of(undefined);
        } else {
          return this.takeNextJob();
        }
      })
    );
  }

  processJob(jobDefinition: JobDefinition) {
    console.log(`processing job ${jobDefinition.id}...`);
    return pipe(
      TE.of({ executionStartDate: this.clock.now(), jobDefinition }),
      TE.bindW("worker", () => this.workerPool.nextWorker()),
      TE.bindW(
        "lastStatusUpdate",
        // send job to worker (local or remote) and listen to result stream.
        ({ worker, jobDefinition }) =>
          TE.tryCatch(
            () =>
              new Promise<HttpCallLastStatus>((resolve, reject) =>
                worker.execute(jobDefinition).subscribe((next) => {
                  if (next instanceof HttpCallStarted) {
                    // Report Call started
                  } else if (next instanceof HttpCallCompleted) {
                    resolve(next);
                  } else if (next instanceof HttpCallErrored) {
                    resolve(next);
                  }
                })
              ),
            (e) => new Error("Could not execute job")
          )
      ),
      TE.map(({ lastStatusUpdate, executionStartDate }) => ({
        lastStatusUpdate,
        durationMs: this.clock.now().getTime() - executionStartDate.getTime(),
        executionStartDate,
      })),
      TE.chainW((args) =>
        this.datastore.markJobAsComplete({ jobDefinition, ...args })
      )
    );
  }

  close = () => {
    this.state = "closing";
    this.coordinationClientSubscription?.unsubscribe();
    if (this.isProcessing) {
      // Wait for current job to finish
      const closeActionTe = TE.tryCatch(
        () =>
          new Promise<void>((resolve) => {
            this.closedHook = () => resolve();
          }),
        (e) => new Error("Could not close processor")
      );

      return closeActionTe;
    } else {
      this.state = "closed";
      return TE.of(undefined);
    }
  };

  static factory = (props: Partial<ProcessorProps> = {}) =>
    new Processor({
      clock: props.clock || new SystemClock(),
      workerPool:
        props.workerPool ||
        new AxiosWorkerPool({
          clock: props.clock || new SystemClock(),
          minSize: 1,
          maxSize: 2,
        }),
      datastore: props.datastore || InMemoryDataStore.factory(),
    });
}
