import type {
  DataFunctionArgs,
  LoaderFunction,
} from "@remix-run/server-runtime";
import { te } from "@timetriggers/domain";
import type * as RTE from "fp-ts/lib/ReaderTaskEither";
import { buildDeps } from "~/buildDeps.server";

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
