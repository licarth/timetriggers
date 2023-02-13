import * as C from "io-ts/lib/Codec.js";
import { FirebaseUser } from "./FirebaseUser";
import { Organization } from "./Organization";

export namespace ProjectOwner {
  export const codec = C.sum("_tag")({
    FirebaseUser: FirebaseUser.codec,
    Organization: Organization.codec,
  });
}

export type ProjectOwner = C.TypeOf<typeof ProjectOwner.codec>;
