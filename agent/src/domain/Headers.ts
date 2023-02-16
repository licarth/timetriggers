import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { Header } from "./Header";
import _ from "lodash";
import { toLowerCase } from "fp-ts/lib/string.js";
import { key } from "io-ts/lib/DecodeError";

export class Headers {
  headersArray;

  constructor(props: HeadersProps) {
    this.headersArray = props.headersArray;
  }

  toBeSent() {
    // TODO handle multiple headers with the same key
    // TODO remove host header
    return this.headersArray
      .filter((h) => toLowerCase(h.key) !== "host")
      .reduce((acc, header) => {
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

  static fromExpress = (expressHeaders: NodeJS.Dict<string | string[]>) => {
    return new Headers({
      headersArray: _.compact(
        Object.entries(expressHeaders)
          .filter(([key]) => !toLowerCase(key).startsWith("x-timetriggers-"))
          .map(([key, value]) => {
            return (
              value &&
              new Header({
                key,
                value: Array.isArray(value) ? value.join(",") : value,
              })
            );
          })
      ),
    });
  };
}

export type HeadersProps = Codec.TypeOf<typeof Headers.propsCodec>;
