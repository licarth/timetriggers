import * as C from "io-ts/lib/Codec.js";
import { MyObject } from "./MyObject";
import { MyOtherObject } from "./MyOtherObject";

export namespace AnObject {
  export const codec = C.sum("_tag")({
    MyObject: MyObject.codec,
    MyOtherObject: MyOtherObject.codec,
  });
}

export type AnObject = C.TypeOf<typeof AnObject.codec>;
