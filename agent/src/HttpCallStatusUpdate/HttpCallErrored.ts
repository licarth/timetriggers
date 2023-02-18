import { UtcDate } from "@timetriggers/domain";
import { taggedUnionClassCodec } from "@timetriggers/domain";
import * as Codec from "io-ts/lib/Codec.js";

export class HttpCallErrored {
  _tag = "HttpCallErrored" as const;
  _props;

  startedAt;
  errorMessage;

  constructor(props: HttpCallErroredProps) {
    this._props = props;
    this.startedAt = props.startedAt;
    this.errorMessage = props.errorMessage;
  }

  static propsCodec = Codec.struct({
    startedAt: UtcDate.stringCodec,
    errorMessage: Codec.string,
  });

  static codec: Codec.Codec<unknown, { startedAt: string }, HttpCallErrored> =
    taggedUnionClassCodec(this.propsCodec, HttpCallErrored);
}

export type HttpCallErroredProps = Codec.TypeOf<
  typeof HttpCallErrored.propsCodec
>;
