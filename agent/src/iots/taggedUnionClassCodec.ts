import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import * as Encoder from "io-ts/lib/Encoder.js";
import { fromClassCodecNotExtends } from "./fromClassCodecNotExtends";
import { Proped } from "./Proped";

export const taggedUnionClassCodec = <
  PropsType,
  SerializedPropsType,
  ClassType extends Proped<PropsType>
>(
  propsCodec: Codec.Codec<unknown, SerializedPropsType, PropsType>,
  tag: string,
  typeConstructor: new (s: PropsType) => ClassType
): Codec.Codec<unknown, SerializedPropsType, ClassType> =>
  pipe(
    Codec.make(
      propsCodec,
      pipe(
        propsCodec,
        Encoder.compose({ encode: (i) => ({ ...i, _tag: tag }) })
      )
    ),
    Codec.compose(fromClassCodecNotExtends(typeConstructor))
  );
