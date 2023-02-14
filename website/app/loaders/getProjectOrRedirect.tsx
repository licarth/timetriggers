import { redirect } from "@remix-run/server-runtime";
import type { ProjectId } from "@timetriggers/domain";
import { getProject } from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";

export const getProjectOrRedirect = (
  { projectId }: { projectId: ProjectId },
  redirectTo: string
) =>
  pipe(
    getProject({ projectId }),
    RTE.orElse(() => RTE.left(redirect(redirectTo)))
  );
