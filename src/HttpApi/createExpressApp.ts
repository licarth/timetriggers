import express from "express";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";

// Start an application that listens to Firebase and triggers the job
export const createExpressApp = (port: number) => {
  const app = express();

  app.use(express.json());

  return RTE.of({
    app,
    start: () =>
      app.listen(port, () => {
        console.log(`Express listening at http://localhost:${port}`);
      }),
  });
};
