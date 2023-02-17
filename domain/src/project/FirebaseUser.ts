import { taggedUnionClassCodec } from "@iots/index.js";
import { DecodedIdToken } from "firebase-admin/lib/auth/token-verifier";
import * as Codec from "io-ts/lib/Codec.js";
import { FirebaseUserId } from "./FirebaseUserId";

export class FirebaseUser {
  _tag = "FirebaseUser" as const;
  _props;

  id;

  constructor(props: FirebaseUserProps) {
    this._props = props;
    this.id = props.id;
  }

  static propsCodec = Codec.struct({
    id: FirebaseUserId.codec,
  });

  static fromDecodedIdToken = (idToken: DecodedIdToken) => {
    return new FirebaseUser({
      id: new FirebaseUserId({ id: idToken.uid }),
    });
  };

  static codec = taggedUnionClassCodec(this.propsCodec, FirebaseUser);
}

export type FirebaseUserProps = Codec.TypeOf<typeof FirebaseUser.propsCodec>;
