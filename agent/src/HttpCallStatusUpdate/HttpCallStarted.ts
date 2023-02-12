import { UtcDate } from "@/domain/UtcDate";
import { taggedUnionClassCodec } from "@/iots";
import * as Codec from "io-ts/lib/Codec.js";

export class HttpCallStarted {
  _tag = "HttpCallStarted" as const;
  _props;

  startedAt;

  constructor(props: HttpCallStartedProps) {
    this._props = props;
    this.startedAt = props.startedAt;
  }

  static propsCodec = Codec.struct({
    startedAt: UtcDate.stringCodec,
  });

  static codec: Codec.Codec<unknown, { startedAt: string }, HttpCallStarted> =
    taggedUnionClassCodec(this.propsCodec, "HttpCallStarted", HttpCallStarted);
}

export type HttpCallStartedProps = Codec.TypeOf<
  typeof HttpCallStarted.propsCodec
>;
