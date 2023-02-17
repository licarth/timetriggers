import * as Codec from "io-ts/lib/Codec.js";
import * as Decoder from "io-ts/lib/Decoder.js";
import { Proped } from "./Proped";

export const fromClassCodecNotExtends = <
  PropsType,
  ClassType extends Proped<PropsType>
>(
  typeConstructor: new (s: PropsType) => ClassType
): Codec.Codec<
  PropsType,
  PropsType & { _tag: string; _version: number },
  ClassType
> =>
  Codec.make(
    {
      decode: (props: PropsType) => Decoder.success(new typeConstructor(props)),
    },
    { encode: (i) => ({ ...i._props, _tag: i._tag, _version: i._version }) }
  );
