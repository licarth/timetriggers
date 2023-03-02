import { taggedUnionClassCodec } from "@/iots";
import * as Codec from "io-ts/lib/Codec.js";
import { HttpCallResponse } from "./HttpCallResponse";
import { UtcDate } from "@/UtcDate";
import { pipe } from "fp-ts/lib/function";

export class HttpCallCompleted {
  _tag = "HttpCallCompleted" as const;
  _props;

  startedAt;
  completedAt;
  response;

  constructor(props: HttpCallCompletedProps) {
    this._props = props;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.response = props.response;
  }

  static propsCodec = pipe(
    Codec.struct({
      startedAt: UtcDate.stringCodec,
      completedAt: UtcDate.stringCodec,
      response: HttpCallResponse.codec,
    }),
    Codec.intersect(Codec.partial({}))
  );

  static codec = taggedUnionClassCodec(this.propsCodec, HttpCallCompleted);
}

export type HttpCallCompletedProps = Codec.TypeOf<
  typeof HttpCallCompleted.propsCodec
>;
