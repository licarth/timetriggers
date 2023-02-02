import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { Headers } from "./Headers";
import { Body } from "./Body";

export class Options {
  method;
  headers;
  body;

  constructor(props: OptionsProps) {
    this.method = props.method;
    this.headers = props.headers;
    this.body = props.body;
  }

  static propsCodec = Codec.partial({
    method: Codec.string,
    headers: Headers.codec,
    body: Body.codec,
  });

  static codec = pipe(
    Options.propsCodec,
    Codec.compose(fromClassCodec(Options))
  );

  static factory = (props: Partial<OptionsProps> = {}) => {
    return new Options({
      method: props.method ?? "GET",
      headers: Headers.factory(),
    });
  };
}

export type OptionsProps = Codec.TypeOf<typeof Options.propsCodec>;
