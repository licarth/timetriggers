import { Flex } from "@chakra-ui/react";
import { useLocation } from "@remix-run/react";
import type { FirebaseUser, MonthlyUsage, Project } from "@timetriggers/domain";
import { useEffect, useState } from "react";
import { MenuElements } from "./MenuEl";
import type { NavSize } from "./NavItemProps";
import { SidebarBottom } from "./SidebarBottom";

type SidebarProps = {
  user?: FirebaseUser;
  projects?: Project[];
  projectMonthlyUsage?: MonthlyUsage;
};

export const DesktopSidebar = ({
  user,
  projects,
  projectMonthlyUsage,
}: SidebarProps) => {
  const { pathname } = useLocation();
  const [screenWidth, setScreenWidth] = useState(0);

  useEffect(() => {
    typeof window !== "undefined" && setScreenWidth(window.innerWidth);
  }, []);

  const [navSize, setNavSize] = useState<NavSize>(
    screenWidth > 600 ? "large" : "small"
  );

  const selectedProjectSlug = pathname.startsWith("/projects/")
    ? pathname.split("/")[2]
    : undefined;

  return (
    <Flex
      pos="sticky"
      direction="column"
      top="0"
      maxW={"fit-content"}
      flexGrow={1}
      justifyContent={"space-between"}
      boxShadow="0 4px 12px 0 rgba(0,0,0,0.5)"
      display={{ base: "none", sm: "flex" }}
    >
      <MenuElements
        user={user}
        projects={projects}
        selectedProjectSlug={selectedProjectSlug}
        navSize={navSize}
        setNavSize={setNavSize}
        projectMonthlyUsage={projectMonthlyUsage}
      />
      <SidebarBottom navSize={navSize} />
    </Flex>
  );
};
