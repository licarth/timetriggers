import { stringOpaqueCodec } from "@/iots";
import { randomString } from "@/test/randomString";
import * as Codec from "io-ts/lib/Codec.js";

export namespace FirebaseUserId {
  export const codec = stringOpaqueCodec("FirebaseUserId");
  export const factory = (): FirebaseUserId => {
    return `uid-${randomString(8)}` as FirebaseUserId;
  };
}

export type FirebaseUserId = Codec.TypeOf<typeof FirebaseUserId.codec>;
