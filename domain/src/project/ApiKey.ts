import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { FirebaseUserId } from "./FirebaseUserId";

export class ApiKey {
  hash;
  last4Chars;
  createdBy;

  constructor(props: ApiKeyProps) {
    this.hash = props.hash;
    this.last4Chars = props.last4Chars;
    this.createdBy = props.createdBy;
  }

  static propsCodec = Codec.struct({
    hash: Codec.string,
    last4Chars: Codec.string,
    createdBy: FirebaseUserId.codec,
  });

  static codec = pipe(ApiKey.propsCodec, Codec.compose(fromClassCodec(ApiKey)));
}

export type ApiKeyProps = Codec.TypeOf<typeof ApiKey.propsCodec>;
