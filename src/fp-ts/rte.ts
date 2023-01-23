import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as T from "fp-ts/lib/Task.js";

export namespace rte {
  export const sideEffect = <T>(sideEffect: (o: T) => void) =>
    RTE.chainFirstEitherKW((o: T) => {
      sideEffect(o);
      return E.of(void 0);
    });

  export const unsafeGetOrThrow = <R, T>(
    taskEither: RTE.ReaderTaskEither<R, unknown, T>
  ) => {
    return pipe(
      taskEither,
      RTE.getOrElse((reason) => {
        throw reason;
      })
    );
  };

  export const askDeps = <DepsType>() => RTE.ask<DepsType>();

  export const bindDeps = <DepsType>() =>
    RTE.bindW("deps", () => askDeps<DepsType>());

  export const finallyTask =
    <R, E, A>(task: T.Task<any>) =>
    (rte: RTE.ReaderTaskEither<R, E, A>): RTE.ReaderTaskEither<R, E, A> => {
      return pipe(
        rte,
        RTE.chainFirst((a) => RTE.fromTask(task))
      );
    };
}
