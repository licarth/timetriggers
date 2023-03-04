import { Heading } from "@chakra-ui/react";

export const H1 = (p: { children?: React.ReactNode; centered?: boolean }) => (
  <Heading
    mb={4}
    fontWeight={"light"}
    textAlign={p.centered ? "center" : "left"}
  >
    {p.children}
  </Heading>
);
