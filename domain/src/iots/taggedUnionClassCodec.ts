import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import * as Encoder from "io-ts/lib/Encoder.js";
import { fromClassCodec } from "@iots";
import { Proped } from "./Proped";
import { fromClassCodecNotExtends } from "./fromClassCodecNotExtends";

export const taggedUnionClassCodec = <
  PropsType,
  SerializedPropsType,
  ClassType extends Proped<PropsType>
>(
  propsCodec: Codec.Codec<unknown, SerializedPropsType, PropsType>,
  typeConstructor: new (s: PropsType) => ClassType
): Codec.Codec<unknown, SerializedPropsType, ClassType> => {
  const propsCodecWithTag = pipe(
    propsCodec,
    Codec.intersect(
      Codec.struct({
        _tag: Codec.string,
      })
    )
  );
  return pipe(
    Codec.make(
      propsCodecWithTag,
      pipe(
        propsCodecWithTag,
        Encoder.compose({ encode: (i) => ({ ...i, _tag: i._tag }) })
      )
    ),
    Codec.compose(fromClassCodecNotExtends(typeConstructor))
  );
};
