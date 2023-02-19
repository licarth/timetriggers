import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import * as Codec from "io-ts/lib/Codec.js";

export class MyObjectV2 {
  _tag = "MyObject" as const;
  _version = 2 as const;
  _props;

  incompatibleProp;

  constructor(props: MyObjectV2Props) {
    this._props = props;
    this.incompatibleProp = props.incompatibleProp;
  }

  static propsCodec = Codec.struct({
    incompatibleProp: Codec.number,
  });

  static codec = taggedVersionedClassCodec(this.propsCodec, this);
}

export type MyObjectV2Props = Codec.TypeOf<typeof MyObjectV2.propsCodec>;
