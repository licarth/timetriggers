import {
  Flex,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  useDisclosure,
} from "@chakra-ui/react";
import { useLocation } from "@remix-run/react";
import type { FirebaseUser, Project } from "@timetriggers/domain";
import {
  BsBook,
  BsCollectionPlayFill,
  BsGearFill,
  BsKey,
} from "react-icons/bs";
import { useProjectNavigation } from "~/contexts";
import { Logo } from "../Logo";
import { MenuElements } from "./MenuEl";
import { NavItem } from "./NavItem";
import { TopBarRight } from "./TopbarRight";

type MobileSidebarProps = {
  user?: FirebaseUser;
  projects?: Project[];
};

export const MobileTopbar = ({ user, projects }: MobileSidebarProps) => {
  const { pathname } = useLocation();
  const { onOpen, onClose, isOpen } = useDisclosure();
  const { navigateToProject } = useProjectNavigation();
  const selectedProjectSlug = pathname.startsWith("/projects/")
    ? pathname.split("/")[2]
    : undefined;

  return (
    <Flex
      pos="sticky"
      zIndex={100}
      direction="row"
      top="0"
      maxH={"fit-content"}
      flexGrow={1}
      justifyContent={"space-between"}
      alignItems={"center"}
      boxShadow="0 4px 12px 0 rgba(0,0,0,0.5)"
      display={{ base: "flex", sm: "none" }}
      bg="chakra-body-bg"
    >
      <MenuElements
        user={user}
        projects={projects}
        selectedProjectSlug={selectedProjectSlug}
        onOpen={onOpen}
      />
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size={{ base: "full", md: "6xl" }}
      >
        <ModalOverlay hidden />
        <ModalContent>
          <ModalHeader>
            <Logo fontSize="1em" />
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Flex flexDir={"column"} overflowY="scroll" w="full">
              {selectedProjectSlug && (
                <>
                  {projects && projects?.length > 1 && (
                    <>
                      <Heading size={"md"}>Change Project</Heading>
                      <Select
                        mt={8}
                        defaultValue={selectedProjectSlug}
                        onChange={(v) => {
                          onClose();
                          navigateToProject(v.target.value);
                        }}
                      >
                        {projects?.map((p) => (
                          <option key={p.slug} value={p.slug}>
                            {p.slug}
                          </option>
                        ))}
                      </Select>
                    </>
                  )}

                  <Heading size={"md"} mt={4}>
                    Navigation
                  </Heading>
                  <NavItem
                    title="Api Keys"
                    icon={BsKey}
                    active
                    href="api_keys"
                  />
                  <NavItem
                    title="Triggers"
                    icon={BsCollectionPlayFill}
                    href="triggers"
                  />
                  <NavItem title="Settings" icon={BsGearFill} href="settings" />
                </>
              )}
              <Heading mt={8} size="md">
                Resources
              </Heading>
              <NavItem title="Docs" icon={BsBook} disabled comingSoon />
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>
      <TopBarRight />
    </Flex>
  );
};
