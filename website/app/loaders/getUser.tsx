import type { LoaderArgs } from "@remix-run/server-runtime";
import { FirebaseUser } from "@timetriggers/domain";
import * as TE from "fp-ts/lib/TaskEither";
import { requireUserId } from "~/session.server";

export const getUser = (request: LoaderArgs["request"]) =>
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
  );
