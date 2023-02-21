import { ScheduledAt } from "./ScheduledAt";

describe("ScheduledAt", () => {
  it("should be encoded properly", () => {
    const aDate = new Date();
    expect(ScheduledAt.codec("string").encode(ScheduledAt.factory(aDate))).toBe(
      aDate.toISOString()
    );
  });
});
