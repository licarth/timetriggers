import { pipe } from "fp-ts/lib/function";
import * as C from "io-ts/lib/Codec";
import * as D from "io-ts/lib/Decoder";
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

  export const firebaseDateCodec = C.make(
    {
      decode: (i: unknown) => {
        if (!isFirebaseTimesamp(i)) {
          return D.failure(i, "is not a firebase timestamp");
        }
        return D.success((i as Timestamp).toDate());
      },
    },
    {
      encode: (i: Date) => i,
    }
  );
}

const isFirebaseTimesamp = (i: unknown): i is Timestamp =>
  i instanceof Timestamp;
