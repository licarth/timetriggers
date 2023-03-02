import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { StatusCode } from "./StatusCode";
import { AxiosResponse } from "axios";

export class HttpCallResponse {
  statusCode;
  statusText;
  sizeInBytes;

  constructor(props: HttpCallResponseProps) {
    this.statusCode = props.statusCode;
    this.statusText = props.statusText;
    this.sizeInBytes = props.sizeInBytes;
  }

  static propsCodec = pipe(
    Codec.struct({
      statusCode: StatusCode.codec,
      statusText: Codec.string,
    }),
    Codec.intersect(
      Codec.partial({
        sizeInBytes: Codec.number,
      })
    )
  );

  static codec = pipe(
    HttpCallResponse.propsCodec,
    Codec.compose(fromClassCodec(HttpCallResponse))
  );

  static fromAxiosResponse = (response: AxiosResponse<any, any>) =>
    new HttpCallResponse({
      statusCode: StatusCode.fromInt(response.status),
      statusText: response.statusText,
      sizeInBytes: Number((response.data as ArrayBuffer).byteLength),
    });
}

export type HttpCallResponseProps = Codec.TypeOf<
  typeof HttpCallResponse.propsCodec
>;
