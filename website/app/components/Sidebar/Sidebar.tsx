import { Flex } from "@chakra-ui/react";
import { useLocation } from "@remix-run/react";
import type { FirebaseUser, Project } from "@timetriggers/domain";
import { MenuElements } from "./MenuEl";
import { SidebarBottom } from "./SidebarBottom";

type SidebarProps = {
  user?: FirebaseUser;
  projects?: Project[];
};

export const Sidebar = ({ user, projects }: SidebarProps) => {
  const { pathname } = useLocation();

  const selectedProjectSlug = pathname.startsWith("/projects/")
    ? pathname.split("/")[2]
    : undefined;

  return (
    <Flex
      pos="sticky"
      direction="column"
      top="0"
      h="100vh"
      justifyContent={"space-between"}
      boxShadow="0 4px 12px 0 rgba(0,0,0,0.5)"
    >
      <MenuElements
        user={user}
        projects={projects}
        selectedProjectSlug={selectedProjectSlug}
      />
      <SidebarBottom />
    </Flex>
  );
};
