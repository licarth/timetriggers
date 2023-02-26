import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots";

export class StatusCode {
  codeInt;

  constructor(props: StatusCodeProps) {
    this.codeInt = props.codeInt;
  }

  static propsCodec = Codec.struct({
    codeInt: Codec.number,
  });

  static codec = pipe(
    StatusCode.propsCodec,
    Codec.compose(fromClassCodec(StatusCode))
  );

  static fromInt(codeInt: number): StatusCode {
    return new StatusCode({ codeInt });
  }
}

export type StatusCodeProps = Codec.TypeOf<typeof StatusCode.propsCodec>;
