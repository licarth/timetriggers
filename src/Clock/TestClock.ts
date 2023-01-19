import _ from "lodash";
import { AbstractClock } from "./AbstractClock";

export class TestClock extends AbstractClock {
  private _now: Date = new Date();
  private _timeouts: {
    [key: number]: {
      executeAtTs: number;
      cb: () => void;
    };
  } = {};

  constructor(now?: Date) {
    super();
    if (now) {
      this._now = now;
    }
  }

  tickMs(milliseconds: number) {
    const newTs = this._now.getTime() + milliseconds;
    this._now = new Date(newTs);
    // Execute timeouts in between
    _.map(this._timeouts, ({ cb, executeAtTs }, key) => {
      if (executeAtTs <= newTs) {
        cb();
        delete this._timeouts[Number(key)];
      }
    });
  }

  now(): Date {
    return this._now;
  }

  setTimeout(cb: () => void, milliseconds: number): NodeJS.Timeout {
    const id = randomInt32();
    if (milliseconds <= 0) {
      cb();
    } else {
      this._timeouts[id] = {
        executeAtTs: this._now.getTime() + milliseconds,
        cb,
      };
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
