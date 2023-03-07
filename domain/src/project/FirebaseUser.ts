import { taggedUnionClassCodec } from "@iots";
import { DecodedIdToken } from "firebase-admin/lib/auth/token-verifier";
import { pipe } from "fp-ts/lib/function";
import * as Codec from "io-ts/lib/Codec.js";
import { FirebaseUserId } from "./FirebaseUserId";

export class FirebaseUser {
  _tag = "FirebaseUser" as const;
  _props;

  id;
  email;

  constructor(props: FirebaseUserProps) {
    this._props = props;
    this.id = props.id;
    this.email = props.email;
  }

  static propsCodec = pipe(
    Codec.struct({
      id: FirebaseUserId.codec,
    }),
    Codec.intersect(
      Codec.partial({
        email: Codec.string,
      })
    )
  );

  isSuperAdmin() {
    return (
      !!this.email &&
      ["thomascarli@gmail.com", "thomas.carli@gmail.com"].includes(this.email)
    );
  }

  static fromDecodedIdToken = (idToken: DecodedIdToken) => {
    return new FirebaseUser({
      id: new FirebaseUserId({ id: idToken.uid }),
      email: idToken.email,
    });
  };

  static codec = taggedUnionClassCodec(this.propsCodec, FirebaseUser);
}

export type FirebaseUserProps = Codec.TypeOf<typeof FirebaseUser.propsCodec>;
