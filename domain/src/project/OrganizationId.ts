import { stringOpaqueCodec } from "@/iots";
import * as Codec from "io-ts/lib/Codec.js";

export namespace OrganizationId {
  export const codec = stringOpaqueCodec("OrganizationId");
  export const factory = (): OrganizationId => {
    return `org-${randomString(8)}` as OrganizationId;
  };
}

const randomString = (length: number): string => {
  return Math.random().toString(36).substr(2, length);
};

export type OrganizationId = Codec.TypeOf<typeof OrganizationId.codec>;
