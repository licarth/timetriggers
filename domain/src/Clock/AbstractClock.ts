import { Clock } from "./Clock";

export abstract class AbstractClock implements Clock {
  abstract tickMs(milliseconds: number): void;

  tickSeconds(seconds: number) {
    this.tickMs(seconds * 1000);
  }

  tickMinutes(minutes: number) {
    this.tickMs(minutes * 60 * 1000);
  }

  tickHours(hours: number) {
    this.tickMs(hours * 60 * 60 * 1000);
  }

  tickDays(days: number) {
    this.tickMs(days * 24 * 60 * 60 * 1000);
  }

  tickWeeks(weeks: number) {
    this.tickMs(weeks * 7 * 24 * 60 * 60 * 1000);
  }
}

export interface AbstractClock extends Clock {}
