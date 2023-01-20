import { Clock } from "@/Clock/Clock";
import { SystemClock } from "@/Clock/SystemClock";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither";
import * as C from "io-ts/lib/Codec";
import _ from "lodash";
import { Api } from "../Api";
import { JobDefinition } from "../JobDefinition";
import { JobId } from "../JobId";
import { FirestoreProcessor } from "./FirestoreProcessor";
import {
  FirestoreScheduler,
  REGISTERED_JOBS_COLL_PATH,
} from "./FirestoreScheduler";
import { initializeApp } from "./initializeApp.js";
import * as O from "fp-ts/lib/Option";

export type FirestoreApiProps = {
  clock?: Clock;
  rootDocumentPath: string;
  numProcessors: number;
  runScheduler?: boolean;
};

export class FirestoreApi implements Api {
  firestore;
  rootDocumentPath;
  clock: Clock = new SystemClock();
  scheduler: O.Option<FirestoreScheduler>;
  processors;

  private constructor(props: FirestoreApiProps) {
    if (props.clock) {
      this.clock = props.clock;
    }
    this.rootDocumentPath = props.rootDocumentPath;
    this.firestore = initializeApp().firestore;
    this.scheduler = pipe(
      props.runScheduler
        ? new FirestoreScheduler({
            clock: this.clock,
            firestore: this.firestore,
            rootDocumentPath: this.rootDocumentPath,
          })
        : null,
      O.fromNullable
    );
    this.processors = _.times(
      props.numProcessors,
      () =>
        new FirestoreProcessor({
          firestore: this.firestore,
          rootDocumentPath: this.rootDocumentPath,
          clock: this.clock,
        })
    );
  }

  static build(props: FirestoreApiProps) {
    return pipe(
      TE.of(new FirestoreApi(props)),
      TE.chainFirstW((api) =>
        pipe(
          api.processors.map((p) => p.run()),
          TE.sequenceArray
        )
      ),
      TE.chainFirstW((api) =>
        pipe(
          api.scheduler,
          O.fold(
            () => TE.of(void 0),
            (scheduler) => scheduler.run()
          )
        )
      )
    );
  }

  schedule(args: Omit<JobDefinition, "id">) {
    return TE.tryCatch(
      async () => {
        const id = JobId.factory();
        const jobDefinition = new JobDefinition({ ...args, id });
        const jobDefinitionRef = this.firestore
          .collection(`${this.rootDocumentPath}${REGISTERED_JOBS_COLL_PATH}`)
          .doc(id);
        await jobDefinitionRef.set(
          JobDefinition.firestoreCodec.encode(jobDefinition)
        );
        return id;
      },
      (reason) => new Error(`Failed to schedule job: ${reason}`)
    );
  }

  cancel(args: { jobId: JobId }) {
    return TE.tryCatch(
      async () => {
        const jobDefinitionRef = this.firestore
          .collection(`${this.rootDocumentPath}${REGISTERED_JOBS_COLL_PATH}`)
          .doc(args.jobId);
        await jobDefinitionRef.delete();
      },
      (reason) => new Error(`Failed to cancel job: ${reason}`)
    );
  }

  cancelAllJobs() {
    return TE.tryCatch(
      async () => {
        const jobDefinitions = await this.firestore
          .collection(`${this.rootDocumentPath}${REGISTERED_JOBS_COLL_PATH}`)
          .get();
        const batch = this.firestore.batch();
        jobDefinitions.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      },
      (reason) => new Error(`Failed to cancel all jobs: ${reason}`)
    );
  }

  getNextPlanned(count: number) {
    return pipe(
      TE.tryCatch(
        async () => {
          return await this.firestore
            .collection(`${this.rootDocumentPath}${REGISTERED_JOBS_COLL_PATH}`)
            .orderBy("scheduledAt", "asc")
            .limit(count)
            .get();
        },
        (reason) => new Error(`Failed to get next planned jobs: ${reason}`)
      ),
      TE.map((x) => x.docs.map((doc) => doc.data())),
      TE.chainEitherKW(C.array(JobDefinition.firestoreCodec).decode)
    );
  }

  close() {
    this.processors.forEach((p) => p.close());
    return pipe(
      pipe(
        this.scheduler,
        O.fold(
          () => TE.of(void 0),
          (scheduler) => scheduler.close()
        )
      ),
      TE.chainFirstW(() =>
        TE.tryCatch(
          () =>
            this.firestore.terminate().catch((e) => {
              // ignore error
            }),
          () => null
        )
      )
    );
  }
}
