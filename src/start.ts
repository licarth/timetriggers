import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import { Api } from "./Api";
import { AxiosWorkerPool } from "./AxiosWorkerPool";
import { CoordinationClient } from "./Coordination/CoordinationClient";
import { ZookeeperCoordinationClient } from "./Coordination/ZookeeperCoordinationClient";
import { environmentVariable } from "./environmentVariable";
import { DatastoreApi } from "./Firebase/DatastoreApi";
import { FirestoreApi } from "./Firebase/FirestoreApi";
import { initializeApp } from "./Firebase/initializeApp";
import { Datastore } from "./Firebase/Processor/Datastore";
import { InMemoryDataStore } from "./Firebase/Processor/InMemoryDataStore";
import { Processor } from "./Firebase/Processor/Processor";
import { Scheduler } from "./Firebase/Processor/Scheduler";
import { te } from "./fp-ts";
import { HttpApi, initializeHttpApi } from "./HttpApi/initializeHttpApi";

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
    RTE.bind("datastore", ({ firestore, rootDocumentPath }) =>
      RTE.of(InMemoryDataStore.factory())
    ),
    RTE.bindW("api", (other) =>
      props.api.enabled ? buildApi({ ...props, ...other }) : RTE.of(undefined)
    ),
    RTE.bindW("coordinationClient", () =>
      props.scheduler?.enabled || props.processor?.enabled
        ? RTE.fromTaskEither(
            ZookeeperCoordinationClient.build({
              namespace: `/${props.namespace}`,
            })
          )
        : RTE.of(undefined)
    ),
    RTE.bindW(
      "scheduler",
      ({ firestore, rootDocumentPath, coordinationClient, datastore }) =>
        props.scheduler?.enabled
          ? startScheduler({
              rootDocumentPath,
              firestore,
              coordinationClient,
              datastore,
            })
          : RTE.of(undefined)
    ),
    RTE.bindW("processor", ({ coordinationClient, datastore }) =>
      RTE.fromTaskEither(
        Processor.build({
          datastore,
          coordinationClient,
          workerPool: new AxiosWorkerPool({
            minSize: 1,
            maxSize: 1,
          }),
        })
      )
    ),
    RTE.bindW("httpApi", ({ api }) =>
      api
        ? pipe(
            initializeHttpApi(api),
            RTE.map((x) => x.httpApi)
          )
        : RTE.of(undefined)
    ),
    RTE.chainFirstTaskEitherKW(listenToProcessTermination)
  );

export const startScheduler = ({
  firestore,
  rootDocumentPath,
  coordinationClient,
  datastore,
}: {
  rootDocumentPath: string;
  firestore: FirebaseFirestore.Firestore;
  coordinationClient?: CoordinationClient;
  datastore: Datastore;
}): RTE.ReaderTaskEither<never, Error, Scheduler> =>
  pipe(
    Scheduler.build({
      datastore,
      coordinationClient,
    }),
    RTE.fromTaskEither
  );

const buildApi = ({
  // firestore,
  // rootDocumentPath,
  datastore,
}: StartProps & {
  // firestore: FirebaseFirestore.Firestore;
  // rootDocumentPath: string;
  datastore: Datastore;
}): RTE.ReaderTaskEither<never, Error, Api> =>
  pipe(
    RTE.of(
      // FirestoreApi.build({
      //   numProcessors: 0,
      //   runScheduler: false,
      //   rootDocumentPath,
      //   firestore,
      // })
      new DatastoreApi({
        datastore,
      })
    )
  );

type Resources = {
  api?: Api;
  scheduler?: Scheduler;
  httpApi?: HttpApi;
  processor?: Processor;
  datastore?: Datastore;
  coordinationClient?: CoordinationClient;
};

const listenToProcessTermination = (resources: Resources) =>
  pipe(
    () =>
      new Promise((resolve) => {
        process.on(
          "SIGINT",
          pipe(() => {
            console.log("Caught interrupt signal");
            resolve(undefined);
          })
        );
      }),
    TE.fromTask,
    TE.map(
      () =>
        _.filter(
          (
            ["api", "scheduler", "httpApi", "processor"] as (keyof Resources)[]
          ).map((name) => ({ r: resources[name], name })),
          ({ r }) => !_.isNil(r)
        ).map(({ r, name }) => withMessage(r!.close(), name)) as TE.TaskEither<
          Error,
          void
        >[]
    ),
    TE.chainTaskK(te.executeAllInArray({ parallelism: Infinity })),
    TE.map(({ errors, successes }) => {
      console.log(`✅ closed ${successes.length} resources`);
      if (errors.length > 0) {
        console.error("Errors while closing", errors);
      }
    }),
    TE.chainW(() =>
      resources.datastore
        ? withMessage(resources.datastore.close(), "datastore")
        : TE.right(undefined)
    ),
    TE.chainW(() =>
      resources.coordinationClient
        ? withMessage(
            resources.coordinationClient.close(),
            "coordinationClient"
          )
        : TE.right(undefined)
    )
  );

const withMessage = <A>(task: TE.TaskEither<Error, A>, name: string) => {
  console.log(`🔸 Closing ${name}...`);
  return pipe(
    task,
    te.sideEffect(() => console.log(`✅ ${name} closed.`))
  );
};
