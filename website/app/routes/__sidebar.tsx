import { Container, Flex, useColorModeValue } from "@chakra-ui/react";
import { Outlet, useLoaderData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/server-runtime";
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
import { Sidebar } from "~/components/Sidebar/Sidebar";
import * as C from "io-ts/lib/Codec.js";
import styled from "@emotion/styled";

const wireCodec = C.struct({
  projects: C.array(Project.codec("string")),
  user: FirebaseUser.codec,
});

export default () => {
  const { projects, user } = e.unsafeGetOrThrow(
    pipe(useLoaderData(), wireCodec.decode)
  );

  return (
    <StyledFlex flexDir={"row"} maxW="full">
      <Sidebar user={user} projects={projects} />
      <Flex
        overflow="scroll"
        direction={"column"}
        flexGrow="1"
        justifyContent="space-between"
      >
        <Container
          maxW={{ base: "70vw", md: "full" }}
          py={{ base: "6", md: "12" }}
          px={{ base: "0", sm: "8" }}
        >
          <Outlet />
        </Container>
        <Footer />
      </Flex>
    </StyledFlex>
  );
};

export const loader: LoaderFunction = async ({ request }) =>
  loaderFromRte(
    pipe(
      RTE.Do,
      RTE.bindW("user", () => getUserOrRedirect(request, "/login")),
      RTE.bindW("projects", ({ user }) => getProjectsForUser(user.id)),
      RTE.map(({ projects, user }) => wireCodec.encode({ projects, user }))
    )
  );

const StyledFlex = styled(Flex)`
  height: 100%;
  height: 100vh;

  /* mobile viewport bug fix */
  height: -webkit-fill-available;

  /* See 
  https://allthingssmitty.com/2020/05/11/css-fix-for-100vh-in-mobile-webkit/
  and https://github.com/chakra-ui/chakra-ui/issues/6027 */
`;
