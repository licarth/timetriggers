import type { DecodeError } from "io-ts/lib/Decoder";
import * as E from "fp-ts/lib/Either.js";
import * as K from "io-ts/lib/Kleisli.js";

// See https://github.com/gcanti/io-ts/issues/644
declare module "io-ts/lib/Decoder.js" {
  export interface Decoder<I, A> extends K.Kleisli<E.URI, I, DecodeError, A> {
    decode: (i: I) => E.Either<DecodeError, A>;
  }
}
