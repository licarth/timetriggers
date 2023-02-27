import { taggedUnionClassCodec } from "@iots";
import * as Codec from "io-ts/lib/Codec.js";

export class FirebaseUserId {
  _tag = "FirebaseUserId" as const;
  _props;

  id;

  constructor(props: FirebaseUserIdProps) {
    this._props = props;
    this.id = props.id;
  }

  static propsCodec = Codec.struct({
    id: Codec.string,
  });

  static from(uid: string) {
    return new FirebaseUserId({ id: uid });
  }

  static codec = taggedUnionClassCodec(this.propsCodec, FirebaseUserId);
}

export type FirebaseUserIdProps = Codec.TypeOf<
  typeof FirebaseUserId.propsCodec
>;
