import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import * as Encoder from "io-ts/lib/Encoder.js";
import { Proped } from "../Proped";
import { fromClassCodecNotExtends } from "../fromClassCodecNotExtends";

export const taggedVersionedClassCodec = <
  PropsType,
  SerializedPropsType,
  ClassType extends Proped<PropsType>
>({
  propsCodec,
  typeConstructor,
}: {
  propsCodec: Codec.Codec<unknown, SerializedPropsType, PropsType>;
  typeConstructor: new (s: PropsType) => ClassType;
}): Codec.Codec<
  unknown,
  SerializedPropsType & { _tag: string; _version?: number },
  ClassType
> => {
  const propsCodecWithTagAndMaybeVersion = pipe(
    propsCodec,
    Codec.intersect(
      Codec.struct({
        _tag: Codec.string,
      })
    ),
    Codec.intersect(
      Codec.partial({
        _version: Codec.number,
      })
    )
  );

  return pipe(
    Codec.make(
      propsCodecWithTagAndMaybeVersion,
      pipe(
        propsCodecWithTagAndMaybeVersion, // props encoder => SerializedPropsType
        Encoder.compose({
          encode: (i) => ({ ...i, _tag: i._tag, _version: i._version }),
        })
      )
    ),
    Codec.compose(fromClassCodecNotExtends(typeConstructor))
  );
};
