import { Api } from "./Api";
import { Clock } from "@timetriggers/domain";
import { SystemClock } from "@timetriggers/domain";
import { AxiosWorkerPool } from "./AxiosWorkerPool";

export type AbstractApiProps = {
  clock?: Clock;
};

/**
 * Main interface for scheduling a callback.
 */
export abstract class AbstractApi implements Api {
  protected clock;
  workerPool = new AxiosWorkerPool({
    minSize: 1,
    maxSize: 2,
  });

  constructor({ clock }: AbstractApiProps) {
    if (clock) {
      this.clock = clock;
    } else {
      this.clock = new SystemClock();
    }
  }
}

export interface AbstractApi extends Api {}
