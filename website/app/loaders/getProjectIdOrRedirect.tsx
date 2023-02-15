import { redirect } from "@remix-run/server-runtime";
import { ProjectSlug } from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";

export const getProjectSlugOrRedirect = (
  rawProjectSlug: string | undefined,
  redirectTo: string
) => {
  if (rawProjectSlug === undefined) {
    return RTE.left(redirect(redirectTo));
  }
  return pipe(
    ProjectSlug.parse(rawProjectSlug), // Parse the slug
    RTE.fromEither,
    RTE.orElseW(() => {
      return RTE.left(redirect(redirectTo));
    })
  );
};
