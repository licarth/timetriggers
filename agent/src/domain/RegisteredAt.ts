import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { UtcDate } from "@timetriggers/domain";
import * as D from "io-ts/lib/Decoder.js";

export class RegisteredAt {
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
    Codec.compose(fromClassCodec(RegisteredAt))
  );

  static codec = pipe(
    Codec.string,
    Codec.compose(
      Codec.make(
        { decode: (s: string) => D.success({ date: s }) },
        { encode: (s) => s.date }
      )
    ),
    Codec.compose(RegisteredAt.propsCodec),
    // mapProps((a) => ({ date: a })),
    Codec.compose(fromClassCodec(RegisteredAt))
  );

  static fromUTCString(date: string): RegisteredAt {
    return new RegisteredAt({ date: new Date(date) });
  }

  static factory = (props: Partial<RegisteredAtProps> = {}) => {
    return new RegisteredAt({
      date: props.date ?? new Date(),
    });
  };

  static fromDate(date: Date): RegisteredAt {
    return new RegisteredAt({ date });
  }
}

export type RegisteredAtProps = Codec.TypeOf<typeof RegisteredAt.propsCodec>;

// const mapProps = (map: Record<string, any>) => {};
