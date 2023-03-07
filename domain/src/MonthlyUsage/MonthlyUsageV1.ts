import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import { ProjectId } from "@/project";
import * as Codec from "io-ts/lib/Codec.js";

export class MonthlyUsageV1 {
  _tag = "MonthlyUsage" as const;
  _version = 1 as const;
  _props;

  done;
  planned;

  constructor(props: MonthlyUsageV1Props) {
    this._props = props;
    this.done = props.done;
    this.planned = props.planned;
  }

  getScheduleUsageForYearMonth(year: number, month: number) {
    const monthString = month.toString().padStart(2, "0");
    return this.done?.api?.schedule?.[year]?.[monthString] ?? 0;
  }

  getScheduleUsageForDate(now: Date) {
    return this.getScheduleUsageForYearMonth(
      now.getFullYear(),
      now.getMonth() + 1
    );
  }

  static propsCodec = Codec.partial({
    projectId: ProjectId.codec,
    done: Codec.partial({
      api: Codec.partial({
        schedule: Codec.record(Codec.record(Codec.number)),
      }),
    }),
    planned: Codec.partial({
      trigger: Codec.record(Codec.record(Codec.number)),
    }),
  });

  static empty() {
    return new MonthlyUsageV1({});
  }

  static codec = taggedVersionedClassCodec(this.propsCodec, this);
}

export type MonthlyUsageV1Props = Codec.TypeOf<
  typeof MonthlyUsageV1.propsCodec
>;
