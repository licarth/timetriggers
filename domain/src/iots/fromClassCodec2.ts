import * as Codec from "io-ts/lib/Codec.js";
import * as Decoder from "io-ts/lib/Decoder.js";
import { Proped } from "./Proped";

export const fromClassCodec2 = <PropsType, ClassType extends Proped<PropsType>>(
  typeConstructor: new (s: PropsType) => ClassType
): Codec.Codec<PropsType, PropsType, ClassType> =>
  Codec.make(
    {
      decode: (props) => {
        const o = new typeConstructor(props);
        return Decoder.success(o);
      },
    },
    {
      encode: (i) => ({ ...i._props, _tag: i._tag, _version: i._version }),
    }
  );
