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

  export const leftSideEffect = <E>(sideEffect: (e: E) => any) =>
    RTE.mapLeft((e: E) => {
      sideEffect(e);
      return e;
    });

  export const unsafeGetOrThrow = <R, T>(
    readerTaskEither: RTE.ReaderTaskEither<R, unknown, T>
  ) => {
    return pipe(
      readerTaskEither,
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

  export const apSWMerge: <A, R2, E2, B>(
    fb: RTE.ReaderTaskEither<R2, E2, B>
  ) => <R1, E1>(
    fa: RTE.ReaderTaskEither<R1, E1, A>
  ) => RTE.ReaderTaskEither<R1 & R2, E1 | E2, A & B> = (fb) => (fa) =>
    //@ts-ignore
    pipe(
      fa,
      //@ts-ignore
      RTE.apSW("___SomeRandomName___", fb), // cannot use a Symbol
      RTE.map(({ ___SomeRandomName___, ...rest }) => ({
        ...rest,
        ...___SomeRandomName___,
      }))
    );

  export const bindWMerge: <A, R2, E2, B>(
    f: (a: A) => RTE.ReaderTaskEither<R2, E2, B>
  ) => <R1, E1>(
    fa: RTE.ReaderTaskEither<R1, E1, A>
  ) => RTE.ReaderTaskEither<R1 & R2, E1 | E2, A & B> = (f) => (fa) =>
    //@ts-ignore
    pipe(
      fa,
      //@ts-ignore
      RTE.bindW("___SomeRandomName___", (a: A) => f(a)), // cannot use a Symbol
      RTE.map(({ ___SomeRandomName___, ...rest }) => ({
        ...rest,
        ...___SomeRandomName___,
      }))
    );
}
