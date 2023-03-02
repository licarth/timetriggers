import { Heading } from "@chakra-ui/react";

export const H1 = (p: { children: React.ReactNode }) => (
  <Heading mb={4} fontWeight={"light"}>
    {p.children}
  </Heading>
);
