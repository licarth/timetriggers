import { Box, useColorModeValue } from "@chakra-ui/react";

const Document = () => {
  const bgColor = useColorModeValue("white", "gray.800");
  return (
    <Box bgColor={bgColor} h="120vh">
      This is the list of all projects you have access to.
    </Box>
  );
};

export default Document;
