import { stringOpaqueCodec } from "@/iots";
import * as E from "fp-ts/lib/Either.js";
import * as Codec from "io-ts/lib/Codec.js";
import { v4 } from "uuid";

export namespace ProjectSlug {
  export const codec = stringOpaqueCodec("ProjectSlug");
  export const factory = (): ProjectSlug => {
    return v4() as ProjectSlug;
  };

  export const parse = (s: string) => {
    return E.of(s as ProjectSlug);
  };
}

export type ProjectSlug = Codec.TypeOf<typeof ProjectSlug.codec>;
