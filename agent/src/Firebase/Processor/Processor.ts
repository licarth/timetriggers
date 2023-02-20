import { AxiosWorkerPool } from "@/AxiosWorkerPool";
import { Clock } from "@timetriggers/domain";
import { TestClock } from "@timetriggers/domain";
import {
  ClusterNodeInformation,
  CoordinationClient,
} from "@/Coordination/CoordinationClient";
import { JobDefinition } from "@timetriggers/domain";
import { te } from "@/fp-ts";
import { HttpCallCompleted } from "@/HttpCallStatusUpdate/HttpCallCompleted";
import { HttpCallErrored } from "@/HttpCallStatusUpdate/HttpCallErrored";
import { HttpCallLastStatus } from "@/HttpCallStatusUpdate/HttpCallLastStatus";
import { HttpCallStarted } from "@/HttpCallStatusUpdate/HttpCallStarted";
import { getOrReportToSentry } from "@/Sentry/getOrReportToSentry";
import { WorkerPool } from "@/WorkerPool";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import * as T from "fp-ts/lib/Task.js";
import { ClusterTopologyDatastoreAware } from "./ClusterTopologyAware";
import { Datastore } from "./Datastore";
import { InMemoryDataStore } from "./InMemoryDataStore";
import * as Sentry from "@sentry/node";
import "@sentry/tracing";

type ProcessorProps = {
  clock?: Clock;
  workerPool: WorkerPool;
  datastore: Datastore;
  coordinationClient?: CoordinationClient;
};

export class Processor extends ClusterTopologyDatastoreAware {
  workerPool;
  datastore;
  isProcessing = false;
  state: "not_started" | "running" | "closing" | "closed" = "not_started";
  closedHook = () => {};

  unsubscribeNextJob: () => void = () => {};

  firstTopologyChange: boolean;

  private constructor(props: ProcessorProps) {
    super(props);
    this.workerPool = props.workerPool;
    this.datastore = props.datastore;
    this.firstTopologyChange = true;
  }

  onClusterTopologyChange(clusterTopology: ClusterNodeInformation) {
    console.log(`[Processor] reconfiguring cluster topology`);
    if (this.firstTopologyChange) {
      console.log(`[Processor] first topology change, not unsubscribing...`);
      this.firstTopologyChange = false;
    } else {
    }
    this.unsubscribeNextJob && this.unsubscribeNextJob();
    getOrReportToSentry(this.takeNextJob());
  }

  static build = (props: ProcessorProps): TE.TaskEither<Error, Processor> =>
    pipe(
      TE.of(new Processor(props)),
      TE.map((processor) => {
        processor.state = "running";
        return processor;
      })
    );

  takeNextJob(): TE.TaskEither<Error, void> {
    console.log(`[Processor] waiting for next job in queue...`);
    // this.unsubscribeNextJob = unsubscribe;
    const self = this;
    return pipe(
      this.datastore.waitForNextJobsInQueue(
        { limit: 50 },
        this.shardsToListenTo
      ),
      TE.chainW(function (o) {
        return TE.tryCatch(
          () =>
            new Promise<JobDefinition[]>((resolve, reject) => {
              const subscription = o.subscribe(
                (jobs) => {
                  resolve(jobs);
                },
                (err) => reject(err)
              );
              self.unsubscribeNextJob = () => subscription.unsubscribe();
            }),
          (e) => new Error("Could not take next job")
        );
      }),
      TE.chain((jobs) => {
        console.log(`[Processor] got ${jobs.length} jobs...`);
        if (this.state === "closing") {
          this.state = "closed";
          this.closedHook();
          return TE.of(undefined);
        } else {
          this.isProcessing = true;
          return pipe(
            TE.of(jobs),
            TE.chainFirstW((jobDefinition) =>
              pipe(
                jobDefinition.map((job) => this.processJob(job)), // We could stop processing if we changed Shards
                // What should we do if it fails ?
                // We should not continue processing, only retry the job. And then fail.
                // We should rather execute them sequentially and fail at the first one
                (s) => s,
                // failAtFirst,
                // TE.mapLeft((e) => {
                //   console.log(e);
                //   return e;
                // })
                te.executeAllInArray({ parallelism: 100 }),
                (x) => x,
                T.map(({ successes, errors }) => {
                  console.log(`[Processor] ${successes.length} jobs processed`);
                  console.log(`[Processor] ${errors.length} jobs errored`);
                  return void 0;
                }),
                TE.fromTask
                // te.executeAllInArray({ parallelism: 1 }),
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
    return pipe(
      TE.of({
        executionStartDate: this.clock.now(),
        jobDefinition,
        transaction: Sentry.startTransaction({
          op: "processJob",
          name: "Process Job",
          data: {
            jobId: jobDefinition.id,
            url: jobDefinition.http?.url,
          },
        }),
      }),
      TE.bindW("worker", () => this.workerPool.nextWorker()),
      TE.chainFirstW(() => this.datastore.markJobAsRunning(jobDefinition)),
      TE.bindW(
        "lastStatusUpdate",
        // send job to worker (local or remote) and listen to result stream.
        ({ worker, jobDefinition }) =>
          TE.tryCatch(
            () =>
              new Promise<HttpCallLastStatus>(function (resolve, reject) {
                return worker.execute(jobDefinition).subscribe((next) => {
                  if (next instanceof HttpCallStarted) {
                    // Report Call started
                  } else if (next instanceof HttpCallCompleted) {
                    resolve(next);
                  } else if (next instanceof HttpCallErrored) {
                    resolve(next);
                  }
                });
              }),
            (e) => new Error("Could not execute job")
          )
      ),
      TE.map(({ lastStatusUpdate, executionStartDate, transaction }) => ({
        transaction,
        lastStatusUpdate,
        durationMs: this.clock.now().getTime() - executionStartDate.getTime(),
        executionStartDate,
      })),
      TE.chainW((args) => {
        args.transaction.setMeasurement("durationMs", 10, "millisecond");
        args.transaction.finish();
        return this.datastore.markJobAsComplete({ jobDefinition, ...args });
      })
    );
  }

  close() {
    let t: TE.TaskEither<Error, void>;
    this.state = "closing";
    this.coordinationClientSubscription?.unsubscribe();
    this.unsubscribeNextJob();

    if (this.isProcessing) {
      // Wait for current job to finish
      t = TE.tryCatch(
        () =>
          new Promise<void>((resolve) => {
            this.closedHook = () => resolve();
          }),
        (e) => new Error("Could not close processor")
      );
    } else {
      this.state = "closed";
      t = TE.of(undefined);
    }

    return pipe(
      super.close(),
      TE.chainW(() => t)
    );
  }

  static factory = (
    props: Partial<ProcessorProps> & { clock: Clock } = {
      clock: new TestClock(),
    }
  ) => {
    const clock = props.clock;
    return Processor.build({
      clock,
      workerPool:
        props.workerPool ||
        new AxiosWorkerPool({
          clock,
          minSize: 1,
          maxSize: 2,
        }),
      datastore: props.datastore || InMemoryDataStore.factory({ clock }),
    });
  };
}

const failAtFirst = <T>(s: TE.TaskEither<Error, T>[]) =>
  s.reduce(
    (acc, next) =>
      pipe(
        acc,
        TE.chain(() => next)
      ),
    TE.of(undefined as T)
  );
