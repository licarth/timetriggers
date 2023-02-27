import { Clock } from "@/Clock";
import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import { CodecType, ProjectId } from "@/project";
import { pipe } from "fp-ts/lib/function";
import * as Codec from "io-ts/lib/Codec.js";
import { HttpCallLastStatus } from "./HttpCallStatusUpdate";
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
  lastStatusUpdate;

  constructor(props: JobDocumentProps) {
    this._props = props;
    this.jobDefinition = props.jobDefinition;
    this.status = props.status;
    this.shards = props.shards;
    this.lastStatusUpdate = props.lastStatusUpdate;
  }

  static propsCodec = (codecType: CodecType) =>
    pipe(
      Codec.struct({
        jobDefinition: JobDefinition.codec(codecType),
        status: JobStatus.codec(codecType),
        shards: Codec.array(Codec.string),
      }),
      Codec.intersect(
        Codec.partial({
          projectId: ProjectId.codec,
          lastStatusUpdate: HttpCallLastStatus.codec,
        })
      )
    );

  static codec = (codecType: CodecType) =>
    taggedVersionedClassCodec(this.propsCodec(codecType), this);

  static registeredNowWithoutShards({
    jobDefinition,
    clock,
    projectId,
  }: {
    jobDefinition: JobDefinition;
    clock: Clock;
    projectId?: ProjectId;
  }) {
    return new JobDocument({
      jobDefinition,
      status: new JobStatus({
        value: "registered",
        registeredAt: RegisteredAt.fromDate(clock.now()),
      }),
      projectId,
      shards: [],
    });
  }
}

export type JobDocumentProps = Codec.TypeOf<
  ReturnType<typeof JobDocument.propsCodec>
>;
