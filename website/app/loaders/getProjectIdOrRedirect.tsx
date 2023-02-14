import { redirect } from "@remix-run/server-runtime";
import { ProjectId } from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";

export const getProjectIdOrRedirect = (
  projectId: string | undefined,
  redirectTo: string
) => {
  console.log("getProjectIdOrRedirect", projectId);
  if (projectId === undefined) {
    return RTE.left(redirect(redirectTo));
  }
  return pipe(ProjectId.parse(projectId), RTE.fromEither);
};
