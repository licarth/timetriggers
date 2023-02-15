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
import { format } from "date-fns";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as C from "io-ts/lib/Codec";
import { draw } from "io-ts/lib/Decoder";
import { BsFillTrash2Fill } from "react-icons/bs";
import { match } from "ts-pattern";
import { getProjectSlugOrRedirect } from "~/loaders/getProjectIdOrRedirect";
import { getProjectBySlugOrRedirect } from "~/loaders/getProjectOrRedirect";
import { getUserOrRedirect } from "~/loaders/getUserOrRedirect";
import { actionFromRte, loaderFromRte } from "~/utils/loaderFromRte.server";

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
export const action: ActionFunction = ({ params, request }) => {
  return actionFromRte(
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
};

const useIoTsLoaderDataOrThrow = <I, O, A>(codec: C.Codec<I, O, A>) => {
  const data = useLoaderData();
  return e.unsafeGetOrThrow(pipe(data, codec.decode));
};

const Document = () => {
  const bgColor = useColorModeValue("white", "gray.900");
  const { project, user } = useIoTsLoaderDataOrThrow(
    C.struct({
      project: Project.codec("string"),
      user: FirebaseUser.codec,
    })
  );

  const navigate = useNavigate();

  const generateToken = () => ApiKey.generate(user.id);
  const codec = ApiKey.codec("string");

  const createKey = async () => {
    const { rawKey, apiKey } = await generateToken();
    console.log("rawKey", rawKey);
    // fetch POST request to create the token
    fetch("", {
      method: "POST",
      body: JSON.stringify({ apiKey: codec.encode(apiKey) }),
    })
      .catch((e) => console.error(e))
      .finally(() => {
        navigate(".", { replace: true });
      });
  };

  const deleteKey = async (apiKey: ApiKey) => {
    fetch("", {
      method: "DELETE",
      body: JSON.stringify({ apiKey: codec.encode(apiKey) }),
    })
      .catch((e) => console.error(e))
      .finally(() => {
        navigate(".", { replace: true });
      });
  };

  const apiKeys = project.apiKeys || [];

  return (
    <Stack spacing={10} m={10}>
      <Text>Manage your API tokens from here.</Text>
      {apiKeys.length !== 0 && (
        <Button w={"xs"} colorScheme={"green"} onClick={() => createKey()}>
          Create a new API Token
        </Button>
      )}
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
                    <Button
                      w={"xs"}
                      colorScheme={"green"}
                      onClick={() => createKey()}
                    >
                      Create a new API Token
                    </Button>
                  </Stack>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Card>
    </Stack>
  );
};

export default Document;
