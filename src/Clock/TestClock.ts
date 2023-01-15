import { Clock } from "./Clock";

export class TestClock implements Clock {
  private _now: Date = new Date();
  private _timeouts: { [key: number]: () => void } = {};

  constructor(now?: Date) {
    if (now) {
      this._now = now;
    }
  }

  tickMs(milliseconds: number) {
    const newTs = this._now.getTime() + milliseconds;
    this._now = new Date(newTs);
    // Execute timeouts in between
    Object.keys(this._timeouts)
      .map((key) => parseInt(key))
      .filter((key) => key <= newTs)
      .forEach((key) => {
        this._timeouts[key]();
        delete this._timeouts[key];
      });
  }

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

  now(): Date {
    return this._now;
  }

  setTimeout(callback: () => void, milliseconds: number): NodeJS.Timeout {
    const id = this._now.getTime() + milliseconds;
    if (milliseconds <= 0) {
      callback();
    } else {
      this._timeouts[id] = callback;
    }

    return {
      ref: () => {},
      unref: () => {},
      refresh: () => {},
      hasRef: () => {
        return true;
      },
      [Symbol.toPrimitive]() {
        return id;
      },
    } as NodeJS.Timeout;
  }

  clearTimeout(timeoutId: NodeJS.Timeout): void {
    delete this._timeouts[+timeoutId];
  }
}

const randomInt32 = () => {
  return Math.floor(Math.random() * 2 ** 32);
};
