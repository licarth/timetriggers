import { TestClock } from "@/Clock";
import { evaluate } from "./DateFunctions";

describe("DateFunctions", () => {
  describe("evaluate", () => {
    const refDateString = "2021-01-01T14:00:00.000Z";
    const refDateStringPlus1h = "2021-01-01T15:00:00.000Z";
    const clock = new TestClock(new Date(refDateString));
    it("should evaluate ISO date", () => {
      expect(evaluate(refDateString)({ clock })).toEqual(
        new Date(refDateString)
      );
    });
    it("should evaluate ISO date plus 1 hour", () => {
      expect(evaluate(`${refDateString} | add 1h`)({ clock })).toEqual(
        new Date("2021-01-01T15:00:00.000Z")
      );
    });
    it("should evaluate ISO date minus 1 hour", () => {
      expect(evaluate(`${refDateString} | add -1h`)({ clock })).toEqual(
        new Date("2021-01-01T13:00:00.000Z")
      );
    });
    it("should evaluate ISO date in TZ minus 1 hour", () => {
      expect(evaluate(`2021-01-01T14:00:00.000Z | add +1h`)({ clock })).toEqual(
        new Date("2021-01-01T16:00:00.000+0100")
      );
    });
    it('should evaluate "now" minus 10 hour', () => {
      expect(evaluate("now | add -10h")({ clock })).toEqual(
        new Date("2021-01-01T04:00:00.000Z")
      );
    });
    it('should evaluate "now" minus 1 hour with TZ change', () => {
      expect(evaluate("now | add -10h")({ clock })).toEqual(
        new Date("2021-01-01T05:00:00.000+0100")
      );
    });
    it("should resist to spaces btw. amount and unit", () => {
      expect(evaluate(`${refDateString}|add 1 h`)({ clock })).toEqual(
        new Date(refDateStringPlus1h)
      );
    });
    it("should resist to spaces between sign and amount", () => {
      expect(evaluate(`${refDateString}   |  add  + 1h`)({ clock })).toEqual(
        new Date(refDateStringPlus1h)
      );
    });
    it("should work with months", () => {
      expect(
        evaluate(`${refDateString}   |  add  +1 month`)({ clock })
      ).toEqual(new Date("2021-02-01T14:00:00.000Z"));
    });
    it("should work with years", () => {
      expect(evaluate(`${refDateString}   |  add  -1 year`)({ clock })).toEqual(
        new Date("2020-01-01T14:00:00.000Z")
      );
    });
  });
});
