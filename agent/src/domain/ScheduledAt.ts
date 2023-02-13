import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { UtcDate } from "@timetriggers/domain";
import * as D from "io-ts/lib/Decoder.js";

export class ScheduledAt {
  date;

  constructor(props: ScheduledAtProps) {
    this.date = props.date;
  }

  static propsCodec = Codec.struct({
    date: UtcDate.stringCodec,
  });

  static firestoreCodec = pipe(
    UtcDate.firestoreDateCodec,
    Codec.compose(
      Codec.make(
        { decode: (d: Date) => D.success({ date: d }) },
        { encode: (s) => s.date }
      )
    ),
    Codec.compose(fromClassCodec(ScheduledAt))
  );

  static codec = pipe(
    Codec.string,
    Codec.compose(
      Codec.make(
        { decode: (s: string) => D.success({ date: s }) },
        { encode: (s) => s.date }
      )
    ),
    Codec.compose(ScheduledAt.propsCodec),
    Codec.compose(fromClassCodec(ScheduledAt))
  );

  static fromUTCString(date: string): ScheduledAt {
    return new ScheduledAt({ date: new Date(date) });
  }

  static factory = (props: Partial<ScheduledAtProps> = {}) => {
    return new ScheduledAt({
      date: props.date ?? new Date(),
    });
  };

  static fromDate(date: Date): ScheduledAt {
    return new ScheduledAt({ date });
  }
}

export type ScheduledAtProps = Codec.TypeOf<typeof ScheduledAt.propsCodec>;

// const mapProps = (map: Record<string, any>) => {};
