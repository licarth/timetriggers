import * as D from "io-ts/lib/Decoder.js";

export interface EntityWithDecoder<T> {
  codec: D.Decoder<unknown, T>;
}
