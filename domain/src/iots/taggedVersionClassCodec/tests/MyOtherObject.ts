import * as C from "io-ts/lib/Codec.js";
import { MyOtherObjectV1 } from "./MyOtherObjectV1";
import { MyOtherObjectV2 } from "./MyOtherObjectV2";

export namespace MyOtherObject {
  export const codec = C.sum("_version")({
    1: MyOtherObjectV1.codec,
    2: MyOtherObjectV2.codec,
  });
}

export type MyObject = C.TypeOf<typeof MyOtherObject.codec>;
