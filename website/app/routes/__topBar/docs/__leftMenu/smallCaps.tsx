import { Text } from '@chakra-ui/react';

export const smallCaps = (text: string) => {
  return (
    <Text as="span" textTransform="uppercase" fontSize="xs">
      {text}
    </Text>
  );
};
