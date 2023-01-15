import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { ScheduledAt } from "./ScheduledAt";
import { JobId } from "./JobId";

export class JobDefinition {
  id;
  scheduledAt;

  constructor(props: JobDefinitionProps) {
    this.id = props.id;
    this.scheduledAt = props.scheduledAt;
  }

  static propsCodec = Codec.struct({
    id: JobId.codec,
    scheduledAt: ScheduledAt.dateCodec,
  });

  static codec = pipe(
    JobDefinition.propsCodec,
    Codec.compose(fromClassCodec(JobDefinition))
  );
}

export type JobDefinitionProps = Codec.TypeOf<typeof JobDefinition.propsCodec>;
