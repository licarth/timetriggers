import * as Sentry from "@sentry/node";
import { pipe } from "fp-ts/lib/function.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import * as T from "fp-ts/lib/Task.js";

// const transaction = Sentry.startTransaction({
//   op: "test",
//   name: "My First Test Transaction",
// });
// setTimeout(() => {
//   try {
//     foo();
//   } catch (e) {
//     Sentry.captureException(e);
//   } finally {
//     // transaction.finish();
//   }
// }, 99);

export const getOrReportToSentry = async <T>(
  taskEither: TE.TaskEither<unknown, T>
): Promise<T | undefined> => {
  return pipe(
    taskEither,
    TE.getOrElseW((e) => {
      console.error(e);
      Sentry.captureException(e);
      return T.of(undefined);
    })
  )();
};
