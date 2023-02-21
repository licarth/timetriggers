import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots";
import { ScheduledAt } from "./ScheduledAt";
import { JobId } from "./JobId";
import { Clock } from "../Clock";
import { Http } from "./Http";
import { JobScheduleArgs } from "./JobScheduleArgs";
import { CodecType } from "@/project";

export class JobDefinition {
  id;
  scheduledAt;
  http;

  constructor(props: JobDefinitionProps) {
    this.id = props.id;
    this.scheduledAt = props.scheduledAt;
    this.http = props.http;
  }

  static propsCodec = (codecType: CodecType) =>
    pipe(
      JobScheduleArgs.propsCodec(codecType),
      Codec.intersect(
        Codec.struct({
          id: JobId.codec,
        })
      )
    );

  static codec = (codecType: CodecType) =>
    pipe(this.propsCodec(codecType), Codec.compose(fromClassCodec(this)));

  static factory = (
    props:
      | (Partial<Omit<JobDefinitionProps, "scheduledAt">> & { clock: Clock })
      | (Partial<JobDefinitionProps> & { scheduledAt: ScheduledAt })
  ) =>
    new JobDefinition({
      id: props.id ?? JobId.factory(),
      scheduledAt:
        "scheduledAt" in props
          ? props.scheduledAt
          : ScheduledAt.factory(props.clock.now()),
      http: props.http ?? Http.factory({}),
    });
}

export type JobDefinitionProps = Codec.TypeOf<
  ReturnType<typeof JobDefinition.propsCodec>
>;
