import { AxiosWorkerPool } from "@/AxiosWorkerPool";
import { Clock } from "@/Clock/Clock";
import { SystemClock } from "@/Clock/SystemClock";
import { JobDefinition } from "@/domain/JobDefinition";
import { te } from "@/fp-ts";
import { HttpCallCompleted } from "@/HttpCallStatusUpdate/HttpCallCompleted";
import { HttpCallErrored } from "@/HttpCallStatusUpdate/HttpCallErrored";
import { HttpCallLastStatus } from "@/HttpCallStatusUpdate/HttpCallLastStatus";
import { HttpCallStarted } from "@/HttpCallStatusUpdate/HttpCallStarted";
import { WorkerPool } from "@/WorkerPool";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { Datastore } from "./Datastore";
import { InMemoryDataStore } from "./InMemoryDataStore";

type ProcessorProps = {
  clock?: Clock;
  workerPool: WorkerPool;
  datastore: Datastore;
};

export class Processor {
  clock;
  workerPool;
  datastore;
  isProcessing = false;
  state: "not_started" | "running" | "closing" | "closed" = "not_started";
  closedHook = () => {};

  constructor(props: ProcessorProps) {
    this.clock = props.clock || new SystemClock();
    this.workerPool = props.workerPool;
    this.datastore = props.datastore;
  }

  run() {
    this.state = "running";
    te.unsafeGetOrThrow(this.takeNextJob());
    return TE.of(this);
  }

  takeNextJob(): TE.TaskEither<Error, void> {
    return pipe(
      this.datastore.waitForNextJobsInQueue({ limit: 1 }),
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
                jobDefinition.map((job) => this.processJob(job)),
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
    // Wait for state to be closed.
    this.state = "closing";
    if (this.isProcessing) {
      const closeActionTe = TE.tryCatch(
        () =>
          new Promise<void>((resolve, reject) => {
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
