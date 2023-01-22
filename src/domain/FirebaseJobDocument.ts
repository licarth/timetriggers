import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { JobDefinition } from "./JobDefinition";

export class FirebaseJobDocument {
  jobDefinition;
  shards;

  constructor(props: FirebaseJobDocumentProps) {
    this.jobDefinition = props.jobDefinition;
    this.shards = props.shards;
  }

  static propsCodec = Codec.struct({
    jobDefinition: JobDefinition.firestoreCodec,
    shards: Codec.array(Codec.string),
  });

  static codec = pipe(
    FirebaseJobDocument.propsCodec,
    Codec.compose(fromClassCodec(FirebaseJobDocument))
  );
}

export type FirebaseJobDocumentProps = Codec.TypeOf<
  typeof FirebaseJobDocument.propsCodec
>;
