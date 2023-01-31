import _ from "lodash";
import { AbstractClock } from "./AbstractClock";

export class TestClock extends AbstractClock {
  private _now: Date = new Date("2020-01-01T00:00:00.000Z");
  private _timeouts: {
    [key: number]: {
      executeAtTs: number;
      cb: () => void;
    }[];
  } = {};

  private _intervals: {
    [key: number]: {
      firstOccurence: number;
      interval: number;
      cb: () => void;
    };
  } = {};

  constructor(now?: Date) {
    super();
    if (now) {
      this._now = now;
    }
  }

  static factory() {
    return new TestClock();
  }

  tickMs(milliseconds: number) {
    const oldTs = this._now.getTime();
    const newTs = oldTs + milliseconds;
    this._now = new Date(newTs);

    const thingsToExecute = {} as {
      [key: number]: (() => void)[];
    };

    // Execute timeouts in between
    _.map(
      _.sortBy(_.keys(this._timeouts), (k) => Number(k)),
      (key) => {
        const executeAtTs = Number(key);
        if (executeAtTs <= newTs) {
          for (const timeout of this._timeouts[executeAtTs]) {
            if (thingsToExecute[executeAtTs]) {
              thingsToExecute[executeAtTs].push(() => {
                timeout.cb();
              });
            } else {
              thingsToExecute[executeAtTs] = [timeout.cb];
            }
          }
          delete this._timeouts[executeAtTs];
        }
      }
    );

    // find intervals that need to be executed
    _.map(this._intervals, (interval) => {
      if (interval.firstOccurence <= newTs) {
        const execTimes = findExecutionTimesBetween(interval, oldTs, newTs + 1);
        for (const execTime of execTimes) {
          if (thingsToExecute[execTime]) {
            thingsToExecute[execTime].push(interval.cb);
          } else {
            thingsToExecute[execTime] = [interval.cb];
          }
        }
      }
    });

    // execute things
    _.map(
      _.sortBy(_.keys(thingsToExecute), (k) => Number(k)),
      (key) => {
        for (const cb of thingsToExecute[Number(key)]) {
          cb();
        }
      }
    );
  }

  now(): Date {
    return this._now;
  }

  setTimeout(cb: () => void, milliseconds: number): NodeJS.Timeout {
    const id = Math.max(this.now().getTime() + milliseconds);
    if (milliseconds <= 0) {
      cb();
    } else {
      const o = {
        executeAtTs: this._now.getTime() + milliseconds,
        cb,
      };
      if (this._timeouts[id]) {
        this._timeouts[id].push(o);
      } else {
        this._timeouts[id] = [o];
      }
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

  setInterval(callback: () => void, milliseconds: number): NodeJS.Timeout {
    const id = randomInt32();

    this._intervals[id] = {
      firstOccurence: this._now.getTime() + milliseconds,
      interval: milliseconds,
      cb: callback,
    };

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

  clearInterval(intervalId: NodeJS.Timeout): void {
    delete this._intervals[+intervalId];
  }
}

const randomInt32 = () => {
  return Math.floor(Math.random() * 2 ** 32);
};

export const findExecutionTimesBetween = (
  { firstOccurence, interval }: { firstOccurence: number; interval: number },
  start: number,
  end: number
) => {
  if (firstOccurence > end) {
    return [];
  }
  const timesItFit = Math.ceil((start - firstOccurence) / interval);
  const firstOccurenceInWindowTs =
    firstOccurence + Math.max(timesItFit, 0) * interval;
  const numberOfOccurrences = Math.ceil(
    (end - firstOccurenceInWindowTs) / interval
  );

  return _.times(numberOfOccurrences, (i) => {
    return firstOccurenceInWindowTs + i * interval;
  });
};
