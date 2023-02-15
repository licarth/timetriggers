import { Button, Code, Container, Stack, Text } from "@chakra-ui/react";
import { Logo } from "~/components/Logo";
import type { ActionFunction, LoaderFunction } from "@remix-run/server-runtime";
import { redirect } from "@remix-run/server-runtime";
import {
  createProject,
  e,
  projectExists,
  ProjectSlug,
} from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";
import { getUserOrRedirect } from "~/loaders/getUserOrRedirect";
import { actionFromRte, loaderFromRte } from "~/utils/loaderFromRte.server";
import { useLoaderData } from "react-router";

export const loader: LoaderFunction = ({ request }) =>
  loaderFromRte(
    pipe(
      getUserOrRedirect(request, "/login"),
      RTE.map(() => {
        const randomName = uniqueNamesGenerator({
          dictionaries: [adjectives, colors, animals],
        });

        return randomName;
      }),
      // Check that the name is not already taken
      RTE.chainFirstW((name) =>
        pipe(
          projectExists({
            projectSlug: e.unsafeGetOrThrow(ProjectSlug.parse(name)),
          }),
          //   RTE.orElse(() => RTE.right(undefined)), // If not exists, continue
          RTE.chainW((exists) =>
            exists ? RTE.left(redirect("")) : RTE.of(name)
          ) // If exists, retry (via redirect)
        )
      )
    )
  );

export const action: ActionFunction = ({ params, request }) =>
  actionFromRte(
    pipe(
      RTE.Do,
      RTE.bindW("creator", () => getUserOrRedirect(request, "/login")),
      RTE.bindW("slug", () =>
        pipe(
          async () => (await request.formData()).get("projectName")?.toString(),
          RTE.fromTask,
          RTE.map((x) => x),
          RTE.filterOrElseW(
            (slug) => slug !== undefined,
            () => RTE.left("Slug is undefined")
          ),
          RTE.chainEitherKW((slug) => ProjectSlug.parse(slug!)) // @licarth we should be able to remove the `!` here, but it does not infer for some reason
        )
      ),
      RTE.chainFirstW(({ slug, creator }) =>
        createProject({
          slug,
          creator: creator.id,
        })
      ),
      RTE.map(({ slug }) => redirect(`/projects/${slug}`))
    )
  );

export default () => {
  const name = useLoaderData() as string;

  return (
    <Container
      maxW="full"
      py={{ base: "12", md: "24" }}
      // px={{ base: "0", sm: "8" }}
    >
      <Stack align="center" spacing={8}>
        <Text fontSize={30}>
          Welcome to <Logo fontSize="30" /> !
        </Text>
        <Text>
          It's now time to create your first project ! Give it a name, or we'll
          call it <Code>{name}</Code> for you ! (you can change it later)
        </Text>
        <form method="post">
          {/* Hidden input field for name */}
          <input type="hidden" name="projectName" value={name} />
          <Button w="xs" colorScheme="green" type="submit">
            Create project 🎉
          </Button>
        </form>
      </Stack>
    </Container>
  );
};
