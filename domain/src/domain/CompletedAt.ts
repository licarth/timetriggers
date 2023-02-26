import * as C from "io-ts/lib/Codec.js";
import { anyOpaqueCodec, CodecType, e, UtcDate } from "..";
import * as E from "fp-ts/lib/Either.js";

export namespace CompletedAt {
  export const codec = (codecType: CodecType) =>
    codecType === "firestore"
      ? anyOpaqueCodec(UtcDate.firestoreDateCodec, "CompletedAt")
      : anyOpaqueCodec(UtcDate.stringCodec, "CompletedAt");

  export const fromUTCString = (date: string): CompletedAt => {
    return e.unsafeGetOrThrow(codec("string").decode(date));
  };

  export const fromDate = (date: Date): CompletedAt => {
    return e.unsafeGetOrThrow(codec("string").decode(date.toISOString()));
  };
  export const factory = (date?: Date): CompletedAt => {
    return date ? fromDate(date) : fromDate(new Date());
  };

  export const parseISOString = (
    date: unknown
  ): E.Either<"Invalid Date", CompletedAt> => {
    if (typeof date !== "string") {
      return E.left("Invalid Date");
    }
    const d = new Date(date);
    return isNaN(d.getTime()) ? E.left("Invalid Date") : E.right(fromDate(d));
  };
}
export type CompletedAt = C.TypeOf<ReturnType<typeof CompletedAt.codec>>;
