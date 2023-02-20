import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots";
import { UtcDate } from "../";
import * as D from "io-ts/lib/Decoder.js";
import * as E from "fp-ts/lib/Either.js";

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

  static parseISOString = (
    date: unknown
  ): E.Either<"Invalid Date", ScheduledAt> => {
    if (typeof date !== "string") {
      return E.left("Invalid Date");
    }
    const d = new Date(date);
    return isNaN(d.getTime())
      ? E.left("Invalid Date")
      : E.right(new ScheduledAt({ date: d }));
  };

  static fromDate(date: Date): ScheduledAt {
    return new ScheduledAt({ date });
  }
}

export type ScheduledAtProps = Codec.TypeOf<typeof ScheduledAt.propsCodec>;

// const mapProps = (map: Record<string, any>) => {};
