import { findExecutionTimesBetween, TestClock } from "./TestClock";

describe("TestClock", () => {
  it("should tick 1s properly", () => {
    const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
    clock.tickSeconds(1);
    expect(clock.now()).toEqual(new Date("2020-01-01T00:00:01.000Z"));
  });
  it("should tick 1 week properly", () => {
    const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
    clock.tickWeeks(1);
    expect(clock.now()).toEqual(new Date("2020-01-08T00:00:00.000Z"));
  });

  it("should execute timeouts properly", () => {
    const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
    const callback = jest.fn();
    clock.setTimeout(callback, 1000);
    clock.tickSeconds(1);
    expect(callback).toHaveBeenCalled();
  });

  it("should execute timeouts properly", () => {
    const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
    const callback = jest.fn();
    clock.setTimeout(callback, 1010);
    clock.tickSeconds(1);
    expect(callback).toHaveBeenCalledTimes(0);
  });

  it("should execute 2 timeouts with same date properly", () => {
    const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    clock.setTimeout(callback1, 900);
    clock.setTimeout(callback2, 900);
    clock.tickSeconds(1);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it("should execute timeouts only once", () => {
    const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
    const callback = jest.fn();
    clock.setTimeout(callback, 500);
    clock.tickSeconds(1);
    clock.tickSeconds(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should execute when waiting exactly", () => {
    const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
    const callback = jest.fn();
    clock.setTimeout(callback, 700);
    clock.tickMs(700);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should execute timeouts in the right order if they fall in the same tick() call", () => {
    const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
    const callbacksOrder = [] as number[];
    const callback1 = () => {
      callbacksOrder.push(1);
    };
    const callback2 = () => {
      callbacksOrder.push(2);
    };
    clock.setTimeout(callback2, 502);
    clock.setTimeout(callback1, 500);
    clock.tickSeconds(1);
    expect(callbacksOrder).toEqual([1, 2]);
  });

  describe("setInterval", () => {
    it("should execute callback", () => {
      const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
      const callback = jest.fn();
      clock.setInterval(callback, 700);
      clock.tickSeconds(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should execute when waiting exactly", () => {
      const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
      const callback = jest.fn();
      clock.setInterval(callback, 700);
      clock.tickMs(700);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should execute callback when it already started in the past", () => {
      const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
      const callback = jest.fn();
      clock.setInterval(callback, 700);
      clock.tickMs(699);
      clock.tickMs(2);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should execute callback multiple times", () => {
      const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
      const callback = jest.fn();
      clock.setInterval(callback, 100);
      clock.tickMs(50);
      clock.tickSeconds(1);
      expect(callback).toHaveBeenCalledTimes(10);
    });
    it("should not execute callback if cleared", () => {
      const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
      const callback = jest.fn();
      const id = clock.setInterval(callback, 100);
      console.log(+id);
      clock.clearInterval(id);
      clock.tickMs(200);
      expect(callback).toHaveBeenCalledTimes(0);
    });
    it("should order properly setInterval and setTimeout", () => {
      const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
      const callbacksOrder = [] as number[];
      const callback1 = () => {
        callbacksOrder.push(1);
      };
      const callback2 = () => {
        callbacksOrder.push(2);
      };
      const callback3 = () => {
        callbacksOrder.push(3);
      };
      clock.setTimeout(callback2, 5);
      clock.setTimeout(callback3, 10);
      clock.tickMs(2);
      expect(callbacksOrder).toEqual([]);
      clock.setInterval(callback1, 2);
      clock.tickMs(10);
      // 1 2 | 3 4 5 6 7 8 9 10 11 12 |
      // - - | - - 2 - - - - 3  -  -  |
      // - - | 1 - 1 - 1 - - 1  -  1  |
      expect(callbacksOrder).toEqual([1, 2, 1, 1, 3, 1, 1]);
    });
  });
});
describe("findExecutionTimesBetween", () => {
  it("should return [] if firstOcccurence is after range", () => {
    expect(
      findExecutionTimesBetween({ firstOccurence: 5, interval: 10 }, 0, 4)
    ).toEqual([]);
  });
  it("ex 1", () => {
    expect(
      findExecutionTimesBetween({ firstOccurence: 1, interval: 10 }, 0, 10)
    ).toEqual([1]);
  });
  it("should exclude the end value", () => {
    expect(
      findExecutionTimesBetween({ firstOccurence: 1, interval: 1 }, 0, 10)
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  // it("should include the beginning value", () => {
  //   expect(
  //     findExecutionTimesBetween({ firstOccurence: 5, interval: 1000 }, 0, 10)
  //   ).toEqual([]);
  // });
});
