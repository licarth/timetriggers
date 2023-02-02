import * as C from "io-ts/lib/Codec.js";
import { GraphQLBody } from "./GraphQLBody";
import { JsonBody } from "./JsonBody";
import { RawBody } from "./RawBody";

export namespace Body {
  export const codec = C.sum("_tag")({
    JsonBody: JsonBody.codec,
    GraphQLBody: GraphQLBody.codec,
    RawBody: RawBody.codec,
  });
}

export type Body = C.TypeOf<typeof Body.codec>;
