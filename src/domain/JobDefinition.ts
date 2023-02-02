import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots/index.js";
import { ScheduledAt } from "./ScheduledAt";
import { JobId } from "./JobId";
import { Clock } from "@/Clock/Clock";
import { Http } from "./Http";
import { JobScheduleArgs } from "./JobScheduleArgs";

export class JobDefinition {
  id;
  scheduledAt;
  url;
  http;

  constructor(props: JobDefinitionProps) {
    this.id = props.id;
    this.scheduledAt = props.scheduledAt;
    this.url = props.url;
    this.http = props.http;
  }

  static propsCodec = pipe(
    JobScheduleArgs.propsCodec,
    Codec.intersect(
      Codec.struct({
        id: JobId.codec,
      })
    )
  );

  static firestorePropsCodec = pipe(
    Codec.struct({
      id: JobId.codec,
      scheduledAt: ScheduledAt.firestoreCodec,
    }),
    Codec.intersect(
      Codec.partial({
        url: Codec.string,
        http: Http.codec,
      })
    )
  );

  static firestoreCodec = pipe(
    JobDefinition.firestorePropsCodec,
    Codec.compose(fromClassCodec(JobDefinition))
  );

  static codec = pipe(
    JobDefinition.propsCodec,
    Codec.compose(fromClassCodec(JobDefinition))
  );

  static factory = (
    props:
      | (Partial<Omit<JobDefinitionProps, "scheduledAt">> & { clock: Clock })
      | (Partial<JobDefinitionProps> & { scheduledAt: ScheduledAt })
  ) =>
    new JobDefinition({
      id: props.id ?? JobId.factory(),
      scheduledAt:
        "scheduledAt" in props
          ? props.scheduledAt
          : ScheduledAt.factory({ date: props.clock.now() }),
      http:
        props.http ??
        Http.factory({
          url: props.url ?? "http://localhost:3000",
        }),
    });
}

export type JobDefinitionProps = Codec.TypeOf<
  typeof JobDefinition.firestorePropsCodec
>;
