import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import * as Codec from "io-ts/lib/Codec.js";

export class MonthlyUsageV1 {
  _tag = "MonthlyUsage" as const;
  _version = 1 as const;
  _props;

  incompatibleProp;

  constructor(props: MonthlyUsageV1Props) {
    this._props = props;
    this.incompatibleProp = props.incompatibleProp;
  }

  static propsCodec = Codec.struct({
    incompatibleProp: Codec.string,
  });

  static codec = taggedVersionedClassCodec({
    propsCodec: this.propsCodec,
    typeConstructor: MonthlyUsageV1,
  });
}

export type MonthlyUsageV1Props = Codec.TypeOf<
  typeof MonthlyUsageV1.propsCodec
>;
