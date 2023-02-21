import { CodecType } from "@/project";
import { fromClassCodec } from "@iots";
import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { Http } from "./Http";
import { ScheduledAt } from "./ScheduledAt";

export class JobScheduleArgs {
  scheduledAt;
  http;

  constructor(props: JobScheduleHttpArgsProps) {
    this.scheduledAt = props.scheduledAt;
    this.http = props.http;
  }

  static propsCodec = (codecType: CodecType) =>
    pipe(
      Codec.struct({
        scheduledAt: ScheduledAt.codec(codecType),
      }),
      Codec.intersect(
        Codec.partial({
          http: Http.codec,
        })
      )
    );

  static codec = (codecType: CodecType) =>
    pipe(
      JobScheduleArgs.propsCodec(codecType),
      Codec.compose(fromClassCodec(JobScheduleArgs))
    );

  static factory = (props: Partial<JobScheduleHttpArgsProps> = {}) => {
    return new JobScheduleArgs({
      scheduledAt: props.scheduledAt || ScheduledAt.factory(),
      http:
        props.http ||
        Http.factory({
          url: "http://localhost:3000",
        }),
    });
  };
}

export type JobScheduleHttpArgsProps = Codec.TypeOf<
  ReturnType<typeof JobScheduleArgs.propsCodec>
>;
