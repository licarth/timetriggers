import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots";
import { UtcDate } from "..";
import * as D from "io-ts/lib/Decoder.js";

export class QueuedAt {
  date;

  constructor(props: RegisteredAtProps) {
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
    Codec.compose(fromClassCodec(QueuedAt))
  );

  static codec = pipe(
    Codec.string,
    Codec.compose(
      Codec.make(
        { decode: (s: string) => D.success({ date: s }) },
        { encode: (s) => s.date }
      )
    ),
    Codec.compose(QueuedAt.propsCodec),
    Codec.compose(fromClassCodec(QueuedAt))
  );

  static fromUTCString(date: string): QueuedAt {
    return new QueuedAt({ date: new Date(date) });
  }

  static factory = (props: Partial<RegisteredAtProps> = {}) => {
    return new QueuedAt({
      date: props.date ?? new Date(),
    });
  };

  static fromDate(date: Date): QueuedAt {
    return new QueuedAt({ date });
  }
}

export type RegisteredAtProps = Codec.TypeOf<typeof QueuedAt.propsCodec>;

// const mapProps = (map: Record<string, any>) => {};
