import { useLoaderData } from "@remix-run/react";
import { redirect } from "@remix-run/server-runtime";
import type { Project } from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { getProjectIdOrRedirect } from "~/loaders/getProjectIdOrRedirect";
import { getProjectOrRedirect } from "~/loaders/getProjectOrRedirect";
import { getUserOrRedirect } from "~/loaders/getUserOrRedirect";
import { loaderFromRte } from "~/utils/loaderFromRte";

export const loader = loaderFromRte(({ params, request }) =>
  pipe(
    RTE.Do,
    RTE.bind("projectId", () =>
      getProjectIdOrRedirect(params.projectId, "projects")
    ),
    RTE.bind("user", () => getUserOrRedirect(request)),
    (x) => x,
    RTE.bindW("project", ({ projectId }) =>
      getProjectOrRedirect({ projectId }, "..")
    ),
    RTE.map(({ user, project }) => {
      if (project && project.isReader(user.id)) {
        return { project };
      } else {
        return redirect("..");
      }
    })
  )
);

export default () => {
  const p = useLoaderData<{ project: Project }>();
  const { project } = p;
  return (
    <div>
      <h1>{project.id}</h1>
    </div>
  );
};
