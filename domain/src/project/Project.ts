import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { ProjectOwnerId } from "./ProjectOwnerId";
import { ApiKey } from "./ApiKey";

export class Project {
  id;
  ownerId;
  apiKeys;

  constructor(props: ProjectProps) {
    this.id = props.id;
    this.ownerId = props.ownerId;
    this.apiKeys = props.apiKeys;
  }

  static propsCodec = pipe(
    Codec.struct({
      id: Codec.string,
      ownerId: ProjectOwnerId.codec,
    }),
    Codec.intersect(
      Codec.partial({
        apiKeys: Codec.array(ApiKey.codec),
      })
    )
  );

  static codec = pipe(
    Project.propsCodec,
    Codec.compose(fromClassCodec(Project))
  );
}

export type ProjectProps = Codec.TypeOf<typeof Project.propsCodec>;
