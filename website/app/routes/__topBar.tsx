import {
  Box,
  Button,
  Container,
  Flex,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  useBreakpointValue,
  useColorMode,
} from "@chakra-ui/react";
import { Link, Outlet, useLoaderData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/server-runtime";
import { e, FirebaseUser } from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { BsMoon, BsSun } from "react-icons/bs";
import { FiMenu } from "react-icons/fi";
import { Logo } from "~/components";
import { getUser } from "~/loaders/getUser";
import { loaderFromRte } from "~/utils/loaderFromRte.server";
import * as C from "io-ts/lib/Codec.js";
import { Footer } from "~/components/footer/Footer";

const wireCodec = pipe(
  C.struct({
    user: C.nullable(FirebaseUser.codec),
  })
);

export const loader: LoaderFunction = async ({ request }) =>
  loaderFromRte(
    pipe(
      RTE.Do,
      RTE.bindW("user", () => getUser(request))
    )
  );

export default () => {
  const isDesktop = useBreakpointValue({ base: false, md: true });
  const { colorMode, toggleColorMode } = useColorMode();

  const { user } = e.unsafeGetOrThrow(pipe(useLoaderData(), wireCodec.decode));
  return (
    <Container maxW={"full"} m={0} mr={0} p={0}>
      <Box
        // pb={{ base: "12", md: "24" }}
        pos="fixed"
        w={"100%"}
        role="navigation"
        bg="bg-accent" // bg-surface
        zIndex={100}
        bgColor="chakra-body-bg"
      >
        <Box as="nav" bg="bg-surface" boxShadow="sm">
          <Container
            // py={{ base: "2" }}
            p={0}
            maxW="full"
            boxShadow={
              colorMode === "light"
                ? "0 0 0 1px rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.05)"
                : "0 0 0 1px rgba(255, 255, 255, 0.05), 0 1px 2px 0 rgba(255, 255, 255, 0.05)"
            }
          >
            <HStack
              h={"64px"}
              spacing="10"
              justify="space-between"
              flex="1"
              px={3}
            >
              <HStack spacing={{ base: 5 }} alignContent={"stretch"}>
                {isDesktop && <Logo fontSize="1.5em" />}
                <HStack alignItems="center" spacing={{ base: 5 }}>
                  <Link to="/">
                    <Button variant={"link"}>Product</Button>
                  </Link>
                  <Link to="/pricing">
                    <Button variant={"link"}>Pricing</Button>
                  </Link>
                </HStack>
              </HStack>
              {isDesktop ? (
                <Flex justify="space-between">
                  <HStack spacing="3">
                    <IconButton
                      variant="ghost"
                      icon={colorMode === "light" ? <BsMoon /> : <BsSun />}
                      onClick={toggleColorMode}
                      aria-label="Toggle Dark Mode"
                    ></IconButton>

                    {user ? (
                      <Link to={"projects"}>
                        <Button variant={"solid"} colorScheme="green">
                          Go to Dashboard
                        </Button>
                      </Link>
                    ) : (
                      <>
                        <Link to="login">
                          <Button variant="ghost">Sign in</Button>
                        </Link>
                        <Link to="signup">
                          <Button variant="solid" colorScheme={"green"}>
                            Sign up
                          </Button>
                        </Link>
                      </>
                    )}
                  </HStack>
                </Flex>
              ) : user ? (
                <Link to={"projects"}>
                  <Button variant={"solid"} size="sm" colorScheme="green">
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <Menu>
                  <MenuButton
                    as={IconButton}
                    variant="ghost"
                    icon={<FiMenu fontSize="1.25rem" />}
                    aria-label="Open Menu"
                  />
                  <MenuList>
                    <Link to={"login"}>
                      <MenuItem>Sign In</MenuItem>
                    </Link>
                    <Link to={"signup"}>
                      <MenuItem>Sign Up</MenuItem>
                    </Link>
                  </MenuList>
                </Menu>
              )}
            </HStack>
          </Container>
        </Box>
      </Box>
      <Box pt="64px" maxW={"100%"}>
        <Outlet />
      </Box>
      <Footer />
    </Container>
  );
};