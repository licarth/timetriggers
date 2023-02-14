import { Box, Card, Flex, Heading, useColorModeValue } from "@chakra-ui/react";
import { Link, useLoaderData } from "@remix-run/react";
import type { FirebaseUserId } from "@timetriggers/domain";
import { getProjectsForUser, te } from "@timetriggers/domain";
import { environmentVariable } from "~/environmentVariable";
import { initializeApp } from "~/initializeFirebaseNode.server";

export const loader = async () => {
  const { firestore, auth } = initializeApp();
  const namespace = environmentVariable("PUBLIC_NAMESPACE");

  // // Create a default project if user does not already have one.
  console.log("namespace", namespace);
  const projects = await te.unsafeGetOrThrow(
    getProjectsForUser({
      _tag: "FirebaseUserId",
      id: "3awfh5hhDUYtWqzvRSvXTFvQT0I2",
    } as unknown as FirebaseUserId)({
      firestore,
      namespace: environmentVariable("PUBLIC_NAMESPACE"),
      auth,
    })
  );
  return { projects };
};

const Document = () => {
  const { projects } = useLoaderData<typeof loader>();

  const bgColor = useColorModeValue("white", "gray.800");
  return (
    <Flex bgColor={bgColor}>
      {projects.map((project) => (
        <Card m="5" p={10} size="sm" key={project.id}>
          <Heading size="sm">
            <Link to={project.id}>{String(project.id)}</Link>
          </Heading>
        </Card>
      ))}
    </Flex>
  );
};

export default Document;