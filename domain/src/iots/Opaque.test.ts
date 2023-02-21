import { CodecType } from "@/project";
import { UtcDate } from "@/UtcDate";
import { Timestamp } from "firebase-admin/firestore";
import * as E from "fp-ts/lib/Either.js";
import * as C from "io-ts/lib/Codec.js";
import { anyOpaqueCodec } from "./Opaque";

namespace SpecialDate {
  export const codec = (codecType: CodecType) =>
    codecType === "firestore"
      ? anyOpaqueCodec(UtcDate.firestoreDateCodec, "SpecialDate")
      : anyOpaqueCodec(UtcDate.stringCodec, "SpecialDate");
}
type SpecialDate = C.TypeOf<ReturnType<typeof SpecialDate.codec>>;

describe("Date", () => {
  it("firestore codec decode", () => {
    const date = new Date("2021-01-01T00:00:00.000Z");
    expect(
      SpecialDate.codec("firestore").decode(Timestamp.fromDate(date))
    ).toEqual(E.right(date));
  });
  it("firestore codec encode", () => {
    const date = new Date("2021-01-01T00:00:00.000Z");
    expect(SpecialDate.codec("firestore").encode(date as SpecialDate)).toEqual(
      Timestamp.fromDate(date)
    );
  });
  it("string codec decode", () => {
    const date = new Date("2021-01-01T00:00:00.000Z");
    expect(SpecialDate.codec("string").decode(date.toISOString())).toEqual(
      E.right(date)
    );
  });
  it("string codec encode", () => {
    const date = new Date("2021-01-01T00:00:00.000Z");
    expect(SpecialDate.codec("string").encode(date as SpecialDate)).toEqual(
      date.toISOString()
    );
  });
});
