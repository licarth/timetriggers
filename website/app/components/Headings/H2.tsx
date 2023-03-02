import { Heading } from "@chakra-ui/react";

export const H2 = (p: { children: React.ReactNode }) => (
  <Heading mb={3} fontWeight={"light"} fontSize="md" as="h2">
    {p.children}
  </Heading>
);
