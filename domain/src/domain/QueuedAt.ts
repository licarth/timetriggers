import * as C from "io-ts/lib/Codec.js";
import { anyOpaqueCodec, CodecType, e, UtcDate } from "../";
import * as E from "fp-ts/lib/Either.js";

export namespace QueuedAt {
  export const codec = (codecType: CodecType) =>
    codecType === "firestore"
      ? anyOpaqueCodec(UtcDate.firestoreDateCodec, "QueuedAt")
      : anyOpaqueCodec(UtcDate.stringCodec, "QueuedAt");

  export const fromUTCString = (date: string): QueuedAt => {
    return e.unsafeGetOrThrow(codec("string").decode(date));
  };

  export const fromDate = (date: Date): QueuedAt => {
    return e.unsafeGetOrThrow(codec("string").decode(date.toISOString()));
  };
  export const factory = (date?: Date): QueuedAt => {
    return date ? fromDate(date) : fromDate(new Date());
  };

  export const parseISOString = (
    date: unknown
  ): E.Either<"Invalid Date", QueuedAt> => {
    if (typeof date !== "string") {
      return E.left("Invalid Date");
    }
    const d = new Date(date);
    return isNaN(d.getTime()) ? E.left("Invalid Date") : E.right(fromDate(d));
  };
}
export type QueuedAt = C.TypeOf<ReturnType<typeof QueuedAt.codec>>;
