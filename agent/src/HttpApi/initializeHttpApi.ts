import { Api } from "@/Api";
import { ProductionDatastore } from "@/Firebase/Processor/Datastore";
import { Clock } from "@timetriggers/domain";
import type { Express } from "express";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { createExpressApp } from "./createExpressApp";
import { initializeEndpoints } from "./initializeExpressEndpoints";

export const initializeHttpApi = ({
  api,
  port,
  firestore,
  namespace,
  datastore,
}: {
  api: Api;
  port: number;
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
  datastore: ProductionDatastore;
}) =>
  pipe(
    RTE.of({ api }),
    RTE.apS(
      "clock",
      pipe(
        RTE.ask<{ clock: Clock }>(),
        RTE.map(({ clock }) => clock)
      )
    ),
    RTE.apSW("expressApp", createExpressApp(port)),
    RTE.chainFirstW(({ clock, expressApp: { app } }) =>
      initializeEndpoints({ app, api, firestore, namespace, clock, datastore })
    ),
    RTE.bindW("httpApi", ({ expressApp: { start } }) => startExpressApp(start))
  );

const startExpressApp = (start: () => ReturnType<Express["listen"]>) => {
  const server = start();
  return RTE.of({
    close: () =>
      TE.tryCatch(
        () => {
          console.log("🔸 Closing Express HttpApi...");
          return new Promise<void>((resolve, reject) =>
            server.close((err) => {
              if (err) {
                reject(err);
              } else {
                console.log("✅ express HttpApi closed.");
                resolve();
              }
            })
          );
        },
        (e) => new Error(`Failed to close HTTP API: ${e}`)
      ),
  });
};

export type HttpApi = { close: () => TE.TaskEither<Error, void> };
