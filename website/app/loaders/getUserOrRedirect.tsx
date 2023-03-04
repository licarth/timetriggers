import type { LoaderArgs } from "@remix-run/server-runtime";
import { redirect } from "@remix-run/server-runtime";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { getUser } from "./getUser";

export const getUserOrRedirect = (
  request: LoaderArgs["request"],
  redirectTo?: string
) =>
  pipe(
    getUser(request),
    RTE.orElse(() => RTE.left(redirect(redirectTo || "login"))),
    RTE.chainW((user) =>
      user === null
        ? RTE.left(redirect(redirectTo || "login"))
        : RTE.right(user)
    )
  );
