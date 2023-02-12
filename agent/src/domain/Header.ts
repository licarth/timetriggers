import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { randomString } from "@/test/randomString";

export class Header {
  key;
  value;

  constructor(props: HeaderProps) {
    this.key = props.key;
    this.value = props.value;
  }

  static propsCodec = Codec.struct({
    key: Codec.string,
    value: Codec.string,
  });

  static codec = pipe(Header.propsCodec, Codec.compose(fromClassCodec(Header)));

  static factory = (props: Partial<HeaderProps> = {}) => {
    return new Header({
      key: props.key ?? `Some-Header-${randomString(5)}`,
      value: props.value ?? "Some-Value",
    });
  };
}

export type HeaderProps = Codec.TypeOf<typeof Header.propsCodec>;
