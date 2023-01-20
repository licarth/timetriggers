import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { ScheduledAt } from "./ScheduledAt";
import { JobId } from "./JobId";

export class JobDefinition {
  id;
  scheduledAt;
  url;

  constructor(props: JobDefinitionProps) {
    this.id = props.id;
    this.scheduledAt = props.scheduledAt;
    this.url = props.url;
  }

  static firestorePropsCodec = Codec.struct({
    id: JobId.codec,
    scheduledAt: ScheduledAt.firestoreCodec,
    url: Codec.string,
  });

  static firestoreCodec = pipe(
    JobDefinition.firestorePropsCodec,
    Codec.compose(fromClassCodec(JobDefinition))
  );
}

export type JobDefinitionProps = Codec.TypeOf<
  typeof JobDefinition.firestorePropsCodec
>;
