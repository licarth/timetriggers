import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { ProjectOwner } from "./ProjectOwner";

export class Project {
  id;
  owner;

  constructor(props: ProjectProps) {
    this.id = props.id;
    this.owner = props.owner;
  }

  static propsCodec = Codec.struct({
    id: Codec.string,
    owner: ProjectOwner.codec,
  });

  static codec = pipe(
    Project.propsCodec,
    Codec.compose(fromClassCodec(Project))
  );
}

export type ProjectProps = Codec.TypeOf<typeof Project.propsCodec>;
