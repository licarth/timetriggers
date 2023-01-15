import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";

export class JobStatusUpdate {
  status;

  constructor(props: JobStatusUpdateProps) {
    this.status = props.status;
  }

  static propsCodec = Codec.struct({
    status: Codec.literal(
      "planned",
      "queued",
      "running",
      "completed",
      "failed"
    ),
  });

  static codec = pipe(
    JobStatusUpdate.propsCodec,
    Codec.compose(fromClassCodec(JobStatusUpdate))
  );

  static planned = new JobStatusUpdate({ status: "planned" });
  static queued = new JobStatusUpdate({ status: "queued" });
  static running = new JobStatusUpdate({ status: "running" });
  static completed = new JobStatusUpdate({ status: "completed" });
  static failed = new JobStatusUpdate({ status: "failed" });
}

export type JobStatusUpdateProps = Codec.TypeOf<
  typeof JobStatusUpdate.propsCodec
>;
