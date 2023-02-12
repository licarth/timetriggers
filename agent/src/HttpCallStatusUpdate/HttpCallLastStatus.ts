import * as C from "io-ts/lib/Codec.js";
import { HttpCallCompleted } from "./HttpCallCompleted";
import { HttpCallErrored } from "./HttpCallErrored";

export namespace HttpCallLastStatus {
  export const codec = C.sum("_tag")({
    HttpCallCompleted: HttpCallCompleted.codec,
    HttpCallErrored: HttpCallErrored.codec,
  });
}

export type HttpCallLastStatus = C.TypeOf<typeof HttpCallLastStatus.codec>;
