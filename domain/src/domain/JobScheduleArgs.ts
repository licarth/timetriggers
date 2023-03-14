import { Clock } from "@/Clock";
import { CodecType } from "@/project";
import { fromClassCodec } from "@iots";
import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { Http } from "./Http";
import { ScheduledAt } from "./ScheduledAt";
import { Url } from "./Url";

export class JobScheduleArgs {
  scheduledAt;
  http;

  constructor(props: JobScheduleArgsProps) {
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

  static factory = (
    props: Partial<JobScheduleArgsProps> & { clock?: Clock } = {}
  ) => {
    return new JobScheduleArgs({
      scheduledAt: props.scheduledAt || ScheduledAt.factory(props.clock?.now()),
      http:
        props.http ||
        Http.factory({
          url: Url.localhost(3000),
        }),
    });
  };
}

export type JobScheduleArgsProps = Codec.TypeOf<
  ReturnType<typeof JobScheduleArgs.propsCodec>
>;

const floorAtSecond = (date: Date) => {
  date.setMilliseconds(0);
  return date;
};
