import type {
  DataFunctionArgs,
  LoaderFunction,
} from "@remix-run/server-runtime";
import { te } from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function";
import type * as RTE from "fp-ts/lib/ReaderTaskEither";
import { buildDeps } from "~/buildDeps.server";
import * as TE from "fp-ts/lib/TaskEither";

export const loaderFromRte =
  <T extends DataFunctionArgs, U>(
    loaderRte: (
      args: T
    ) => RTE.ReaderTaskEither<ReturnType<typeof buildDeps>, any, U>
  ) =>
  async (args: T) => {
    const result = loaderRte(args)(buildDeps());
    return await te.unsafeGetOrThrow(result);
  };

export const actionFromRte =
  <T extends DataFunctionArgs, U>(
    rteFunc: (
      args: T
    ) => RTE.ReaderTaskEither<ReturnType<typeof buildDeps>, any, U>
  ) =>
  async (args: T) => {
    const result = rteFunc(args)(buildDeps());
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
