import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { StatusCode } from "./StatusCode";
import { AxiosResponse } from "axios";

export class HttpCallResponse {
  statusCode;
  statusText;

  constructor(props: HttpCallResponseProps) {
    this.statusCode = props.statusCode;
    this.statusText = props.statusText;
  }

  static propsCodec = Codec.struct({
    statusCode: StatusCode.codec,
    statusText: Codec.string,
  });

  static codec = pipe(
    HttpCallResponse.propsCodec,
    Codec.compose(fromClassCodec(HttpCallResponse))
  );

  static fromAxiosResponse = (response: AxiosResponse<any, any>) =>
    new HttpCallResponse({
      statusCode: StatusCode.fromInt(response.status),
      statusText: response.statusText,
    });
}

export type HttpCallResponseProps = Codec.TypeOf<
  typeof HttpCallResponse.propsCodec
>;
