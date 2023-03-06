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
    if (!validate(s)) {
      return E.left(new Error("Invalid project slug"));
    } else {
      return E.of(s);
    }
  };

  export const validate = (s: string): s is ProjectSlug => {
    const regexp = /^[a-z0-9-_]+$/;
    return s.length > 4 && s.length <= 30 && regexp.test(s);
  };
}

export type ProjectSlug = Codec.TypeOf<typeof ProjectSlug.codec>;
