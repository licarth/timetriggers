import { Clock } from "@/Clock";
import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import { CodecType } from "@/project";
import * as Codec from "io-ts/lib/Codec.js";
import { JobDefinition } from "./JobDefinition";
import { JobStatus } from "./JobStatus";
import { RegisteredAt } from "./RegisteredAt";

export class JobDocument {
  _tag = "JobDocument" as const;
  _version = 1 as const;
  _props;

  jobDefinition;
  status;
  shards;

  constructor(props: JobDocumentProps) {
    this._props = props;
    this.jobDefinition = props.jobDefinition;
    this.status = props.status;
    this.shards = props.shards;
  }

  static propsCodec = (codecType: CodecType) =>
    Codec.struct({
      jobDefinition: JobDefinition.codec(codecType),
      status: JobStatus.codec(codecType),
      shards: Codec.array(Codec.string),
    });

  static codec = (codecType: CodecType) =>
    taggedVersionedClassCodec(this.propsCodec(codecType), this);

  static registeredNowWithoutShards(
    jobDefinition: JobDefinition,
    clock: Clock
  ) {
    return new JobDocument({
      jobDefinition,
      status: new JobStatus({
        value: "registered",
        registeredAt: RegisteredAt.fromDate(clock.now()),
      }),
      shards: [],
    });
  }
}

export type JobDocumentProps = Codec.TypeOf<
  ReturnType<typeof JobDocument.propsCodec>
>;
