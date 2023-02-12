import { Box, useColorModeValue } from "@chakra-ui/react";

const Document = () => {
  const bgColor = useColorModeValue("white", "gray.800");
  return (
    <Box bgColor={bgColor} h="120vh">
      Content
    </Box>
  );
};

export default Document;
