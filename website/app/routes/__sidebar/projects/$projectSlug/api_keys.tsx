import {
  Box,
  CardHeader,
  Heading,
  ListItem,
  ModalProps,
  OrderedList,
  UnorderedList,
} from "@chakra-ui/react";
import {
  Alert,
  AlertIcon,
  Button,
  Card,
  CardBody,
  Code,
  HStack,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useLoaderData, useNavigate } from "@remix-run/react";
import type { ActionFunction, LoaderFunction } from "@remix-run/server-runtime";
import { redirect } from "@remix-run/server-runtime";
import {
  ApiKey,
  deleteApiKey,
  e,
  FirebaseUser,
  Project,
  storeApiKey,
} from "@timetriggers/domain";
import { addMinutes, format } from "date-fns";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as C from "io-ts/lib/Codec";
import { draw } from "io-ts/lib/Decoder";
import { useState } from "react";
import { BsFillTrash2Fill } from "react-icons/bs";
import { FaCopy } from "react-icons/fa";
import { match } from "ts-pattern";
import { CopyToClipboardButton } from "~/components/CopyToClipboardButton";
import { getProjectSlugOrRedirect } from "~/loaders/getProjectIdOrRedirect";
import { getProjectBySlugOrRedirect } from "~/loaders/getProjectOrRedirect";
import { getUserOrRedirect } from "~/loaders/getUserOrRedirect";
import { actionFromRte, loaderFromRte } from "~/utils/loaderFromRte.server";
import { CodeSample } from "../../../../components/CodeSample";
import _ from "lodash";

export const loader: LoaderFunction = async ({ params, request }) => {
  return loaderFromRte(
    pipe(
      RTE.Do,
      RTE.bind("projectSlug", () =>
        getProjectSlugOrRedirect(params.projectSlug, "/projects")
      ),
      RTE.bind("user", () => getUserOrRedirect(request)),
      RTE.bindW("project", ({ projectSlug }) =>
        getProjectBySlugOrRedirect({ projectSlug }, "..")
      ),
      RTE.map(({ user, project }) => {
        if (project && project.isReader(user.id)) {
          return {
            project: Project.codec("string").encode(project),
            user: FirebaseUser.codec.encode(user),
          };
        } else {
          return redirect("..");
        }
      })
    )
  );
};

/**
 * POST to create a new API key
 */
export const action: ActionFunction = ({ params, request }) =>
  actionFromRte(
    pipe(
      RTE.Do,
      RTE.bindW("projectSlug", () =>
        getProjectSlugOrRedirect(params.projectSlug, "projects")
      ),
      RTE.bindW("user", () => getUserOrRedirect(request)),
      (x) => x,
      RTE.bindW("project", ({ projectSlug }) =>
        getProjectBySlugOrRedirect({ projectSlug }, "..")
      ),
      RTE.bindW("apiKey", () =>
        pipe(
          () => request.json(),
          RTE.fromTask,
          RTE.map((b) => b.apiKey),
          RTE.chainEitherKW(ApiKey.codec("string").decode),
          RTE.mapLeft((e) => {
            console.error(draw(e));
            return e;
          })
        )
      ),
      RTE.chainW(
        ({ apiKey, project: { id: projectId } }) =>
          match(request.method)
            .with("POST", () => storeApiKey({ apiKey, projectId }))
            .with("DELETE", () => deleteApiKey({ apiKey, projectId }))
            .otherwise(() =>
              RTE.left("Unexpected response")
            ) as RTE.ReaderTaskEither<any, Error | string, any> // TODO @licarth - fix this. Don't know why we have to type this
      ),
      RTE.map((a) => ({}))
    )
  );

const useIoTsLoaderDataOrThrow = <I, O, A>(codec: C.Codec<I, O, A>) => {
  const data = useLoaderData();
  return e.unsafeGetOrThrow(pipe(data, codec.decode));
};

const ApiKeyUsageModal = ({
  onClose,
  isOpen,
  apiKey,
}: Pick<ModalProps, "isOpen"> &
  Pick<ModalProps, "onClose"> & { apiKey: ApiKey }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size={{ base: "full", md: "6xl" }}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Api Key Created</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text>
              Your new api key has been created ! Please save it, because you
              won't be able to see it again ! (We only keep a hash of it)
            </Text>

            {apiKey && (
              <Stack spacing={4} alignItems="center">
                <Alert status="warning">
                  <AlertIcon />
                  <Text>
                    This is a <b>secret</b> ! Please keep it safe and don't
                    share it with anyone. Don't publish this on a single page
                    application !
                  </Text>
                </Alert>
                <Card
                  maxW={{ base: "full", md: "xl" }}
                  p={1}
                  variant={"outline"}
                  overflowX={"scroll"}
                >
                  <CardBody>
                    <HStack>
                      <Code
                        fontSize={"1.2em"}
                        alignSelf={"center"}
                        colorScheme={"pink"}
                      >
                        {apiKey.value}
                      </Code>
                      <CopyToClipboardButton
                        textToPutInClipboard={apiKey.value}
                        size={"sm"}
                        rightIcon={<FaCopy />}
                        minW="fit-content"
                      >
                        Copy
                      </CopyToClipboardButton>
                    </HStack>
                  </CardBody>
                </Card>
              </Stack>
            )}

            <Text>
              This is an example of how to use it with <Code>Typescript</Code>{" "}
              and <Code>fetch</Code>.
            </Text>
            <CodeSample
              code={codeWithKey(apiKey.value || `<API_KEY>`)}
              language="typescript"
              copyToClipboardButton
            />
          </Stack>
        </ModalBody>

        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export const codeWithKey = (apiKey?: string) => {
  const formattedDate = format(
    addMinutes(new Date(), 1),
    "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"
  );
  return `
fetch("https://api.timetriggers.io/schedule", {
  method: "POST",
  headers: {
    "X-TimeTriggers-Key": "${apiKey}",   // your API key
    "X-TimeTriggers-Url": "https://yourdomain.com/endpoint",    // The url to call
    "X-TimeTriggers-At": "${formattedDate}",       // 1 minute from now
  },
});
  `.trim();
};
export const bashCodeWithKey = (apiKey?: string) => {
  const formattedDate = format(
    addMinutes(new Date(), 1),
    "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"
  );
  return `
  curl \\
    -H "X-TimeTriggers-Url: https://licarth.eu.ngrok.io" \\
    -H "X-TimeTriggers-At: ${formattedDate}" \\
    -H "X-TimeTriggers-Key: ${apiKey}" \\
    
    # Everything below is your original request
    -H "Content-type: application/json" \\
    -X PUT \\
    -d '{
      "hello": "world"
    }' \\
  'https://timetriggers.io/schedule'
  `.trim();
};

const Document = () => {
  const bgColor = useColorModeValue("white", "gray.900");
  const { project, user } = useIoTsLoaderDataOrThrow(
    C.struct({
      project: Project.codec("string"),
      user: FirebaseUser.codec,
    })
  );
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [apiKey, setApiKey] = useState<ApiKey>();

  const navigate = useNavigate();

  const generateKey = () => ApiKey.generate(user.id);
  const codec = ApiKey.codec("string");
  const toast = useToast();
  const { onOpen, onClose, isOpen } = useDisclosure();

  const createKey = async () => {
    setIsCreatingKey(true);
    const newApiKey = await generateKey();

    // fetch POST request to create the key
    fetch("", {
      method: "POST",
      body: JSON.stringify({ apiKey: codec.encode(newApiKey) }),
    })
      .catch((e) => console.error(e))
      .then(() => {
        setApiKey(newApiKey);
        onOpen();
      })
      .finally(() => {
        navigate(".", { replace: true });
        setIsCreatingKey(false);
      });
  };

  const deleteKey = async (apiKey: ApiKey) => {
    setIsCreatingKey(true);
    fetch("", {
      method: "DELETE",
      body: JSON.stringify({ apiKey: codec.encode(apiKey) }),
    })
      .catch((e) => console.error(e))
      .then(() => {
        toast({
          title: "Key deleted.",
          variant: "subtle",
          status: "success",
          duration: 3000,
          isClosable: true,
          position: "top-right",
        });
      })
      .finally(() => {
        navigate(".", { replace: true });
        setIsCreatingKey(false);
      });
  };

  const apiKeys = project.apiKeys || [];

  const createKeyButton = (
    <Button
      w="min-content"
      colorScheme={"green"}
      onClick={() => createKey()}
      isLoading={isCreatingKey}
      loadingText="Loading…"
    >
      Create a new API Key
    </Button>
  );

  return (
    <Stack spacing={10}>
      <Text>Manage your API keys from here.</Text>
      {!_.isEmpty(apiKeys) && createKeyButton}
      <Card bgColor={bgColor} maxW="xxl" overflowY="scroll">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Key</Th>
              <Th>Date Added</Th>
              {/* <Th>Last Used</Th> */}
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {_.values(apiKeys).map((apiKey) => (
              <Tr key={apiKey.value}>
                <Td>••••{apiKey.value.slice(-4)}</Td>
                <Td>
                  <Text isTruncated maxW="sm">
                    {format(apiKey.createdAt, "dd/MM/yyyy HH:mm")}
                    {/* {apiKey.createdAt} */}
                  </Text>
                </Td>
                {/* <Td>seconds ago</Td> */}
                <Td>
                  <IconButton
                    size="xs"
                    icon={<BsFillTrash2Fill />}
                    aria-label="delete"
                    colorScheme={"red"}
                    onClick={() => deleteKey(apiKey)}
                  />
                </Td>
              </Tr>
            ))}
            {_.isEmpty(apiKeys) && (
              <Tr>
                <Td colSpan={4}>
                  <Stack alignItems="center" m={4} spacing={8}>
                    <Text textAlign="center">
                      You don't have any Api keys yet !
                    </Text>
                    {createKeyButton}
                  </Stack>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Card>
      {apiKey && (
        <ApiKeyUsageModal isOpen={isOpen} onClose={onClose} apiKey={apiKey} />
      )}
      <Card>
        <CardHeader>
          <Heading as="h2" size="md">
            How to use these API keys?
          </Heading>
        </CardHeader>
        <CardBody pt={0}>
          <OrderedList>
            <ListItem>
              Change your request url to{" "}
              <Code>https://api.timetriggers.io/schedule</Code>
            </ListItem>
            <ListItem>
              <Text>Add the following headers to your request:</Text>
              <UnorderedList>
                <ListItem>
                  <Code>X-TimeTriggers-Key</Code> : your Api Key
                </ListItem>
                <ListItem>
                  <Code>X-TimeTriggers-Url</Code> : the Url you want to hit
                </ListItem>
                <ListItem>
                  <Code>X-TimeTriggers-At</Code> : the moment we should schedule
                  the request, in the format{" "}
                  <Code>yyyy-MM-dd'T'HH:mm:ss.SSSxxx</Code>
                </ListItem>
              </UnorderedList>
            </ListItem>
          </OrderedList>
          <Box mt={6}>
            <CodeSample
              code={codeWithKey(apiKey?.value || `<API_KEY>`)}
              copyToClipboardButton
              language="typescript"
              legend={
                <>
                  Example with <Code>fetch()</Code> in Node.js
                </>
              }
            />
          </Box>
          <Box mt={6}>
            <CodeSample
              code={bashCodeWithKey(apiKey?.value || `<API_KEY>`)}
              copyToClipboardButton
              language="bash"
              legend={
                <>
                  Example with <Code>curl</Code>
                </>
              }
            />
          </Box>
          <Alert status="success" mt={6} variant="top-accent">
            <AlertIcon />
            <Text>
              That's it ! No need to change your <Code>method</Code>,{" "}
              <Code>body</Code> or anything else. We'll reply without any body,
              only with a header <Code>X-TimeTriggers-TaskId</Code>
            </Text>
          </Alert>
        </CardBody>
      </Card>
    </Stack>
  );
};

export default Document;
