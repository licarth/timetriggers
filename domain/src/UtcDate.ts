import { pipe } from "fp-ts/lib/function.js";
import * as C from "io-ts/lib/Codec.js";
import * as D from "io-ts/lib/Decoder.js";
import { Timestamp } from "firebase-admin/firestore";
import { CodecType } from "./project";

export namespace UtcDate {
  export const codec = (codecType: CodecType) =>
    codecType == "string" ? stringCodec : firestoreDateCodec;

  export const fromDate = (d: Date) => d as UtcDate;

  export const stringCodec = C.make(
    pipe(
      C.string,
      D.compose({
        decode: (i: string) => D.success(new Date(i)),
      })
    ),
    {
      encode: (i: Date) => i.toISOString(),
    }
  );

  export const firestoreDateCodec = C.make(
    {
      decode: (i: unknown) => {
        if (!isFirebaseTimesamp(i)) {
          return D.failure(i, " firebase timestamp");
        }
        return D.success(i.toDate());
      },
    },
    {
      encode: (d: Date) => d,
    }
  );
}

export type UtcDate = C.TypeOf<ReturnType<typeof UtcDate.codec>>;

const isFirebaseTimesamp = function (i: unknown): i is Timestamp {
  return (
    (i !== null &&
      typeof i === "object" &&
      i.hasOwnProperty("_seconds") &&
      i.hasOwnProperty("_nanoseconds")) ||
    (i !== null &&
      typeof i === "object" &&
      i.hasOwnProperty("seconds") &&
      i.hasOwnProperty("nanoseconds"))
  );
};
