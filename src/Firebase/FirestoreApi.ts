import { Clock } from "@/Clock/Clock";
import { SystemClock } from "@/Clock/SystemClock";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither";
import * as C from "io-ts/lib/Codec";
import { Api } from "../Api";
import { JobDefinition } from "../JobDefinition";
import { JobId } from "../JobId";
import { FirestoreScheduler } from "./FirestoreScheduler";
import { initializeApp } from "./initializeApp.js";

const { firestore } = initializeApp();
const jobDefinitionCollection = firestore.collection("jobDefinitions");

export class FirestoreApi implements Api {
  clock: Clock = new SystemClock();
  scheduler: FirestoreScheduler;

  private constructor(props: { clock?: Clock } = {}) {
    if (props.clock) {
      this.clock = props.clock;
    }
    this.scheduler = new FirestoreScheduler({
      clock: this.clock,
      firestore,
      collection: jobDefinitionCollection,
    });
  }

  static build(props: { clock?: Clock }) {
    return pipe(
      TE.of(new FirestoreApi(props)),
      TE.chainFirstW((api) => api.scheduler.run())
    );
  }

  schedule(args: Omit<JobDefinition, "id">) {
    return TE.tryCatch(
      async () => {
        const id = JobId.factory();
        const jobDefinition = new JobDefinition({ ...args, id });
        const jobDefinitionRef = jobDefinitionCollection.doc(id);
        await jobDefinitionRef.set(JobDefinition.codec.encode(jobDefinition));
        return id;
      },
      (reason) => new Error(`Failed to schedule job: ${reason}`)
    );
  }

  cancel(args: { jobId: JobId }) {
    return TE.tryCatch(
      async () => {
        const jobDefinitionRef = jobDefinitionCollection.doc(args.jobId);
        await jobDefinitionRef.delete();
      },
      (reason) => new Error(`Failed to cancel job: ${reason}`)
    );
  }

  cancelAllJobs() {
    return TE.tryCatch(
      async () => {
        const jobDefinitions = await jobDefinitionCollection.get();
        const batch = firestore.batch();
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
          return await firestore
            .collection("jobDefinitions")
            .orderBy("scheduledAt", "asc")
            .limit(count)
            .get();
        },
        (reason) => new Error(`Failed to get next planned jobs: ${reason}`)
      ),
      TE.map((x) => x.docs.map((doc) => doc.data())),
      TE.chainEitherKW(C.array(JobDefinition.codec).decode)
    );
  }
}
