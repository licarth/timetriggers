import { taggedUnionClassCodec } from "@iots";
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
    return Buffer.from(this.raw, "utf8");
  }

  static propsCodec = Codec.struct({
    raw: Codec.string,
  });

  static codec = taggedUnionClassCodec(this.propsCodec, RawBody);
}

export type RawBodyProps = Codec.TypeOf<typeof RawBody.propsCodec>;
