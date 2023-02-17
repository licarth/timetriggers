import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import * as Codec from "io-ts/lib/Codec.js";

export class MyObjectV1 {
  _tag = "MyObject" as const;
  _version = 1 as const;
  _props;

  incompatibleProp;

  constructor(props: MyObjectV1Props) {
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

export type MyObjectV1Props = Codec.TypeOf<typeof MyObjectV1.propsCodec>;
