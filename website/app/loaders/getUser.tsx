import type { LoaderArgs } from "@remix-run/server-runtime";
import { FirebaseUser } from "@timetriggers/domain";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { requireUserId } from "~/session.server";
import { pipe } from "fp-ts/lib/function";

export const getUser = (request: LoaderArgs["request"]) =>
  pipe(
    TE.tryCatch(
      async () => {
        const decodedIdToken = await requireUserId(request);
        if (decodedIdToken === null) {
          return null;
        } else {
          return FirebaseUser.fromDecodedIdToken(decodedIdToken);
        }
      },
      (error) => {
        console.error(`Could not get user: ${error}`);
        return new Error(`Could not get user: ${error}`);
      }
    ),
    RTE.fromTaskEither
  );
