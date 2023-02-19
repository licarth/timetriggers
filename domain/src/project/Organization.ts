import { taggedUnionClassCodec } from "@iots";
import * as Codec from "io-ts/lib/Codec.js";
import { OrganizationId } from "./OrganizationId";

export class Organization {
  _tag = "Organization" as const;
  _props;

  id;
  name;

  constructor(props: OrganizationProps) {
    this._props = props;
    this.id = props.id;
    this.name = props.name;
  }

  static propsCodec = Codec.struct({
    id: OrganizationId.codec,
    name: Codec.string,
  });

  static codec = taggedUnionClassCodec(this.propsCodec, Organization);
}

export type OrganizationProps = Codec.TypeOf<typeof Organization.propsCodec>;
