import type { LoaderFunction} from "@remix-run/server-runtime";
import { json, redirect } from "@remix-run/server-runtime";
import { ProjectSlug, slugIsAvailable } from "@timetriggers/domain";
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

  const slugString = params.get("slug");

  if (!slugString) {
    return redirect("/projects");
  }

  return loaderFromRte(
    pipe(
      RTE.Do,
      RTE.bindW("user", () => getUserOrRedirect(request)),
      RTE.bindW("slug", () =>
        pipe(
          slugString,
          ProjectSlug.parse,
          RTE.fromEither,
          RTE.mapLeft(() =>
            json(
              { isAvailable: false, message: "slug is not valid" },
              { status: 400 }
            )
          )
        )
      ),
      RTE.bindW("isAvailable", ({ slug }) =>
        slugIsAvailable({ projectSlug: slug })
      ),
      RTE.map(wireCodec.encode)
    )
  );
};
