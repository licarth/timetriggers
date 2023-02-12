import {
  As,
  Flex,
  Icon,
  IconButton,
  Link,
  Menu,
  MenuButton,
  Text,
  useColorMode,
  useColorModeValue,
} from "@chakra-ui/react";
import { Outlet, useNavigate } from "@remix-run/react";
import { LoaderFunction, redirect } from "@remix-run/server-runtime";
import { useState } from "react";
import {
  BsBook,
  BsCollectionPlayFill,
  BsGearFill,
  BsKey,
} from "react-icons/bs";
import { FiLogOut, FiMenu, FiMoon, FiSun } from "react-icons/fi";
import { Footer } from "~/components/footer/Footer";
import { Logo } from "~/components/Logo";
import { useFirebaseAuth } from "~/contexts/FirebaseAuthContext";
import { environmentVariable } from "~/environmentVariable";
import { requireUserId } from "~/session.server";

const Root = () => {
  return (
    <Flex flexDir={"row"}>
      <Sidebar />
      <Content />
    </Flex>
  );
};

type NavSize = "small" | "large";

const Content = () => (
  <Flex direction={"column"} flexGrow="1" justifyContent="space-between">
    <Outlet />
    <Footer />
  </Flex>
);

const Sidebar = () => {
  return (
    <Flex
      pos="sticky"
      direction="column"
      top="0"
      h="100vh"
      justifyContent={"space-between"}
      boxShadow="0 4px 12px 0 rgba(0,0,0,0.5)"
    >
      <MenuEl />
      <SidebarBottom />
    </Flex>
  );
};

const MenuEl = () => {
  const [navSize, setNavSize] = useState<NavSize>("large");

  return (
    <Flex
      p={"5%"}
      flexDir="column"
      alignItems="flex-start"
      as="nav"
      w={navSize === "small" ? "60px" : "200px"}
      borderRadius={navSize === "small" ? "15px" : "30px"}
    >
      <Flex flexDir={"row"} mt="5" alignItems={"center"}>
        <IconButton
          aria-label="Home"
          icon={<FiMenu />}
          bg="none"
          _hover={{ bg: "none" }}
          onClick={() => setNavSize(navSize === "small" ? "large" : "small")}
        />
        {navSize === "large" && <Logo fontSize="1rem" />}
      </Flex>
      <NavItem navSize={navSize} title="Tokens" icon={BsKey} active />
      <NavItem
        navSize={navSize}
        title="Triggers"
        icon={BsCollectionPlayFill}
        disabled
      />
      <NavItem navSize={navSize} title="Settings" icon={BsGearFill} disabled />
      <NavItem navSize={navSize} title="Docs" icon={BsBook} disabled />
    </Flex>
  );
};

type NavItemProps = {
  navSize: NavSize;
  title: string;
  icon: As<any>;
  active?: boolean;
  disabled?: boolean;
};

const NavItem = ({ navSize, icon, title, active, disabled }: NavItemProps) => {
  const activeColor = useColorModeValue("gray.200", "gray.700");
  const textColor = useColorModeValue("gray.900", "white");
  const disabledColor = useColorModeValue("gray.300", "gray.600");
  return (
    <Flex
      mt={15}
      flexDir="column"
      w={"100%"}
      alignItems={navSize === "small" ? "center" : "flex-start"}
    >
      <Menu placement="right">
        <Link
          padding={3}
          borderRadius={8}
          bgColor={active ? activeColor : "none"}
          color={disabled ? disabledColor : textColor}
          w={navSize === "large" ? "100%" : "auto"}
        >
          <MenuButton w={"100%"} disabled={disabled}>
            <Flex>
              <Icon as={icon} alignSelf="center" />
              <Text ml={5} display={navSize === "small" ? "none" : "flex"}>
                {title}
              </Text>
            </Flex>
          </MenuButton>
        </Link>
      </Menu>
    </Flex>
  );
};

const SidebarBottom = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { signOut } = useFirebaseAuth();
  const navigate = useNavigate();
  return (
    <Flex flexDir="column">
      <IconButton
        icon={colorMode === "light" ? <FiMoon /> : <FiSun />}
        aria-label="Toggle dark mode"
        onClick={toggleColorMode}
      />
      <IconButton
        icon={<FiLogOut />}
        aria-label="Logout"
        onClick={() => signOut().then(() => navigate("/"))}
      />
    </Flex>
  );
};

export default Root;

export const loader: LoaderFunction = async ({ request }) => {
  const user = await requireUserId(request);
  if (
    user !== null &&
    (user.email === "thlukrid@gmail.com" ||
      environmentVariable("PUBLIC_USE_EMULATORS") === "true")
  ) {
    return {};
  } else {
    return redirect("/login");
  }
};
