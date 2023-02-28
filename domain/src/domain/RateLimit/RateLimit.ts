import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import { CodecType, Project, ProjectId } from "@/project";
import { UtcDate } from "@/UtcDate";
import { pipe } from "fp-ts/lib/function";
import * as Codec from "io-ts/lib/Codec.js";
import { JobId } from "../JobId";
import { ScheduledAt } from "../ScheduledAt";
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
  scheduledAt;

  constructor(props: RateLimitProps) {
    this._props = props;
    this.shards = props.shards;
    this.key = props.key;
    this.jobId = props.jobId;
    this.createdAt = props.createdAt;
    this.satisfiedAt = props.satisfiedAt;
    this.scheduledAt = props.scheduledAt;
  }

  static propsCodec = (codecType: CodecType) =>
    pipe(
      Codec.struct({
        key: RateLimitKey.codec,
        jobId: JobId.codec,
        scheduledAt: ScheduledAt.codec(codecType),
        satisfiedAt: Codec.nullable<unknown, Date | string, Date>(
          UtcDate.codec(codecType)
        ),
      }),
      Codec.intersect(
        Codec.partial({
          shards: Codec.array(Codec.string),
          createdAt: UtcDate.codec(codecType),
        })
      )
    );

  static tld = (
    tld: string,
    jobId: JobId,
    scheduledAt: ScheduledAt,
    shards?: string[]
  ) => {
    return new this({
      key: `tld:${tld}` as RateLimitKey,
      shards,
      jobId,
      satisfiedAt: null,
      scheduledAt,
    });
  };

  static project = (
    jobId: JobId,
    project: ProjectId,
    scheduledAt: ScheduledAt,
    shards?: string[]
  ) => {
    return new this({
      key: `project:${project}` as RateLimitKey,
      shards,
      jobId,
      satisfiedAt: null,
      scheduledAt,
    });
  };

  static codec = (codecType: CodecType) =>
    taggedVersionedClassCodec(this.propsCodec(codecType), this);
}

export type RateLimitProps = Codec.TypeOf<
  ReturnType<typeof RateLimit.propsCodec>
>;
