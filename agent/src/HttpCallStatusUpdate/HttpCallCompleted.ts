import { UtcDate } from "@timetriggers/domain";
import { taggedUnionClassCodec } from "@timetriggers/domain";
import * as Codec from "io-ts/lib/Codec.js";
import { HttpCallResponse } from "./HttpCallResponse";

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

  static propsCodec = Codec.struct({
    startedAt: UtcDate.stringCodec,
    completedAt: UtcDate.stringCodec,
    response: HttpCallResponse.codec,
  });

  static codec = taggedUnionClassCodec(this.propsCodec, HttpCallCompleted);
}

export type HttpCallCompletedProps = Codec.TypeOf<
  typeof HttpCallCompleted.propsCodec
>;
