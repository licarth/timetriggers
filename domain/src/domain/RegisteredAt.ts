import * as C from "io-ts/lib/Codec.js";
import { anyOpaqueCodec, CodecType, e, UtcDate } from "../";
import * as E from "fp-ts/lib/Either.js";

export namespace RegisteredAt {
  export const codec = (codecType: CodecType) =>
    codecType === "firestore"
      ? anyOpaqueCodec(UtcDate.firestoreDateCodec, "RegisteredAt")
      : anyOpaqueCodec(UtcDate.stringCodec, "RegisteredAt");

  export const fromUTCString = (date: string): RegisteredAt => {
    return e.unsafeGetOrThrow(codec("string").decode(date));
  };

  export const fromDate = (date: Date): RegisteredAt => {
    return e.unsafeGetOrThrow(codec("string").decode(date.toISOString()));
  };
  export const factory = (date?: Date): RegisteredAt => {
    return date ? fromDate(date) : fromDate(new Date());
  };

  export const parseISOString = (
    date: unknown
  ): E.Either<"Invalid Date", RegisteredAt> => {
    if (typeof date !== "string") {
      return E.left("Invalid Date");
    }
    const d = new Date(date);
    return isNaN(d.getTime()) ? E.left("Invalid Date") : E.right(fromDate(d));
  };
}
export type RegisteredAt = C.TypeOf<ReturnType<typeof RegisteredAt.codec>>;
