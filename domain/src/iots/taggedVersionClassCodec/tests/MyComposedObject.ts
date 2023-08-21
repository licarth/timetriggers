import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import * as Codec from "io-ts/lib/Codec.js";
import { MyObject } from "./MyObject";

export class MyComposedObject {
  _tag = "MyComposedObject" as const;
  _version = 2 as const;
  _props;

  constructor(props: MyComposedObjectProps) {
    this._props = props;
  }

  static propsCodec = Codec.struct({
    myObject: MyObject.codec,
  });

  static codec = taggedVersionedClassCodec(this.propsCodec, this);
}

export type MyComposedObjectProps = Codec.TypeOf<
  typeof MyComposedObject.propsCodec
>;
