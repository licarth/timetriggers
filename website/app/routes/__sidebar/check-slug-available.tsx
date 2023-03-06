import type { LoaderFunction } from "@remix-run/server-runtime";
import { redirect } from "@remix-run/server-runtime";
import type { ProjectSlug } from "@timetriggers/domain";
import { projectExists } from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as C from "io-ts/lib/Codec.js";
import { getUserOrRedirect } from "~/loaders/getUserOrRedirect";
import { loaderFromRte } from "~/utils/loaderFromRte.server";

const wireCodec = C.struct({
  isAvailable: C.boolean,
});

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const params = url.searchParams;

  const slug = params.get("slug") as ProjectSlug | undefined;

  if (!slug) {
    return redirect("/projects");
  }

  if (
    slug.length <= 4 ||
    slug.length > 30 ||
    slug.startsWith("admin") ||
    slug.startsWith("timetriggers")
  ) {
    return {
      isAvailable: false,
    };
  }

  return loaderFromRte(
    pipe(
      RTE.Do,
      RTE.bind("user", () => getUserOrRedirect(request)),
      RTE.bindW("isAvailable", () =>
        pipe(
          projectExists({ projectSlug: slug }),
          RTE.map((bool) => !bool)
        )
      ),
      RTE.map(wireCodec.encode)
    )
  );
};
