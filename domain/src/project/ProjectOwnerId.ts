import * as C from "io-ts/lib/Codec.js";
import { FirebaseUserId } from "./FirebaseUserId";
import { OrganizationId } from "./OrganizationId";

export namespace ProjectOwnerId {
  export const codec = C.sum("_tag")({
    FirebaseUserId: FirebaseUserId.codec,
    OrganizationId: OrganizationId.codec,
  });
}

export type ProjectOwnerId = C.TypeOf<typeof ProjectOwnerId.codec>;
