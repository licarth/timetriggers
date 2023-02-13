import * as A from "fp-ts/lib/Array.js";
import * as E from "fp-ts/lib/Either.js";
import { Lazy, pipe } from "fp-ts/lib/function.js";
import * as T from "fp-ts/lib/Task.js";
import * as TE from "fp-ts/lib/TaskEither.js";

export namespace te {
  export const sideEffect = <T>(sideEffect: (o: T) => void) =>
    TE.chainFirstEitherKW((o: T) => {
      sideEffect(o);
      return E.of(void 0);
    });

  export const unsafeGetOrThrow = async <T>(
    taskEither: TE.TaskEither<unknown, T>
  ): Promise<T> => {
    return pipe(
      taskEither,
      TE.getOrElse((error) => {
        throw error;
      })
    )();
  };

  export const getOrLog = async <T>(
    taskEither: TE.TaskEither<unknown, T>
  ): Promise<T | undefined> => {
    return pipe(
      taskEither,
      TE.getOrElseW((error) => {
        console.error(error);
        return T.of(undefined);
      })
    )();
  };

  export const tryCatchNeverFails = <T>(
    task: Lazy<Promise<T>>,
    sideEffect: (reason: unknown) => void
  ) => {
    return pipe(
      ignoreErrors(TE.tryCatch(task, (reason) => sideEffect(reason))),
      TE.map(() => void 0 as void)
    );
  };

  export const ignoreErrors = <T>(taskEither: TE.TaskEither<unknown, T>) => {
    return pipe(
      taskEither,
      TE.orElseW(() => TE.of(void 0 as void))
    );
  };

  export const executeAllInArray =
    ({ parallelism = 1 }: { parallelism?: number } = {}) =>
    <E, A>(arrayOfTe: Array<TE.TaskEither<E, A>>) => {
      return pipe(arrayOfTe, batchTasks(parallelism), mergeFn);
    };

  export const repeatUntil =
    <T>(
      predicate: (result: T) => boolean,
      { maxAttempts }: { maxAttempts: number } = { maxAttempts: 100 }
    ) =>
    (taskEither: TE.TaskEither<Error, T>) => {
      let attempts = 0;
      const loop = (): TE.TaskEither<Error, T> => {
        return pipe(
          taskEither,
          TE.chain((result) => {
            if (attempts++ >= maxAttempts) {
              return TE.left(new Error("Max attempts reached"));
            }
            // console.log(`current value is ${result}`);
            if (predicate(result)) {
              return TE.right(result);
            }
            return loop();
          })
        );
      };
      return loop();
    };
}

const batchTasks =
  <A>(limit: number) =>
  (tasks: Array<T.Task<A>>): T.Task<Array<A>> =>
    pipe(
      tasks,
      A.chunksOf(limit),
      A.map(A.sequence(T.ApplicativePar)),
      A.sequence(T.ApplicativeSeq),
      T.map(A.flatten)
    );

const mergeFn = <E, A>(te: T.Task<E.Either<E, A>[]>) => {
  return pipe(
    te,
    T.map((te) => {
      const separated = A.separate(te);
      return { errors: separated.left, successes: separated.right };
    })
  );
};
