import { fromClassCodec } from "@iots";
import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { Options } from "./Options";
import { Url } from "./Url";

export class Http {
  url;
  options;

  constructor(props: HttpProps) {
    this.url = props.url;
    this.options = props.options;
  }

  static propsCodec = pipe(
    Codec.struct({
      url: Url.codec,
    }),
    Codec.intersect(
      Codec.partial({
        options: Options.codec,
      })
    )
  );

  domain() {
    const url = new URL(this.url);
    return url.hostname;
  }

  tld() {
    const url = new URL(this.url);
    return url.hostname.split(".").slice(-2).join(".");
  }

  static codec = pipe(Http.propsCodec, Codec.compose(fromClassCodec(Http)));

  static factory = (props: Partial<HttpProps> = {}) =>
    new Http({
      url: props.url ?? Url.localhost(3000),
      options: props.options ?? Options.factory(),
    });
}

export type HttpProps = Codec.TypeOf<typeof Http.propsCodec>;
