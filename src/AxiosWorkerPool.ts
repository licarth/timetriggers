import _ from "lodash";
import { AxiosWorker } from "./AxiosWorker";
import { Clock } from "./Clock/Clock";
import { WorkerPool } from "./WorkerPool";
import genericPool from "generic-pool";
import * as TE from "fp-ts/lib/TaskEither";

type AxiosWorkerPoolProps = {
  minSize: number;
  maxSize: number;
  clock?: Clock;
};

/**
 * Local implementation of a worker pool
 */
export class AxiosWorkerPool implements WorkerPool {
  private _pool: genericPool.Pool<AxiosWorker>;

  constructor(props: AxiosWorkerPoolProps) {
    this._pool = genericPool.createPool(
      {
        create: async () =>
          new AxiosWorker({
            clock: props.clock,
            releaseFromPool: (axiosWorker: AxiosWorker) =>
              this.release(axiosWorker),
          }),
        destroy: async (worker: AxiosWorker) => worker.close(),
      },
      { min: props.minSize, max: props.maxSize }
    );
  }

  nextWorker() {
    return TE.tryCatch(
      () => this._pool.acquire(),
      (e) => new Error(`Failed to acquire axios worker`)
    );
  }

  release(worker: AxiosWorker) {
    return TE.tryCatch(
      () => this._pool.release(worker),
      (reason) => new Error(`Failed to release axios worker: ${reason}`)
    );
  }

  close(): TE.TaskEither<Error, void> {
    return TE.tryCatch(
      async () => {
        await this._pool.drain();
        await this._pool.clear();
      },
      (reason) => new Error(`Failed to close axios worker pool: ${reason}`)
    );
  }
}
