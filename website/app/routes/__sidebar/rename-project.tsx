import type { ActionFunction } from "@remix-run/server-runtime";
import { redirect } from "@remix-run/server-runtime";
import {
  projectExists,
  ProjectId,
  ProjectSlug,
  renameProject,
  rte
} from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as C from "io-ts/lib/Codec.js";
import { draw } from "io-ts/lib/Decoder";
import { getUserOrRedirect } from "~/loaders/getUserOrRedirect";
import { actionFromRte } from "~/utils/loaderFromRte.server";

const postCodec = C.struct({
  slug: ProjectSlug.codec,
  projectId: ProjectId.codec,
});

export const action: ActionFunction = ({ request }) =>
  actionFromRte(
    pipe(
      RTE.Do,
      RTE.bindW("user", () => getUserOrRedirect(request)),
      RTE.bindW("postParams", () => {
        return pipe(
          () => request.formData(),
          RTE.fromTask,
          RTE.map(Object.fromEntries),
          RTE.chainEitherK(postCodec.decode),
          rte.leftSideEffect((e) => console.log(draw(e)))
        );
      }),
      RTE.bindW("isAvailable", ({ postParams: { slug } }) =>
        pipe(
          projectExists({ projectSlug: slug }),
          RTE.map((bool) => !bool)
        )
      ),
      RTE.chainFirstW(({ isAvailable, postParams: { slug, projectId } }) =>
        isAvailable
          ? pipe(
              renameProject({ slug, projectId }),
              RTE.mapLeft(({ message }) => ({
                status: 500,
              }))
            )
          : RTE.left(redirect("/projects"))
      ),
      RTE.map(({ postParams: { slug } }) =>
        redirect(`/projects/${slug}/settings`)
      )
    )
  );
