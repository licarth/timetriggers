import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import * as Codec from "io-ts/lib/Codec.js";

export class MyUnversionedObjectV1 {
  _tag = "MyUnversionedObject" as const;
  _version = 1 as const;
  _props;

  incompatibleProp;

  constructor(props: MyUnversionedObjectVersionedProps) {
    this._props = props;
    this.incompatibleProp = props.incompatibleProp;
  }

  static propsCodec = Codec.struct({
    incompatibleProp: Codec.string,
  });

  static codec = taggedVersionedClassCodec(this.propsCodec, this);
}

export type MyUnversionedObjectVersionedProps = Codec.TypeOf<
  typeof MyUnversionedObjectV1.propsCodec
>;
