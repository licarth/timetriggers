import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import { Api } from "./Api";
import { environmentVariable } from "./environmentVariable";
import { FirestoreApi } from "./Firebase/FirestoreApi";
import { FirestoreScheduler } from "./Firebase/FirestoreScheduler";
import { initializeApp } from "./Firebase/initializeApp";
import { InMemoryDataStore } from "./Firebase/Processor/InMemoryDataStore";
import { Scheduler } from "./Firebase/Processor/Scheduler";
import { initializeHttpApi } from "./HttpApi/initializeHttpApi";

type StartProps = {
  namespace: string; // e.g. doi-production
  api: {
    enabled: boolean;
  };
  httpApi?: {
    port: number;
  };
  scheduler?: {
    enabled: boolean;
  };
  processor?: {
    enabled: boolean;
  };
};

export const start = (props: StartProps) =>
  pipe(
    RTE.of({
      firestore: initializeApp({
        serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT,
      }).firestore,
      namespace: props.namespace,
      rootDocumentPath: `/${
        environmentVariable("NAMESPACE") || "local-dev"
      }/tasks`,
    }),
    RTE.bindW("api", (other) =>
      props.api.enabled ? buildApi({ ...props, ...other }) : RTE.of(undefined)
    ),
    RTE.bindW("scheduler", ({ firestore, rootDocumentPath }) =>
      props.scheduler?.enabled
        ? startScheduler({ rootDocumentPath, firestore })
        : RTE.of(undefined)
    ), // TODO
    // RTE.bindW("processor", () => RTE.Do), // TODO
    RTE.chainFirstW(({ api }) =>
      api ? initializeHttpApi(api) : RTE.of(undefined)
    )
  );

export const startScheduler = ({
  firestore,
  rootDocumentPath,
}: {
  rootDocumentPath: string;
  firestore: FirebaseFirestore.Firestore;
}): RTE.ReaderTaskEither<never, Error, Scheduler> =>
  pipe(
    Scheduler.build({ datastore: InMemoryDataStore.factory() }),
    RTE.fromTaskEither
  );

const buildApi = ({
  firestore,
  rootDocumentPath,
}: StartProps & {
  firestore: FirebaseFirestore.Firestore;
  rootDocumentPath: string;
}): RTE.ReaderTaskEither<never, Error, Api> =>
  pipe(
    RTE.fromTaskEither(
      FirestoreApi.build({
        numProcessors: 0,
        runScheduler: false,
        rootDocumentPath,
        firestore,
      })
    )
  );
