import { Api } from "@/Api";
import { rte } from "@/fp-ts";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import { createExpressApp } from "./createExpressApp";
import { initializeEndpoints } from "./initializeExpressEndpoints";

export const initializeHttpApi = (api: Api) =>
  pipe(
    RTE.of(api),
    RTE.bindW("expressApp", () => createExpressApp()),
    RTE.chainFirstW(({ expressApp: { app } }) =>
      initializeEndpoints({ app, api })
    ),
    rte.sideEffect(({ expressApp: { start } }) => start())
  );
