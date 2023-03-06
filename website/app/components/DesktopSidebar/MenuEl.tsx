import { Flex, Heading, IconButton, Select } from "@chakra-ui/react";
import { useLocation, useNavigate } from "@remix-run/react";
import type { FirebaseUser, MonthlyUsage, Project } from "@timetriggers/domain";
import {
  BsBook,
  BsCollectionPlayFill,
  BsGearFill,
  BsKey,
} from "react-icons/bs";
import { FiMenu } from "react-icons/fi";
import { Logo } from "../Logo";
import { NavItem } from "./NavItem";
import type { NavSize } from "./NavItemProps";
import { ProjectUsage } from "./ProjectUsage";

type MenuElementsProps = {
  user?: FirebaseUser;
  projects?: Project[];
  selectedProjectSlug?: string;
  navSize: NavSize;
  setNavSize: (navSize: NavSize) => void;
  projectMonthlyUsage?: MonthlyUsage;
};

export const MenuElements = ({
  selectedProjectSlug,
  projects,
  user,
  navSize,
  setNavSize,
  projectMonthlyUsage,
}: MenuElementsProps) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const currentProjectPath = pathname.split("/").slice(3).join("/");
  const navigateToProject = (slug: string) => {
    navigate(`/projects/${slug}/${currentProjectPath}`);
  };

  return (
    <Flex
      p={navSize === "small" ? "3px" : "12px"}
      flexDir="column"
      alignItems="flex-start"
      as="nav"
      overflowY="hidden"
      w={navSize === "small" ? "60px" : "200px"}
      borderRadius={navSize === "small" ? "15px" : "30px"}
      transition="all 0.5s ease"
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
      <Flex flexDir={"column"} overflowY="scroll" w="full">
        {selectedProjectSlug && (
          <>
            {projects && projects?.length > 1 && (
              <>
                <Select
                  mt={8}
                  mb={4}
                  defaultValue={selectedProjectSlug}
                  onChange={(v) => navigateToProject(v.target.value)}
                >
                  {projects?.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.slug}
                    </option>
                  ))}
                </Select>
              </>
            )}
            {projectMonthlyUsage && (
              <ProjectUsage
                hidden={navSize === "small"}
                usage={projectMonthlyUsage}
                selectedProjectSlug={selectedProjectSlug}
              />
            )}
            <NavItem
              navSize={navSize}
              title="Api Keys"
              icon={BsKey}
              active={currentProjectPath === "api_keys"}
              href="api_keys"
            />
            <NavItem
              navSize={navSize}
              title="Triggers"
              icon={BsCollectionPlayFill}
              active={currentProjectPath === "triggers"}
              href="triggers"
            />
            <NavItem
              navSize={navSize}
              title="Settings"
              icon={BsGearFill}
              active={currentProjectPath === "settings"}
              href="settings"
            />
          </>
        )}
        <Heading mt={8} size="md" hidden={navSize === "small"}>
          Resources
        </Heading>
        <NavItem
          navSize={navSize}
          title="Docs"
          icon={BsBook}
          disabled
          comingSoon
        />
      </Flex>
    </Flex>
  );
};
