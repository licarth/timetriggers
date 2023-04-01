import { stringOpaqueCodec } from "@/iots";
import * as Codec from "io-ts/lib/Codec.js";

export namespace CustomKey {
  export const codec = stringOpaqueCodec("CustomKey");
  export const factory = (): CustomKey => {
    return randomString(16) as CustomKey;
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

export type CustomKey = Codec.TypeOf<typeof CustomKey.codec>;
