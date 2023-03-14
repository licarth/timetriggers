import { Clock, SystemClock } from "@/Clock";
import { taggedVersionedClassCodec } from "@/iots/taggedVersionClassCodec/taggedVersionedClassCodec";
import { CodecType, ProjectId } from "@/project";
import { pipe } from "fp-ts/lib/function";
import * as Codec from "io-ts/lib/Codec.js";
import { HttpCallLastStatus } from "./HttpCallStatusUpdate";
import { JobDefinition } from "./JobDefinition";
import { JobStatus } from "./JobStatus";
import { RegisteredAt } from "./RegisteredAt";
import { ScheduledWithin } from "./ScheduledWithin";

export class JobDocument {
  _tag = "JobDocument" as const;
  _version = 1 as const;
  _props;

  jobDefinition;
  status;
  shards;
  lastStatusUpdate;
  projectId;
  rateLimitKeys;
  scheduledWithin;

  constructor(props: JobDocumentProps) {
    this._props = props;
    this.jobDefinition = props.jobDefinition;
    this.status = props.status;
    this.shards = props.shards;
    this.lastStatusUpdate = props.lastStatusUpdate;
    this.projectId = props.projectId;
    this.rateLimitKeys = props.rateLimitKeys;
    this.scheduledWithin = props.scheduledWithin;
  }

  id() {
    return this.jobDefinition.id;
  }

  static factory = (
    props: Partial<
      Parameters<typeof JobDefinition.factory>[0] & {
        shards: string[];
        clock?: Clock;
      }
    >
  ) => {
    const clock = props.clock || new SystemClock();
    return new JobDocument({
      jobDefinition: JobDefinition.factory({
        ...props,
        clock,
      }),
      shards: props.shards || [],
      status: JobStatus.registeredNow(clock),
    });
  };

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
          rateLimitKeys: Codec.array(Codec.string),
          scheduledWithin: ScheduledWithin.codec(codecType),
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
