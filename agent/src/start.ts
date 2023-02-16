import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import { Api } from "./Api";
import { AxiosWorkerPool } from "./AxiosWorkerPool";
import { CoordinationClient } from "./Coordination/CoordinationClient";
import { ZookeeperCoordinationClient } from "./Coordination/ZookeeperCoordinationClient";
import { DatastoreApi } from "./Firebase/DatastoreApi";
import { initializeApp } from "./Firebase/initializeApp";
import { Datastore } from "./Firebase/Processor/Datastore";
import { FirestoreDatastore } from "./Firebase/Processor/FirestoreDatastore";
import { Processor } from "./Firebase/Processor/Processor";
import { Scheduler } from "./Firebase/Processor/Scheduler";
import { te } from "./fp-ts";
import { HttpApi, initializeHttpApi } from "./HttpApi/initializeHttpApi";

type StartProps = {
  namespace: string;
  api: {
    enabled: boolean;
  };
  httpApi?: {
    enabled: boolean;
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
      rootDocumentPath: `/namespaces/${props.namespace}/jobs/by-status`,
    }),
    RTE.bind("datastore", ({ firestore, rootDocumentPath }) =>
      RTE.of(
        new FirestoreDatastore({
          firestore,
          rootDocumentPath,
        })
      )
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
      props.scheduler?.enabled
        ? RTE.fromTaskEither(
            Processor.build({
              datastore,
              coordinationClient,
              workerPool: new AxiosWorkerPool({
                minSize: 1,
                maxSize: 5,
              }),
            })
          )
        : RTE.of(undefined)
    ),
    RTE.bindW("httpApi", ({ api, firestore }) =>
      api && props.httpApi?.enabled
        ? pipe(
            initializeHttpApi({
              api,
              port: props.httpApi?.port,
              firestore,
              namespace: props.namespace,
            }),
            RTE.map((x) => x.httpApi)
          )
        : RTE.of(undefined)
    ),
    RTE.chainFirstTaskEitherKW(listenToProcessTermination)
  );

export const startScheduler = ({
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
  datastore,
}: StartProps & {
  datastore: Datastore;
}): RTE.ReaderTaskEither<never, Error, Api> =>
  pipe(
    RTE.of(
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
