import { pipe } from "fp-ts/lib/function.js";
import { FirestoreApi } from "./Firebase/FirestoreApi";
import * as TE from "fp-ts/lib/TaskEither.js";
import { te } from "./fp-ts";
import { Api } from "./Api";
import { initializeApp } from "./Firebase/initializeApp";
import { launchProcessor as launchProcessorAndScheduler } from "./launchProcessor";
import { FirestoreScheduler } from "./Firebase/FirestoreScheduler";
import { FirestoreProcessor } from "./Firebase/FirestoreProcessor";

const listenToProcessTermination = ({
  api,
  scheduler,
  processor,
}: {
  api: Api;
  scheduler?: FirestoreScheduler;
  processor?: FirestoreProcessor;
}) =>
  pipe(
    TE.tryCatch(
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
      (e) => void 0 // Never happens (Promise never rejects)
    ),
    TE.chain(() => api.close()) // TODO: close schedulers and processors too.
  );

const rootDocumentPath = process.env.ROOT_DOCUMENT_PATH || `/local-dev/tasks`;

(async () => {
  await te.unsafeGetOrThrow(
    pipe(
      FirestoreApi.build({
        numProcessors: 0,
        runScheduler: false,
        rootDocumentPath,
        firestore: initializeApp({
          serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
        }).firestore,
      }),
      TE.chainFirstW((api) =>
        launchProcessorAndScheduler(
          api,
          rootDocumentPath,
          process.env.ZOOKEEPER_NAMESPACE || "/local-dev"
        )
      ),
      TE.chain((api) => pipe({ api }, listenToProcessTermination)),
      TE.foldW(
        (e) => {
          console.error(e);
          return TE.of(undefined);
        },
        (api) => {
          return TE.of(api);
          // Do nothing
        }
      )
    )
  );
  //  Keep running until the user presses Ctrl+C
})();
