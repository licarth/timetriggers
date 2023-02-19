import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots";
import { FirebaseUserId } from "./FirebaseUserId";
import { randomString } from "@/test/randomString";
import { UtcDate } from "@/UtcDate";
import { CodecType } from "./CodecType";

export class ApiKey {
  value;
  createdBy;
  createdAt;

  constructor(props: ApiKeyProps) {
    this.value = props.value;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
  }

  static propsCodec = (type?: CodecType) =>
    Codec.struct({
      value: Codec.string,
      createdBy: FirebaseUserId.codec,
      createdAt:
        type === "firestore" ? UtcDate.firestoreDateCodec : UtcDate.stringCodec,
    });

  static codec = (codecType?: CodecType) =>
    pipe(this.propsCodec(codecType), Codec.compose(fromClassCodec(ApiKey)));

  static generate = async (user: FirebaseUserId) => {
    const value = randomString(32);
    return new ApiKey({
      value,
      createdBy: user,
      createdAt: new Date(),
    });
  };
}

export type ApiKeyProps = Codec.TypeOf<ReturnType<typeof ApiKey.propsCodec>>;
