import {
  Button,
  ButtonProps,
  HStack,
  IconButton,
  IconButtonProps,
  useColorMode,
} from "@chakra-ui/react";
import { useNavigate } from "@remix-run/react";
import _ from "lodash";
import type { ReactNode } from "react";
import { FiLogOut, FiMoon, FiSun } from "react-icons/fi";
import { useFirebaseAuth } from "~/contexts/FirebaseAuthContext";
import type { NavSize } from "./NavItemProps";

type SidebarBottomProps = {};

export const TopBarRight = ({}: SidebarBottomProps) => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { signOut } = useFirebaseAuth();
  const navigate = useNavigate();
  return (
    <HStack spacing={2} p={2}>
      <ButtonWithTextAndIcon
        navSize={"small"}
        icon={colorMode === "light" ? <FiMoon /> : <FiSun />}
        aria-label="Toggle dark mode"
        onClick={toggleColorMode}
      ></ButtonWithTextAndIcon>
      <ButtonWithTextAndIcon
        navSize={"small"}
        icon={<FiLogOut />}
        aria-label="Logout"
        colorScheme={"red"}
        onClick={() => signOut().then(() => navigate("/"))}
      ></ButtonWithTextAndIcon>
    </HStack>
  );
};

const ButtonWithTextAndIcon = (
  p: ButtonProps & {
    children?: ReactNode;
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
