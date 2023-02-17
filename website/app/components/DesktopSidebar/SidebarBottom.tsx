import type { ButtonProps, IconButtonProps } from "@chakra-ui/react";
import {
  Button,
  Flex,
  IconButton,
  Stack,
  useColorMode,
} from "@chakra-ui/react";
import { useNavigate } from "@remix-run/react";
import type { ReactNode } from "react";
import { FiLogOut, FiMoon, FiSun } from "react-icons/fi";
import { useFirebaseAuth } from "~/contexts/FirebaseAuthContext";
import type { NavSize } from "./NavItemProps";
import _ from "lodash";

type SidebarBottomProps = {
  navSize: NavSize;
};

export const SidebarBottom = ({ navSize }: SidebarBottomProps) => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { signOut } = useFirebaseAuth();
  const navigate = useNavigate();
  return (
    <Stack spacing={2} p={2}>
      <ButtonWithTextAndIcon
        navSize={navSize}
        icon={colorMode === "light" ? <FiMoon /> : <FiSun />}
        aria-label="Toggle dark mode"
        onClick={toggleColorMode}
      >
        {navSize === "large" &&
          `${colorMode === "light" ? "Dark" : "Light"} Mode`}
      </ButtonWithTextAndIcon>
      <ButtonWithTextAndIcon
        navSize={navSize}
        icon={<FiLogOut />}
        aria-label="Logout"
        colorScheme={"red"}
        onClick={() => signOut().then(() => navigate("/"))}
      >
        {navSize === "large" && `Sign Out`}
      </ButtonWithTextAndIcon>
    </Stack>
  );
};

const ButtonWithTextAndIcon = (
  p: ButtonProps & {
    children: ReactNode;
    navSize: NavSize;
    "aria-label": string;
    icon: IconButtonProps["icon"];
  }
) => {
  const { children, navSize, icon, ...props } = p;
  if (navSize === "large") {
    return (
      <Button leftIcon={icon} {...props}>
        {children}
      </Button>
    );
  } else {
    return (
      <IconButton
        aria-label={p["aria-label"]}
        icon={icon}
        {..._.omit(props, "aria-label")}
      />
    );
  }
};
