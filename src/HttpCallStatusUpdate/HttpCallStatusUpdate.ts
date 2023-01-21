import { HttpCallCompleted } from "./HttpCallCompleted";
import { HttpCallStarted } from "./HttpCallStarted";
import * as C from "io-ts/lib/Codec.js";
import { HttpCallErrored } from "./HttpCallErrored";

export namespace HttpCallStatusUpdate {
  export const codec = C.sum("_tag")({
    HttpCallStarted: HttpCallStarted.codec,
    HttpCallCompleted: HttpCallCompleted.codec,
    HttpCallErrored: HttpCallErrored.codec,
  });
}

export type HttpCallStatusUpdate = C.TypeOf<typeof HttpCallStatusUpdate.codec>;
