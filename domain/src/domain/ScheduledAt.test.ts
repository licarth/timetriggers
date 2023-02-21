import { ScheduledAt } from "./ScheduledAt";

describe("ScheduledAt", () => {
  it("should be encoded properly", () => {
    expect(ScheduledAt.codec("string").encode(ScheduledAt.factory())).toBe({
      date: expect.any(String),
    });
  });
});
