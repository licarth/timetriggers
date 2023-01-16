import { TestClock } from "./TestClock";

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
});
