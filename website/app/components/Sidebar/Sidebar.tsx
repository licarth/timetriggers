import { Flex } from "@chakra-ui/react";
import { MenuEl } from "./MenuEl";
import { SidebarBottom } from "./SidebarBottom";

export const Sidebar = () => {
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
