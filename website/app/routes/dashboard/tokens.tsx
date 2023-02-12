import {
  Box,
  Button,
  Card,
  Flex,
  IconButton,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from "@chakra-ui/react";
import { LoaderArgs } from "@remix-run/server-runtime";
import { BsFillTrash2Fill } from "react-icons/bs";
import { redirect } from "react-router";
import { getUserId } from "~/session.server";

// loader that checks if the user is logged in
// if not, redirect to login page

export const loader = async ({ request }: LoaderArgs) => {
  const userId = await getUserId(request);
  console.log("userId", userId);
  if (!userId) return redirect("/login");
  return {};
};

const Document = () => {
  const bgColor = useColorModeValue("white", "gray.900");

  return (
    <Stack spacing={10} m={10}>
      <Text>Manage your API tokens from here.</Text>
      <Button w={"xs"} colorScheme={"green"}>
        Create a new API Token
      </Button>
      <Card bgColor={bgColor}>
        <Table size={"sm"}>
          <Thead>
            <Tr>
              <Th>Token</Th>
              <Th>Date Added</Th>
              <Th>Last Used</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td>•••7c25</Td>
              <Td>
                <Text isTruncated maxW="sm">
                  May 27, 2022 14:22
                </Text>
              </Td>
              <Td>seconds ago...</Td>
              <Td>
                <IconButton
                  size="xs"
                  icon={<BsFillTrash2Fill />}
                  aria-label="delete"
                />
              </Td>
            </Tr>
          </Tbody>
        </Table>
      </Card>
    </Stack>
  );
};

export default Document;
