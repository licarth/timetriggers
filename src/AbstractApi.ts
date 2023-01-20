import { Api } from "./Api";
import { Clock } from "./Clock/Clock";
import { SystemClock } from "./Clock/SystemClock";

export type AbstractApiProps = {
  clock?: Clock;
};

/**
 * Main interface for scheduling a callback.
 */
export abstract class AbstractApi implements Api {
  protected clock;

  constructor({ clock }: AbstractApiProps) {
    if (clock) {
      this.clock = clock;
    } else {
      this.clock = new SystemClock();
    }
  }
}

export interface AbstractApi extends Api {}
