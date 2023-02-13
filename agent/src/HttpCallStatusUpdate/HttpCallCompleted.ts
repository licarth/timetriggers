import { UtcDate } from "@timetriggers/domain";
import { taggedUnionClassCodec } from "@/iots";
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

  static codec: Codec.Codec<unknown, { startedAt: string }, HttpCallCompleted> =
    taggedUnionClassCodec(
      this.propsCodec,
      "HttpCallCompleted",
      HttpCallCompleted
    );
}

export type HttpCallCompletedProps = Codec.TypeOf<
  typeof HttpCallCompleted.propsCodec
>;
