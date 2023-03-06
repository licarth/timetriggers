import { ProjectSlug } from "@/project";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import { projectExists } from "./projectExists";

export const slugIsAvailable = ({
  projectSlug: slug,
}: {
  projectSlug: ProjectSlug;
}) => {
  if (slug.startsWith("admin") || slug.startsWith("timetriggers")) {
    return RTE.of(false);
  }

  return pipe(
    projectExists({ projectSlug: slug }),
    RTE.map((exists) => !exists)
  );
};
