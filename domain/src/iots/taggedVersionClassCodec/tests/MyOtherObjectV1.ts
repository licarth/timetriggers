import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import * as Codec from "io-ts/lib/Codec.js";

export class MyOtherObjectV1 {
  _tag = "MyOtherObject" as const;
  _version = 1 as const;
  _props;

  anotherProp;

  constructor(props: MyObjectV1Props) {
    this._props = props;
    this.anotherProp = props.anotherProp;
  }

  static propsCodec = Codec.struct({
    anotherProp: Codec.array(Codec.string),
  });

  static codec = taggedVersionedClassCodec({
    propsCodec: this.propsCodec,
    typeConstructor: this,
  });
}

export type MyObjectV1Props = Codec.TypeOf<typeof MyOtherObjectV1.propsCodec>;
