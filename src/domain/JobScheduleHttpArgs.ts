import { fromClassCodec } from "@iots/index.js";
import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { ScheduledAt } from "./ScheduledAt";

export class JobScheduleHttpArgs {
  scheduledAt;
  url;

  constructor(props: JobScheduleHttpArgsProps) {
    this.scheduledAt = props.scheduledAt;
    this.url = props.url;
  }

  static propsCodec = Codec.struct({
    scheduledAt: ScheduledAt.codec,
    url: Codec.string,
  });

  static codec = pipe(
    JobScheduleHttpArgs.propsCodec,
    Codec.compose(fromClassCodec(JobScheduleHttpArgs))
  );
}

export type JobScheduleHttpArgsProps = Codec.TypeOf<
  typeof JobScheduleHttpArgs.propsCodec
>;
