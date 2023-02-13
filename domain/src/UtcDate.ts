import { pipe } from "fp-ts/lib/function.js";
import * as C from "io-ts/lib/Codec.js";
import * as D from "io-ts/lib/Decoder.js";
import { Timestamp } from "firebase/firestore";

export namespace UtcDate {
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
      encode: (i: Date) => i,
    }
  );
}

const isFirebaseTimesamp = function (i: unknown): i is Timestamp {
  return (
    i instanceof Timestamp ||
    (i !== null &&
      typeof i === "object" &&
      i.hasOwnProperty("_seconds") &&
      i.hasOwnProperty("_nanoseconds")) ||
    false
  );
};
