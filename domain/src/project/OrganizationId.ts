import { taggedUnionClassCodec } from "@iots/index.js";
import * as Codec from "io-ts/lib/Codec.js";

export class OrganizationId {
  _tag = "OrganizationId" as const;
  _props;

  id;

  constructor(props: OrganizationIdProps) {
    this._props = props;
    this.id = props.id;
  }

  static propsCodec = Codec.struct({
    id: Codec.string,
  });

  static codec = taggedUnionClassCodec(
    this.propsCodec,
    "OrganizationId",
    OrganizationId
  );
}

export type OrganizationIdProps = Codec.TypeOf<
  typeof OrganizationId.propsCodec
>;
