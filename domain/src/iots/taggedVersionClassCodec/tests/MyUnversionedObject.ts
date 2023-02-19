import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import * as Codec from "io-ts/lib/Codec.js";

export class MyUnversionedObject {
  _tag = "MyUnversionedObject" as const;
  _props;

  incompatibleProp;

  constructor(props: MyUnversionedObjectProps) {
    this._props = props;
    this.incompatibleProp = props.incompatibleProp;
  }

  static propsCodec = Codec.struct({
    incompatibleProp: Codec.string,
  });

  static codec = taggedVersionedClassCodec(this.propsCodec, this);
}

export type MyUnversionedObjectProps = Codec.TypeOf<
  typeof MyUnversionedObject.propsCodec
>;
