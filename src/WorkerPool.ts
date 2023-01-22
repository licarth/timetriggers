import { Worker } from "./Worker";
import * as TE from "fp-ts/lib/TaskEither";

/**
 * An actor executes a job when it's time to do so.
 *
 */
export interface WorkerPool {
  /**
   * Returns the next available worker.
   * If no worker is available, it blocks until one is available.
   * */
  nextWorker(): TE.TaskEither<Error, Worker>;

  close(): TE.TaskEither<Error, void>;
}

// Zips an Observable of queued tasks with an Observable of workers
