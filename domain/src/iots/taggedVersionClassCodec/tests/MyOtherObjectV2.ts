import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import * as Codec from "io-ts/lib/Codec.js";

export class MyOtherObjectV2 {
  _tag = "MyOtherObject" as const;
  _version = 1 as const;
  _props;

  incompatibleProp;

  constructor(props: MyOtherObjectV1Prop2) {
    this._props = props;
    this.incompatibleProp = props.incompatibleProp;
  }

  static propsCodec = Codec.struct({
    incompatibleProp: Codec.string,
  });

  static codec = taggedVersionedClassCodec({
    propsCodec: this.propsCodec,
    typeConstructor: this,
  });
}

export type MyOtherObjectV1Prop2 = Codec.TypeOf<
  typeof MyOtherObjectV2.propsCodec
>;
