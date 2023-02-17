import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import * as Codec from "io-ts/lib/Codec.js";

export class MonthlyUsageV2 {
  _tag = "MonthlyUsage" as const;
  _version = 1 as const;
  _props;

  incompatibleProp;

  constructor(props: MonthlyUsageV2Props) {
    this._props = props;
    this.incompatibleProp = props.incompatibleProp;
  }

  static propsCodec = Codec.struct({
    incompatibleProp: Codec.number,
  });

  static codec = taggedVersionedClassCodec({
    propsCodec: this.propsCodec,
    typeConstructor: MonthlyUsageV2,
  });
}

export type MonthlyUsageV2Props = Codec.TypeOf<
  typeof MonthlyUsageV2.propsCodec
>;
