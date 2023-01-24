import { AbstractApi, AbstractApiProps } from "@/AbstractApi";
import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function.js";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as C from "io-ts/lib/Codec";
import _ from "lodash";
import { JobDefinition } from "../domain/JobDefinition";
import { JobId } from "../domain/JobId";
import { FirestoreProcessor } from "./FirestoreProcessor";
import {
  FirestoreScheduler,
  REGISTERED_JOBS_COLL_PATH,
} from "./FirestoreScheduler";
import { initializeApp } from "./initializeApp.js";
import { withTimeout } from "../fp-ts/withTimeout";

const preloadedHashingFunction = consistentHashingFirebaseArrayPreloaded(15);

export type FirestoreApiProps = AbstractApiProps & {
  rootDocumentPath: string;
  numProcessors: number;
  runScheduler?: boolean;
  firestore?: FirebaseFirestore.Firestore;
};

export class FirestoreApi extends AbstractApi {
  firestore;
  firestoreOrigin: "internal" | "external";
  rootDocumentPath;
  scheduler: O.Option<FirestoreScheduler>;
  processors;

  private constructor(props: FirestoreApiProps) {
    super(props);
    this.rootDocumentPath = props.rootDocumentPath;
    this.firestore = props.firestore || initializeApp().firestore;
    this.firestoreOrigin = props.firestore ? "external" : "internal";

    this.scheduler = pipe(
      props.runScheduler === true || props.runScheduler === undefined
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
          workerPool: this.workerPool,
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
      ),
      // wait for at least one successful ping
      TE.chainFirstW((api) => api.healthCheck())
    );
  }

  healthCheck() {
    return pipe(
      TE.tryCatch(
        () => this.firestore.listCollections(),
        (e) => new Error(`Failed to ping Firestore: ${e}`)
      ),
      withTimeout(E.left(new Error("Healthcheck timeout")), 5000)
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
        await jobDefinitionRef.set({
          jobDefinition: JobDefinition.firestoreCodec.encode(jobDefinition),
          shards: preloadedHashingFunction(jobDefinition.id).slice(1),
        });
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
      TE.chainFirstW(() => this.workerPool.close()),
      TE.chainFirstW(() =>
        TE.tryCatch(
          () =>
            new Promise<void>((resolve, reject) => {
              if (this.firestoreOrigin === "internal") {
                return this.firestore
                  .terminate()
                  .catch((e) => {
                    // ignore error
                  })
                  .finally(() => {
                    resolve();
                  });
              } else {
                resolve();
              }
            }),
          () => new Error(`Failed to close Firestore.`)
        )
      )
    );
  }
}
