import { CodecType } from "@/project";
import { fromClassCodec } from "@iots";
import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { Clock } from "../Clock";
import { CustomKey } from "./CustomKey";
import { Http } from "./Http";
import { JobId } from "./JobId";
import { JobScheduleArgs } from "./JobScheduleArgs";
import { ScheduledAt } from "./ScheduledAt";

export class JobDefinition {
  id;
  scheduledAt;
  http;
  customKey;

  constructor(props: JobDefinitionProps) {
    this.id = props.id;
    this.scheduledAt = props.scheduledAt;
    this.http = props.http;
    this.customKey = props.customKey;
  }

  static propsCodec = (codecType: CodecType) =>
    pipe(
      JobScheduleArgs.propsCodec(codecType),
      Codec.intersect(
        Codec.struct({
          id: JobId.codec,
        })
      ),
      Codec.intersect(
        Codec.partial({
          customKey: CustomKey.codec,
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
