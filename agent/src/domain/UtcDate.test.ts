import { UtcDate } from "./UtcDate";

describe("UtcDate", () => {
  it("should encode a date properly", () => {
    expect(
      UtcDate.stringCodec.encode(new Date("2021-01-01T00:00:00.000Z"))
    ).toBe("2021-01-01T00:00:00.000Z");
    expect(UtcDate.stringCodec.encode(new Date("2021-01-01"))).toBe(
      "2021-01-01T00:00:00.000Z"
    );
  });

  it("should decode a date properly", () => {
    expect(UtcDate.stringCodec.decode("2021-11-01T00:00:00.000Z")).toEqual({
      _tag: "Right",
      right: new Date("2021-11-01T00:00:00.000Z"),
    });
  });
});
