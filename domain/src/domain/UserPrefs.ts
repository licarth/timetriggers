import { taggedVersionedClassCodec } from "@/iots";
import { CodecType } from "@/project";
import { pipe } from "fp-ts/lib/function";
import * as Codec from "io-ts/lib/Codec.js";

export class UserPrefs {
  _tag = "UserPrefs" as const;
  _version = 1 as const;
  _props;

  initialNavSize;

  constructor(props: UserPrefsProps) {
    this._props = props;
    this.initialNavSize = props.initialNavSize;
  }

  static propsCodec = (codecType: CodecType) =>
    pipe(
      Codec.struct({
        initialNavSize: Codec.literal("large", "small"),
      }),
      Codec.intersect(Codec.partial({}))
    );

  static codec = (codecType: CodecType) =>
    taggedVersionedClassCodec(this.propsCodec(codecType), this);

  static default = () => new UserPrefs({ initialNavSize: "large" });
}

export type UserPrefsProps = Codec.TypeOf<
  ReturnType<typeof UserPrefs.propsCodec>
>;
