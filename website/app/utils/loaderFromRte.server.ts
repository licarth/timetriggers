import { te } from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function";
import type * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import { buildDeps } from "~/buildDeps.server";

export const loaderFromRte = async <U>(
  rte: RTE.ReaderTaskEither<ReturnType<typeof buildDeps>, any, U>
) => {
  const result = rte(buildDeps());
  return await te.unsafeGetOrThrow(result);
};

export const actionFromRte = async <U>(
  rte: RTE.ReaderTaskEither<ReturnType<typeof buildDeps>, any, U>
) => {
  const result = rte(buildDeps());
  return await te.unsafeGetOrThrow(
    pipe(
      result,
      TE.mapLeft((e) => {
        // TODO if this is a DecodeError, we want to draw it properly
        return e;
      })
    )
  );
};
