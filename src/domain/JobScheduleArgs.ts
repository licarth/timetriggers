import { fromClassCodec } from "@iots/index.js";
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

  static propsCodec = pipe(
    Codec.struct({
      scheduledAt: ScheduledAt.codec,
    }),
    Codec.intersect(
      Codec.partial({
        http: Http.codec,
      })
    )
  );

  static codec = pipe(
    JobScheduleArgs.propsCodec,
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
  typeof JobScheduleArgs.propsCodec
>;
