import type { HeadingProps } from "@chakra-ui/react";
import { Heading } from "@chakra-ui/react";

export const H2 = (p: { children: React.ReactNode } & HeadingProps) => (
  <Heading mb={3} fontWeight={"light"} fontSize="md" as="h2" {...p}>
    {p.children}
  </Heading>
);
