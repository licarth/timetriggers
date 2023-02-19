import { taggedUnionClassCodec } from "@iots";
import * as Codec from "io-ts/lib/Codec.js";

export class JsonBody {
  _tag = "JsonBody" as const;
  _props;

  raw;

  constructor(props: JsonBodyProps) {
    this._props = props;
    this.raw = props.raw;
  }

  toData() {
    return JSON.parse(this.raw);
  }

  static propsCodec = Codec.struct({
    raw: Codec.string,
  });

  static codec = taggedUnionClassCodec(this.propsCodec, JsonBody);
}

export type JsonBodyProps = Codec.TypeOf<typeof JsonBody.propsCodec>;
