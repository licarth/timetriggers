import { Flex, Heading, IconButton, Select, Text } from "@chakra-ui/react";
import { useNavigate, useLocation } from "@remix-run/react";
import type { FirebaseUser, Project } from "@timetriggers/domain";
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

type MenuElementsProps = {
  user?: FirebaseUser;
  projects?: Project[];
  selectedProjectSlug?: string;
};

export const MenuElements = ({
  selectedProjectSlug,
  projects,
  user,
}: MenuElementsProps) => {
  const [navSize, setNavSize] = useState<NavSize>("large");
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const navigateToProject = (slug: string) => {
    const currentProjectPath = pathname.split("/").slice(3).join("/");
    navigate(`/projects/${slug}/${currentProjectPath}`);
  };

  return (
    <Flex
      p={"5%"}
      flexDir="column"
      alignItems="flex-start"
      as="nav"
      w={navSize === "small" ? "60px" : "200px"}
      borderRadius={navSize === "small" ? "15px" : "30px"}
      overflow="hidden"
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

      {selectedProjectSlug && (
        <>
          {projects && projects?.length > 1 && (
            <>
              <Select
                mt={8}
                defaultValue={selectedProjectSlug}
                onChange={(v) => navigateToProject(v.target.value)}
              >
                {projects?.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    Project {p.slug}
                  </option>
                ))}
              </Select>
            </>
          )}
          {/* <Heading mt={8} size="md" hidden={navSize === "small"}>
            Project <code>{selectedProjectSlug}</code>
          </Heading> */}
          <NavItem navSize={navSize} title="Tokens" icon={BsKey} active />
          <NavItem
            navSize={navSize}
            title="Triggers"
            icon={BsCollectionPlayFill}
            disabled
            comingSoon
          />
          <NavItem
            navSize={navSize}
            title="Settings"
            icon={BsGearFill}
            disabled
            comingSoon
          />
        </>
      )}
      <Heading mt={8} size="md" hidden={navSize === "small"}>
        Resources
      </Heading>
      <NavItem navSize={navSize} title="Docs" icon={BsBook} disabled />
    </Flex>
  );
};
