import type { ModalProps } from "@chakra-ui/react";
import {
  Button,
  Card,
  Code,
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
import styled from "@emotion/styled";
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
import Highlight, { defaultProps } from "prism-react-renderer";
import theme from "prism-react-renderer/themes/vsDark";
import { useState } from "react";
import { BsFillTrash2Fill } from "react-icons/bs";
import { match } from "ts-pattern";
import { getProjectSlugOrRedirect } from "~/loaders/getProjectIdOrRedirect";
import { getProjectBySlugOrRedirect } from "~/loaders/getProjectOrRedirect";
import { getUserOrRedirect } from "~/loaders/getUserOrRedirect";
import { actionFromRte, loaderFromRte } from "~/utils/loaderFromRte.server";

// export function links() {
//   return [{ rel: "stylesheet", href: styles }];
// }

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

const ApiTokenUsageModal = ({
  onClose,
  isOpen,
  rawToken,
}: Pick<ModalProps, "isOpen"> &
  Pick<ModalProps, "onClose"> & { rawToken?: string }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Api Key Created</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text>
            Your new api token has been created ! Please save it, because you
            won't be able to see it again ! (We only keep a hash of it)
          </Text>
          <Code
            m={8}
            fontSize={"1.2em"}
            alignSelf={"center"}
            colorScheme={"pink"}
          >
            {rawToken}
          </Code>
          <Text>
            This is an example of how to use it with <Code>Typescript</Code> and{" "}
            <Code>fetch</Code>.
          </Text>
          <Highlight
            {...defaultProps}
            theme={theme}
            code={codeWithToken(rawToken)}
            language="typescript"
          >
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <Pre className={className} style={style}>
                {tokens.map((line, i) => (
                  <Line key={i} {...getLineProps({ line, key: i })}>
                    <LineNo>{i + 1}</LineNo>
                    <LineContent>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token, key })} />
                      ))}
                    </LineContent>
                  </Line>
                ))}
              </Pre>
            )}
          </Highlight>
        </ModalBody>

        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const codeWithToken = (apiKey?: string) => {
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

const Document = () => {
  const bgColor = useColorModeValue("white", "gray.900");
  const { project, user } = useIoTsLoaderDataOrThrow(
    C.struct({
      project: Project.codec("string"),
      user: FirebaseUser.codec,
    })
  );
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [rawKey, setRawKey] = useState<string>();

  const navigate = useNavigate();

  const generateToken = () => ApiKey.generate(user.id);
  const codec = ApiKey.codec("string");
  const toast = useToast();
  const { onOpen, onClose, isOpen } = useDisclosure();

  const createKey = async () => {
    setIsCreatingToken(true);
    const { rawKey: newRawKey, apiKey } = await generateToken();
    setRawKey(newRawKey);

    // open modal
    onOpen();
    // fetch POST request to create the token
    fetch("", {
      method: "POST",
      body: JSON.stringify({ apiKey: codec.encode(apiKey) }),
    })
      .catch((e) => console.error(e))
      .then(() => {
        toast({
          title: "Token created.",
          status: "success",
          duration: 9000,
          isClosable: true,
          position: "top-right",
        });
      })
      .finally(() => {
        navigate(".", { replace: true });
        setIsCreatingToken(false);
      });
  };

  const deleteKey = async (apiKey: ApiKey) => {
    setIsCreatingToken(true);
    fetch("", {
      method: "DELETE",
      body: JSON.stringify({ apiKey: codec.encode(apiKey) }),
    })
      .catch((e) => console.error(e))
      .then(() => {
        toast({
          title: "Token deleted.",
          status: "success",
          duration: 9000,
          isClosable: true,
          position: "top-right",
        });
      })
      .finally(() => {
        navigate(".", { replace: true });
        setIsCreatingToken(false);
      });
  };

  const apiKeys = project.apiKeys || [];

  const createTokenButton = (
    <Button
      w={"xs"}
      colorScheme={"green"}
      onClick={() => createKey()}
      isLoading={isCreatingToken}
      loadingText="Loading…"
    >
      Create a new API Token
    </Button>
  );

  return (
    <Stack spacing={10} m={10}>
      <Text>Manage your API tokens from here.</Text>
      {apiKeys.length !== 0 && createTokenButton}
      <Card bgColor={bgColor}>
        <Table size={"sm"}>
          <Thead>
            <Tr>
              <Th>Token</Th>
              <Th>Date Added</Th>
              {/* <Th>Last Used</Th> */}
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {apiKeys.map((apiKey) => (
              <Tr key={apiKey.hash}>
                <Td>••••{apiKey.last4Chars}</Td>
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
            {apiKeys.length === 0 && (
              <Tr>
                <Td colSpan={4}>
                  <Stack alignItems="center" m={4} spacing={8}>
                    <Text textAlign="center">
                      You don't have any Api tokens yet !
                    </Text>
                    {createTokenButton}
                  </Stack>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
        <ApiTokenUsageModal
          isOpen={isOpen}
          onClose={onClose}
          rawToken={rawKey}
        />
      </Card>
    </Stack>
  );
};

const Pre = styled.pre`
  text-align: left;
  margin: 1em 0;
  padding: 0.5em;
  overflow: scroll;
  font-size: 0.8rem;
`;

const Line = styled.div`
  display: table-row;
`;

const LineNo = styled.span`
  display: table-cell;
  text-align: right;
  padding-right: 1em;
  user-select: none;
  opacity: 0.5;
`;

const LineContent = styled.span`
  display: table-cell;
`;

export default Document;
