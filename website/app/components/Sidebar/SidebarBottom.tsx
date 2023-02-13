import { Flex, IconButton, useColorMode } from "@chakra-ui/react";
import { useNavigate } from "@remix-run/react";
import { FiLogOut, FiMoon, FiSun } from "react-icons/fi";
import { useFirebaseAuth } from "~/contexts/FirebaseAuthContext";

export const SidebarBottom = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { signOut } = useFirebaseAuth();
  const navigate = useNavigate();
  return (
    <Flex flexDir="column">
      <IconButton
        icon={colorMode === "light" ? <FiMoon /> : <FiSun />}
        aria-label="Toggle dark mode"
        onClick={toggleColorMode}
      />
      <IconButton
        icon={<FiLogOut />}
        aria-label="Logout"
        onClick={() => signOut().then(() => navigate("/"))}
      />
    </Flex>
  );
};
