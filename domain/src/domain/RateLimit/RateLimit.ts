import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import { CodecType } from "@/project";
import { UtcDate } from "@/UtcDate";
import { pipe } from "fp-ts/lib/function";
import * as Codec from "io-ts/lib/Codec.js";
import { JobId } from "../JobId";
import { RateLimitKey } from "./RateLimitKey";

export class RateLimit {
  _tag = "RateLimit" as const;
  _version = 1 as const;
  _props;

  shards;
  key;
  jobId;
  createdAt;
  satisfiedAt;

  constructor(props: RateLimitProps) {
    this._props = props;
    this.shards = props.shards;
    this.key = props.key;
    this.jobId = props.jobId;
    this.createdAt = props.createdAt;
    this.satisfiedAt = props.satisfiedAt;
  }

  static propsCodec = (codecType: CodecType) =>
    pipe(
      Codec.struct({
        key: RateLimitKey.codec,
        jobId: JobId.codec,
      }),
      Codec.intersect(
        Codec.partial({
          shards: Codec.array(Codec.string),
          createdAt: UtcDate.codec(codecType),
          satisfiedAt: UtcDate.codec(codecType),
        })
      )
    );

  static tld = (tld: string, jobId: JobId, shards?: string[]) => {
    return new this({
      key: `tld:${tld}` as RateLimitKey,
      shards,
      jobId,
    });
  };

  static codec = (codecType: CodecType) =>
    taggedVersionedClassCodec(this.propsCodec(codecType), this);
}

export type RateLimitProps = Codec.TypeOf<
  ReturnType<typeof RateLimit.propsCodec>
>;
