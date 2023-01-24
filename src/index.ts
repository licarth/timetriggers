import { pipe } from "fp-ts/lib/function.js";
import { FirestoreApi } from "./Firebase/FirestoreApi";
import * as TE from "fp-ts/lib/TaskEither.js";
import { te } from "./fp-ts";
import { Api } from "./Api";
import { initializeApp } from "./Firebase/initializeApp";

const listenToProcessTermination = (api: Api) =>
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
    TE.chain(() => api.close())
  );

(async () => {
  await te.unsafeGetOrThrow(
    pipe(
      FirestoreApi.build({
        numProcessors: 10,
        runScheduler: true,
        rootDocumentPath: "/local-dev/tasks",
        firestore: initializeApp({
          serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
        }).firestore,
      }),
      TE.chain((api) => pipe(api, listenToProcessTermination)),
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
