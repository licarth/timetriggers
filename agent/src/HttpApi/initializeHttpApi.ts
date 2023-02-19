import { Api } from "@/Api";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import { createExpressApp } from "./createExpressApp";
import { initializeEndpoints } from "./initializeExpressEndpoints";
import { Clock } from "@timetriggers/domain";

export const initializeHttpApi = ({
  api,
  port,
  firestore,
  namespace,
}: {
  api: Api;
  port: number;
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
}) =>
  pipe(
    RTE.of({ api }),
    RTE.bind("clock", () =>
      pipe(
        RTE.ask<{ clock: Clock }>(),
        RTE.map(({ clock }) => clock)
      )
    ),
    RTE.bindW("expressApp", () => createExpressApp(port)),
    RTE.chainFirstW(({ clock, expressApp: { app } }) =>
      initializeEndpoints({ app, api, firestore, namespace, clock })
    ),
    RTE.bindW("httpApi", function ({ expressApp: { start } }) {
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
    })
  );

export type HttpApi = { close: () => TE.TaskEither<Error, void> };
