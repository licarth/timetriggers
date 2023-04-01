import { Clock } from "@/Clock";
import { CodecType } from "@/project";
import { fromClassCodec } from "@iots";
import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { CustomKey } from "./CustomKey";
import { Http } from "./Http";
import { JobId } from "./JobId";
import { ScheduledAt } from "./ScheduledAt";
import { Url } from "./Url";

export class JobScheduleArgs {
  scheduledAt;
  http;
  id;
  customKey;

  constructor(props: JobScheduleHttpArgsProps) {
    this.scheduledAt = props.scheduledAt;
    this.http = props.http;
    this.id = props.id;
    this.customKey = props.customKey;
  }

  static propsCodec = (codecType: CodecType) =>
    pipe(
      Codec.struct({
        scheduledAt: ScheduledAt.codec(codecType),
      }),
      Codec.intersect(
        Codec.partial({
          http: Http.codec,
          id: JobId.codec,
          customKey: CustomKey.codec,
        })
      )
    );

  static codec = (codecType: CodecType) =>
    pipe(
      JobScheduleArgs.propsCodec(codecType),
      Codec.compose(fromClassCodec(JobScheduleArgs))
    );

  static factory = (
    props: Partial<JobScheduleHttpArgsProps> & { clock?: Clock } = {}
  ) => {
    return new JobScheduleArgs({
      ...props,
      scheduledAt: props.scheduledAt || ScheduledAt.factory(props.clock?.now()),
      http:
        props.http ||
        Http.factory({
          url: Url.localhost(3000),
        }),
    });
  };
}

export type JobScheduleHttpArgsProps = Codec.TypeOf<
  ReturnType<typeof JobScheduleArgs.propsCodec>
>;
