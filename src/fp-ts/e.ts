import { Either, foldW } from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as E from "fp-ts/lib/Either.js";
import * as A from "fp-ts/lib/Array.js";

export namespace e {
  export const unsafeGetOrThrow = <T>(either: Either<unknown, T>): T => {
    return pipe(
      either,
      foldW(
        (error) => {
          throw error;
        },
        (value) => value
      )
    );
  };

  export const split = <E, A>(arrayOfTe: Array<E.Either<E, A>>) => {
    return pipe(arrayOfTe, mergeFn);
  };
}

const mergeFn = <E, A>(eithers: E.Either<E, A>[]) => {
  return pipe(eithers, (eithers) => {
    const separated = A.separate(eithers);
    return { errors: separated.left, successes: separated.right };
  });
};
