import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { FirebaseUserId } from "./FirebaseUserId";
import bcrypt from "bcryptjs";
import { randomString } from "@/test/randomString";
import { UtcDate } from "@/UtcDate";
import { CodecType } from "./CodecType";

const SALT_ROUNDS = 10;

export class ApiKey {
  hash;
  last4Chars;
  createdBy;
  createdAt;

  constructor(props: ApiKeyProps) {
    this.hash = props.hash;
    this.last4Chars = props.last4Chars;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
  }

  static propsCodec = (type?: CodecType) =>
    Codec.struct({
      hash: Codec.string,
      last4Chars: Codec.string,
      createdBy: FirebaseUserId.codec,
      createdAt:
        type === "firestore" ? UtcDate.firestoreDateCodec : UtcDate.stringCodec,
    });

  static codec = (codecType?: CodecType) =>
    pipe(this.propsCodec(codecType), Codec.compose(fromClassCodec(ApiKey)));

  static generate = async (user: FirebaseUserId) => {
    const rawKey = randomString(32);
    return {
      rawKey,
      apiKey: new ApiKey({
        hash: await bcrypt.hash(rawKey, SALT_ROUNDS),
        createdBy: user,
        createdAt: new Date(),
        last4Chars: rawKey.slice(-4),
      }),
    };
  };
}

export type ApiKeyProps = Codec.TypeOf<ReturnType<typeof ApiKey.propsCodec>>;
