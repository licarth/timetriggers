import { stringOpaqueCodec } from "@/iots";
import * as Codec from "io-ts/lib/Codec.js";

export namespace JobId {
  export const codec = stringOpaqueCodec("JobId");
  export const factory = (): JobId => {
    return `job-${randomString(16)}` as JobId;
  };
}

const randomString = (length: number): string => {
  return Math.random().toString(36).substr(2, length);
};

export type JobId = Codec.TypeOf<typeof JobId.codec>;
