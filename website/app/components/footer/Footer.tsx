import {
  ButtonGroup,
  Container,
  IconButton,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FaGithub } from "react-icons/fa";
import { Logo } from "../Logo";

export const Footer = () => (
  <Container as="footer" role="contentinfo" py={{ base: "12", md: "16" }}>
    <Stack spacing={{ base: "4", md: "5" }}>
      <Stack justify="space-between" direction="row" align="center">
        <Logo fontSize="1rem" />
        <ButtonGroup variant="ghost">
          {/* <IconButton
            as="a"
            href=""
            aria-label="LinkedIn"
            icon={<FaLinkedin fontSize="1.25rem" />}
          /> */}
          <IconButton
            as="a"
            href="https://github.com/licarth/timetriggers"
            aria-label="GitHub"
            icon={<FaGithub fontSize="1.25rem" />}
          />
          {/* <IconButton
            as="a"
            href="#"
            aria-label="Twitter"
            icon={<FaTwitter fontSize="1.25rem" />}
          /> */}
        </ButtonGroup>
      </Stack>
      <Text fontSize="sm" color="subtle">
        &copy; {new Date().getFullYear()} timetriggers. All rights reserved.
      </Text>
    </Stack>
  </Container>
);
