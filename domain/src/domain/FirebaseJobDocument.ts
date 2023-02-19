import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots";
import { JobDefinition } from "./JobDefinition";
import { RegisteredAt } from "./RegisteredAt";

export class FirestoreJobDocument {
  jobDefinition;
  shards;
  registeredAt;

  constructor(props: FirebaseJobDocumentProps) {
    this.jobDefinition = props.jobDefinition;
    this.shards = props.shards;
    this.registeredAt = props.registeredAt;
  }

  static propsCodec = pipe(
    Codec.struct({
      jobDefinition: JobDefinition.firestoreCodec,
    }),
    Codec.intersect(
      Codec.partial({
        shards: Codec.array(Codec.string),
        registeredAt: RegisteredAt.firestoreCodec,
      })
    )
  );

  static codec = pipe(
    FirestoreJobDocument.propsCodec,
    Codec.compose(fromClassCodec(FirestoreJobDocument))
  );
}

export type FirebaseJobDocumentProps = Codec.TypeOf<
  typeof FirestoreJobDocument.propsCodec
>;
