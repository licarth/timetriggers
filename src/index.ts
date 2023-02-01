import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import "source-map-support/register.js";
import { Api } from "./Api";
import { environmentVariable } from "./environmentVariable";
import { FirestoreApi } from "./Firebase/FirestoreApi";
import { FirestoreProcessor } from "./Firebase/FirestoreProcessor";
import { FirestoreScheduler } from "./Firebase/FirestoreScheduler";
import { initializeApp } from "./Firebase/initializeApp";
import { te } from "./fp-ts";
import { launchProcessor as launchProcessorAndScheduler } from "./launchProcessor";
import { start } from "./start";

if (process.env.NEW_RELIC_KEY) {
  console.log("✅ New Relic is enabled");
} else {
  console.log("⚠️ New Relic is disabled");
}

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
  const namespace = environmentVariable("NAMESPACE") || "local-dev";
  if (environmentVariable("HTTP_API_ONLY") === "true") {
    console.log("HTTP_API_ONLY is set, not starting the processor");
    await te.unsafeGetOrThrow(
      start({
        namespace,
        api: {
          enabled: true,
        },
        scheduler: {
          enabled: false,
        },
        processor: {
          enabled: false,
        },
        httpApi: {
          enabled: true,
          port: Number(environmentVariable("HTTP_API_PORT")) || 3000,
        },
      })(undefined as never)
    );
    return;
  } else if (environmentVariable("NEW_SCHEDULER") === "true") {
    console.log("NEW_SCHEDULER is set");
    await te.unsafeGetOrThrow(
      start({
        namespace,
        api: {
          enabled: true,
        },
        scheduler: {
          enabled: true,
        },
        httpApi: {
          enabled: true,
          port: Number(environmentVariable("HTTP_API_PORT")) || 3000,
        },
      })(undefined as never)
    );
    return;
  }
})();
