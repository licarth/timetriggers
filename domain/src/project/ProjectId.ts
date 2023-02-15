import { stringOpaqueCodec } from "@/iots";
import * as E from "fp-ts/lib/Either.js";
import * as Codec from "io-ts/lib/Codec.js";
import _ from "lodash";
import { validate } from "uuid";
import { uuid } from "uuidv4";
import * as D from "io-ts/lib/Decoder.js";
import { pipe } from "fp-ts/lib/function";

export namespace ProjectId {
  const c = stringOpaqueCodec("ProjectId");

  export const codec = pipe(
    c,
    Codec.compose(
      Codec.fromDecoder({
        decode: (s: Codec.TypeOf<typeof c>) =>
          validate(s) ? D.success(s) : D.failure(s, "a valid uuid"),
      })
    )
  );
  export const factory = (): ProjectId => {
    return uuid() as ProjectId;
  };

  export const parse = (s: string) => {
    if (!validate(s)) {
      return E.left("projectId is not a valid uuid v4");
    }
    return E.of(s as ProjectId);
  };
}

export type ProjectId = Codec.TypeOf<typeof ProjectId.codec>;
