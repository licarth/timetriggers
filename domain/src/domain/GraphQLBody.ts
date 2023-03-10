import { taggedUnionClassCodec } from "@iots";
import * as Codec from "io-ts/lib/Codec.js";

export class GraphQLBody {
  _tag = "GraphQLBody" as const;
  _props;
  raw;

  constructor(props: GraphQLBodyProps) {
    this._props = props;
    this.raw = props.raw;
  }

  toData() {
    return this.raw;
  }

  static propsCodec = Codec.struct({
    raw: Codec.string,
  });

  static codec = taggedUnionClassCodec(this.propsCodec, GraphQLBody);
}

export type GraphQLBodyProps = Codec.TypeOf<typeof GraphQLBody.propsCodec>;
