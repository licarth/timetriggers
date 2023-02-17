import * as Codec from "io-ts/lib/Codec.js";
import * as Decoder from "io-ts/lib/Decoder.js";
import { Proped } from "./Proped";

export const fromClassCodecNotExtends = <
  PropsType,
  ClassType extends Proped<PropsType>
>(
  typeConstructor: new (s: PropsType) => ClassType
): Codec.Codec<
  PropsType & { _tag: string; _version?: number },
  PropsType & { _tag: string; _version?: number },
  ClassType
> =>
  Codec.make(
    {
      decode: (props) => {
        const o = new typeConstructor(props);
        if (o._version && o._version !== props._version) {
          return Decoder.failure(
            props,
            `Version mismatch: expected ${o._version}, got ${props._version}`
          );
        }
        return Decoder.success(o);
      },
    },
    {
      encode: (i) => ({ ...i._props, _tag: i._tag, _version: i._version }),
    }
  );
