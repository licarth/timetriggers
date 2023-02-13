import { Flex, IconButton } from "@chakra-ui/react";
import { useState } from "react";
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

export const MenuEl = () => {
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
