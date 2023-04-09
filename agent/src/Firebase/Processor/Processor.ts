import { AxiosWorkerPool } from "@/AxiosWorkerPool";
import {
  ClusterNodeInformation,
  CoordinationClient,
} from "@/Coordination/CoordinationClient";
import { getOrReportToSentry } from "@/Sentry/getOrReportToSentry";
import { WorkerPool } from "@/WorkerPool";
import * as Sentry from "@sentry/node";
import "@sentry/tracing";
import {
  Clock,
  CompletedAt,
  HttpCallCompleted,
  HttpCallErrored,
  HttpCallLastStatus,
  HttpCallStarted,
  JobDocument,
  StartedAt,
  TestClock,
} from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import PQueue from "p-queue";
import { ClusterTopologyDatastoreAware } from "./ClusterTopologyAware";
import { Datastore } from "./Datastore";
import { InMemoryDataStore } from "./InMemoryDataStore";
import { unsubscribeAll } from "./unsubscribeAll";

type ProcessorProps = {
  clock?: Clock;
  workerPool: WorkerPool;
  datastore: Datastore;
  coordinationClient?: CoordinationClient;
};
export type UnsubsribeHook = () => void;

export class Processor extends ClusterTopologyDatastoreAware {
  workerPool;
  datastore;
  state: "not_started" | "running" | "closing" | "closed" = "not_started";
  closedHook = () => {};

  private queueUnsubscribeHooks: UnsubsribeHook[] = [];

  queue;

  private constructor(props: ProcessorProps) {
    super(props);
    this.queue = new PQueue({ concurrency: 300 });
    this.workerPool = props.workerPool;
    this.datastore = props.datastore;
  }

  onClusterTopologyChange(clusterTopology: ClusterNodeInformation) {
    console.log(`[Processor] reconfiguring cluster topology`);
    this.queue?.clear(); // TODO: do a diff of the shards we're listening to and the shards we're supposed to listen to, and only clear the ones that are no longer needed.
    this.queueUnsubscribeHooks && unsubscribeAll(this.queueUnsubscribeHooks);

    getOrReportToSentry(this.listenToQueue());
  }

  private listenToQueue() {
    return pipe(
      this.datastore.waitForNextJobsInQueue(this.shardsToListenTo),
      TE.map((jobDocuments) => {
        const s = jobDocuments.subscribe((jobDocuments) => {
          jobDocuments.forEach((jobDocument) => {
            this.queue.add(
              () => getOrReportToSentry(this.processJob(jobDocument)),
              { priority: -jobDocument.jobDefinition.scheduledAt.getTime() }
            );
          });
        });
        this.queueUnsubscribeHooks.push(() => s.unsubscribe());
      })
    );
  }

  static build = (props: ProcessorProps): TE.TaskEither<Error, Processor> =>
    pipe(
      TE.of(new Processor(props)),
      TE.map((processor) => {
        processor.state = "running";
        return processor;
      })
    );

  processJob({ jobDefinition, status }: JobDocument) {
    const jobId = jobDefinition.id;
    return pipe(
      TE.of({
        executionStartDate: this.clock.now(),
        jobDefinition,
        transaction: Sentry.startTransaction({
          op: "processJob",
          name: "Process Job",
          data: {
            jobId,
            url: jobDefinition.http?.url,
          },
        }),
      }),
      TE.apSW("worker", this.workerPool.nextWorker()),
      // TODO mark job as running
      TE.chainFirstEitherKW(() =>
        status.markAsRunning(StartedAt.fromDate(this.clock.now()))
      ),
      TE.chainFirstW(() => this.datastore.markJobAsRunning({ jobId, status })),
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
      TE.chainFirstEitherK(() =>
        status.markAsCompleted(CompletedAt.fromDate(this.clock.now()))
      ),
      TE.chainW(({ transaction, lastStatusUpdate }) => {
        transaction.finish();
        return this.datastore.markJobAsComplete({
          jobId,
          status,
          lastStatusUpdate,
        });
      })
    );
  }

  close() {
    let t: TE.TaskEither<Error, void>;
    this.state = "closing";
    this.coordinationClientSubscription?.unsubscribe();
    unsubscribeAll(this.queueUnsubscribeHooks);

    this.queue.clear(); // do not execute jobs in the queue
    t = TE.tryCatch(
      () => this.queue.onIdle(), // Wait for queue to be idle.
      (e) => new Error("Could not close processor")
    );

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
