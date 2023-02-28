import * as C from "io-ts/lib/Codec.js";
import { anyOpaqueCodec, CodecType } from "@/iots";
import * as E from "fp-ts/lib/Either.js";
import { UtcDate } from "@/UtcDate";
import { e } from "@/fp-ts";

export namespace RateLimitedAt {
  export const codec = (codecType: CodecType) =>
    codecType === "firestore"
      ? anyOpaqueCodec(UtcDate.firestoreDateCodec, "RateLimitedAt")
      : anyOpaqueCodec(UtcDate.stringCodec, "RateLimitedAt");

  export const fromUTCString = (date: string): RateLimitedAt => {
    return e.unsafeGetOrThrow(codec("string").decode(date));
  };

  export const fromDate = (date: Date): RateLimitedAt => {
    return e.unsafeGetOrThrow(codec("string").decode(date.toISOString()));
  };
  export const factory = (date?: Date): RateLimitedAt => {
    return date ? fromDate(date) : fromDate(new Date());
  };

  export const parseISOString = (
    date: unknown
  ): E.Either<"Invalid Date", RateLimitedAt> => {
    if (typeof date !== "string") {
      return E.left("Invalid Date");
    }
    const d = new Date(date);
    return isNaN(d.getTime()) ? E.left("Invalid Date") : E.right(fromDate(d));
  };
}
export type RateLimitedAt = C.TypeOf<ReturnType<typeof RateLimitedAt.codec>>;
