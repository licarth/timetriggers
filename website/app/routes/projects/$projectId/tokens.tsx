import {
  Button,
  Card,
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
import { BsFillTrash2Fill } from "react-icons/bs";

export const loader = async () => {
  // Get project details
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
              <Td>seconds ago</Td>
              <Td>
                <IconButton
                  size="xs"
                  icon={<BsFillTrash2Fill />}
                  aria-label="delete"
                  colorScheme={"red"}
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
