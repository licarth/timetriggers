import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import * as Encoder from "io-ts/lib/Encoder.js";
import { fromClassCodec } from "@iots/index.js";

export const taggedUnionClassCodec = <S, T extends S>(
  propsCodec: Codec.Codec<unknown, S, S>,
  tag: string,
  type: new (s: S) => T
): Codec.Codec<unknown, S, T> =>
  pipe(
    Codec.make(
      propsCodec,
      pipe(
        propsCodec,
        Encoder.compose({ encode: (i) => ({ ...i, _tag: tag }) })
      )
    ),
    Codec.compose(fromClassCodec(type))
  );
