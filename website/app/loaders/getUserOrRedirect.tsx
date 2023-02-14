import type { LoaderArgs } from "@remix-run/server-runtime";
import { redirect } from "@remix-run/server-runtime";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { getUser } from "./getUser";

export const getUserOrRedirect = (request: LoaderArgs["request"]) =>
  pipe(
    getUser(request),
    RTE.fromTaskEither,
    RTE.orElse(() => RTE.left(redirect("login"))),
    RTE.chainW((user) =>
      user === null ? RTE.left(redirect("login")) : RTE.right(user)
    )
  );
