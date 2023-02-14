import { stringOpaqueCodec } from "@/iots";
import { randomString } from "@/test/randomString";
import * as Codec from "io-ts/lib/Codec.js";
import * as E from "fp-ts/lib/Either.js";

export namespace ProjectId {
  export const codec = stringOpaqueCodec("ProjectId");
  export const factory = (): ProjectId => {
    return `project-${randomString(8)}` as ProjectId;
  };

  export const parse = (s: string) => {
    return E.of(s as ProjectId);
  };
}

export type ProjectId = Codec.TypeOf<typeof ProjectId.codec>;
