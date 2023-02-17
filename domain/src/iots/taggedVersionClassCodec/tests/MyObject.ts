import * as C from "io-ts/lib/Codec.js";
import { MyObjectV1 } from "./MyObjectV1";
import { MyObjectV2 } from "./MyObjectV2";

export namespace MyObject {
  export const codec = C.sum("_version")({
    1: MyObjectV1.codec,
    2: MyObjectV2.codec,
  });
}

export type MyObject = C.TypeOf<typeof MyObject.codec>;
