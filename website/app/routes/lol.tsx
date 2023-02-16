// import type { LoaderFunction } from "@remix-run/server-runtime";
// import { redirect } from "@remix-run/server-runtime";
// import { requireUserId } from "~/session.server";

// export const loader: LoaderFunction = async ({ request }) => {
//   const user = await requireUserId(request);
//   if (user) {
//     return redirect("/projects");
//   } else {
//     return redirect("/login");
//   }
// };
import { Flex } from "@chakra-ui/react";
import { Outlet, useLoaderData } from "@remix-run/react";
import { LoaderFunction, redirect } from "@remix-run/server-runtime";
import {
  e,
  FirebaseUser,
  getProjectsForUser,
  Project,
} from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { Footer } from "~/components/footer/Footer";
import { getUserOrRedirect } from "~/loaders/getUserOrRedirect";
import { loaderFromRte } from "~/utils/loaderFromRte.server";
import { Sidebar } from "../components/Sidebar/Sidebar";
import * as C from "io-ts/lib/Codec.js";

const wireCodec = C.struct({
  projects: C.array(Project.codec("string")),
  user: FirebaseUser.codec,
});

const Root = () => {
  const { projects, user } = e.unsafeGetOrThrow(
    pipe(useLoaderData(), wireCodec.decode)
  );

  return (
    <Flex flexDir={"row"}>
      <Sidebar user={user} projects={projects} />
      <Content />
    </Flex>
  );
};

const Content = () => {
  return (
    <Flex direction={"column"} flexGrow="1" justifyContent="space-between">
      <Outlet />
      <Footer />
    </Flex>
  );
};

export default Root;

export const loader: LoaderFunction = async ({ request }) =>
  loaderFromRte(
    pipe(
      RTE.Do,
      RTE.bindW("user", () => getUserOrRedirect(request, "/login")),
      RTE.bindW("projects", ({ user }) => getProjectsForUser(user.id)),
      RTE.map(({ projects, user }) => wireCodec.encode({ projects, user }))
    )
  );