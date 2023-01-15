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
});
