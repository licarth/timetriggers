import { taggedUnionClassCodec } from "@iots/index.js";
import * as Codec from "io-ts/lib/Codec.js";

export class RawBody {
  _tag = "RawBody" as const;
  _props;

  raw;

  constructor(props: RawBodyProps) {
    this._props = props;
    this.raw = props.raw;
  }

  toData() {
    return this.raw;
  }

  static propsCodec = Codec.struct({
    raw: Codec.string,
  });

  static codec = taggedUnionClassCodec(this.propsCodec, "RawBody", RawBody);
}

export type RawBodyProps = Codec.TypeOf<typeof RawBody.propsCodec>;
