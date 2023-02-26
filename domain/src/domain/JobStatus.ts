import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { RegisteredAt } from "./RegisteredAt";
import { QueuedAt } from "./QueuedAt";
import { CodecType } from "@/project";
import { StartedAt } from "./StartedAt";
import { CompletedAt } from "./CompletedAt";
import * as E from "fp-ts/lib/Either.js";
import { e } from "@/fp-ts";

export class JobStatus {
  value;
  registeredAt;
  queuedAt;
  startedAt;
  completedAt;

  constructor(props: JobStatusProps) {
    this.value = props.value;
    this.registeredAt = props.registeredAt;
    this.queuedAt = props.queuedAt;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
  }

  markAsRunning(startedAt: StartedAt) {
    return pipe(
      this,
      E.fromPredicate(
        ({ value }) => value === "queued",
        () => "JobStatus is not queued" as const
      ),
      e.sideEffect(() => {
        this.value = "running";
        this.startedAt = startedAt;
      })
    );
  }

  markAsCompleted(completedAt: CompletedAt) {
    return pipe(
      this,
      E.fromPredicate(
        ({ value }) => value === "running",
        () => "JobStatus is not running" as const
      ),
      e.sideEffect(() => {
        this.value = "completed";
        this.completedAt = completedAt;
      })
    );
  }

  executionLagMs() {
    return pipe(
      this,
      E.fromPredicate(
        ({ value }) => value === "running" || value === "completed",
        () => "JobStatus is not running" as const
      ),
      E.filterOrElseW(
        ({ startedAt }) => !!startedAt,
        () => "JobStatus startedAt is not set" as const
      ),
      E.map(({ startedAt, registeredAt }) => {
        return startedAt!.getTime() - registeredAt.getTime();
      })
    );
  }

  durationMs() {
    return pipe(
      this,
      E.fromPredicate(
        ({ value }) => value === "completed",
        () => "JobStatus is not completed" as const
      ),
      E.filterOrElseW(
        ({ startedAt, completedAt }) => !!startedAt && !!completedAt,
        () => "JobStatus startedAt or completedAt is not set" as const
      ),
      E.map(({ startedAt, completedAt }) => {
        return completedAt!.getTime() - startedAt!.getTime();
      })
    );
  }

  static propsCodec = (codecType: CodecType) =>
    pipe(
      Codec.struct({
        value: Codec.literal("registered", "queued", "running", "completed"),
        registeredAt: RegisteredAt.codec(codecType),
      }),
      Codec.intersect(
        Codec.partial({
          queuedAt: QueuedAt.codec(codecType),
          startedAt: StartedAt.codec(codecType),
          completedAt: CompletedAt.codec(codecType),
        })
      )
    );

  static codec = (codecType: CodecType) =>
    pipe(
      JobStatus.propsCodec(codecType),
      Codec.compose(fromClassCodec(JobStatus))
    );
}

export type JobStatusProps = Codec.TypeOf<
  ReturnType<typeof JobStatus.propsCodec>
>;
