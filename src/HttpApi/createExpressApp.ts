import { environmentVariable } from "@/environmentVariable";
import express from "express";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";

const PORT = environmentVariable("HTTP_API_PORT") || 3000;

// Start an application that listens to Firebase and triggers the job
export const createExpressApp = () => {
  const app = express();

  app.use(express.json());

  return RTE.of({
    app,
    start: () =>
      app.listen(PORT, () => {
        console.log(`Express listening at http://localhost:${PORT}`);
      }),
  });
};
