import { redirect } from "@remix-run/server-runtime";
import type { ProjectSlug } from "@timetriggers/domain";
import { getProjectBySlug } from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";

export const getProjectBySlugOrRedirect = (
  { projectSlug }: { projectSlug: ProjectSlug },
  redirectTo: string
) =>
  pipe(
    getProjectBySlug({ projectSlug }),
    RTE.orElse(() => RTE.left(redirect(redirectTo)))
  );
