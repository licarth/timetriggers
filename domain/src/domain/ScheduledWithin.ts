import { Clock } from "@/Clock";
import { CodecType, taggedVersionedClassCodec } from "@iots/index.js";
import * as Codec from "io-ts/lib/Codec.js";
import { ScheduledAt } from "./ScheduledAt";

export class ScheduledWithin {
  _tag = "ScheduledWithin" as const;
  _version = 1 as const;
  _props;

  readonly "1s": boolean;
  readonly "1m": boolean;
  readonly "10m": boolean;
  readonly "1h": boolean;

  constructor(props: ScheduledWithinProps) {
    this._props = props;
    this["1s"] = props["1s"];
    this["1m"] = props["1m"];
    this["10m"] = props["10m"];
    this["1h"] = props["1h"];
  }

  static propsCodec = (codecType: CodecType) =>
    Codec.struct({
      "1s": Codec.boolean,
      "1m": Codec.boolean,
      "10m": Codec.boolean,
      "1h": Codec.boolean,
    });

  static fromScheduledAt = (scheduledAt: ScheduledAt, clock: Clock) => {
    const delta = scheduledAt.getTime() - clock.now().getTime();
    return new ScheduledWithin({
      "1s": delta < 1000,
      "1m": delta < 1000 * 60,
      "10m": delta < 1000 * 60 * 10,
      "1h": delta < 1000 * 60 * 60,
    });
  };

  static build = (props: ScheduledWithinProps) => {};

  static codec = (codecType: CodecType) =>
    taggedVersionedClassCodec(this.propsCodec(codecType), this);
}

export type ScheduledWithinProps = Codec.TypeOf<
  ReturnType<typeof ScheduledWithin.propsCodec>
>;

// {
//     "1s": scheduledWithin < 1000,
//     "1m": scheduledWithin < 1000 * 60,
//     "10m": scheduledWithin < 1000 * 60 * 10,
//     "1h": scheduledWithin < 1000 * 60 * 60,
//     "2h": scheduledWithin < 1000 * 60 * 60 * 2,
//   },
