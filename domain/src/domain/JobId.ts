import { stringOpaqueCodec } from "@/iots";
import * as Codec from "io-ts/lib/Codec.js";

export namespace JobId {
  export const codec = stringOpaqueCodec("JobId");
  export const factory = (): JobId => {
    return `${randomString(16)}` as JobId;
  };
}

const randomString = (length: number = 16): string => {
  // Max length: 36
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = length; i > 0; --i) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

export type JobId = Codec.TypeOf<typeof JobId.codec>;
