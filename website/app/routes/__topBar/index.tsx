import {
  Box,
  Container,
  ContainerProps,
  Heading,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Logo } from "~/components";

export default () => {
  const backgroundColor = useColorModeValue("cyan.200", "cyan.800");

  return (
    <Container maxW={"full"} m={0} p={0}>
      <FullScreenPane p={{ base: 3, md: 5 }} bg={backgroundColor}>
        <Box mt="30vh" ml={{ base: "5", md: "16" }}>
          <BigFont>Schedule HTTP requests</BigFont>
          <Box fontSize={"1.8em"} fontWeight={300} mt={3}>
            <Text>
              <Logo /> is a SaaS to schedule HTTP requests to be executed in the
              future.
            </Text>
            <Text>It is open-source, and you can run it yourself.</Text>
          </Box>
        </Box>
      </FullScreenPane>
    </Container>
  );
};

const FullScreenPane = (props: { children?: ReactNode } & ContainerProps) => (
  <Container
    maxW={"full"}
    m={0}
    p={0}
    h={"100vh"}
    w={"100vw"}
    display={"flex"}
    justifyContent={"left"}
    {...props}
  >
    {props.children}
  </Container>
);

const BigFont = ({ children }: { children?: ReactNode }) => (
  <Heading
    size={{ base: "3xl", md: "4xl" }}
    fontFamily="Inter"
    fontWeight={300}
  >
    {children}
  </Heading>
);
