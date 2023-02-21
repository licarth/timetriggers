import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { RegisteredAt } from "./RegisteredAt";
import { QueuedAt } from "./QueuedAt";
import { CodecType } from "@/project";

export class JobStatus {
  value;
  registeredAt;
  queuedAt;

  constructor(props: JobStatusProps) {
    this.value = props.value;
    this.registeredAt = props.registeredAt;
    this.queuedAt = props.queuedAt;
  }

  static propsCodec = (codecType: CodecType) =>
    pipe(
      Codec.struct({
        value: Codec.literal("registered", "queued", "running", "completed"),
        registeredAt: RegisteredAt.codec(codecType),
      }),
      Codec.intersect(
        Codec.partial({
          queuedAt: QueuedAt.codec,
        })
      )
    );

  static codec = (codecType: CodecType) =>
    pipe(
      JobStatus.propsCodec(codecType),
      Codec.compose(fromClassCodec(JobStatus))
    );
}

export type JobStatusProps = Codec.TypeOf<
  ReturnType<typeof JobStatus.propsCodec>
>;
