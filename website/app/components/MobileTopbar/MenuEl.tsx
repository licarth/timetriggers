import { Code, Flex, Heading, IconButton, Select } from "@chakra-ui/react";
import { useLocation, useNavigate } from "@remix-run/react";
import type { FirebaseUser, Project } from "@timetriggers/domain";
import {
  BsBook,
  BsCollectionPlayFill,
  BsGearFill,
  BsKey,
} from "react-icons/bs";
import { FiMenu } from "react-icons/fi";
import { Logo } from "~/components/Logo";
import { NavItem } from "./NavItem";
import type { NavSize } from "./NavItemProps";

type MenuElementsProps = {
  user?: FirebaseUser;
  projects?: Project[];
  selectedProjectSlug?: string;
  onOpen: () => void;
};

export const MenuElements = ({
  selectedProjectSlug,
  projects,
  user,
  onOpen,
}: MenuElementsProps) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <Flex
      p={1}
      flexDir="row"
      alignItems="center"
      as="nav"
      overflow="hidden"
      // w={navSize === "small" ? "60px" : "200px"}
      transition="all 0.5s ease"
    >
      <Flex flexDir={"row"} alignItems={"center"}>
        <IconButton
          aria-label="Home"
          icon={<FiMenu />}
          bg="none"
          _hover={{ bg: "none" }}
          onClick={() => onOpen()}
        />
        <Logo fontSize="1rem" />
      </Flex>
    </Flex>
  );
};
