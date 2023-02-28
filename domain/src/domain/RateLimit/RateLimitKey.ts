import { stringOpaqueCodec } from "@/iots";
import * as E from "fp-ts/lib/Either.js";
import * as Codec from "io-ts/lib/Codec.js";

export namespace RateLimitKey {
  export const codec = stringOpaqueCodec("RateLimitKey");

  export const factory = (): RateLimitKey => {
    return "rate-limiting-key" as RateLimitKey;
  };

  export const parse = (s: string) => {
    return E.of(s as RateLimitKey);
  };
}

export type RateLimitKey = Codec.TypeOf<typeof RateLimitKey.codec>;
