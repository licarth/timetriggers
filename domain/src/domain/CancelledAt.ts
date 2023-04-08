import * as E from "fp-ts/lib/Either.js";
import * as C from "io-ts/lib/Codec.js";
import { anyOpaqueCodec, CodecType, e, UtcDate } from "..";

export namespace CancelledAt {
  export const codec = (codecType: CodecType) =>
    codecType === "firestore"
      ? anyOpaqueCodec(UtcDate.firestoreDateCodec, "CancelledAt")
      : anyOpaqueCodec(UtcDate.stringCodec, "CancelledAt");

  export const fromUTCString = (date: string): CancelledAt => {
    return e.unsafeGetOrThrow(codec("string").decode(date));
  };

  export const fromDate = (date: Date): CancelledAt => {
    return e.unsafeGetOrThrow(codec("string").decode(date.toISOString()));
  };
  export const factory = (date?: Date): CancelledAt => {
    return date ? fromDate(date) : fromDate(new Date());
  };

  export const parseISOString = (
    date: unknown
  ): E.Either<"Invalid Date", CancelledAt> => {
    if (typeof date !== "string") {
      return E.left("Invalid Date");
    }
    const d = new Date(date);
    return isNaN(d.getTime()) ? E.left("Invalid Date") : E.right(fromDate(d));
  };
}
export type CancelledAt = C.TypeOf<ReturnType<typeof CancelledAt.codec>>;
