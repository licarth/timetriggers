import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { Header } from "./Header";

export class Headers {
  headersArray;

  constructor(props: HeadersProps) {
    this.headersArray = props.headersArray;
  }

  toObject() {
    return this.headersArray.reduce((acc, header) => {
      acc[header.key] = header.value;
      return acc;
    }, {} as Record<string, string>);
  }

  static propsCodec = Codec.struct({
    headersArray: Codec.array(Header.codec),
  });

  static codec = pipe(
    Headers.propsCodec,
    Codec.compose(fromClassCodec(Headers))
  );

  static factory = (props: Partial<HeadersProps> = {}) => {
    return new Headers({
      headersArray: props.headersArray ?? [],
    });
  };
}

export type HeadersProps = Codec.TypeOf<typeof Headers.propsCodec>;
