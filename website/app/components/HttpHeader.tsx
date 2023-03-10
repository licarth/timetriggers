import type { LinkProps } from '@chakra-ui/react';
import { Box, Code, Text, Tooltip } from '@chakra-ui/react';
import styled from '@emotion/styled';
import copy from 'copy-to-clipboard';

export const HttpHeader = ({ children }: LinkProps) => (
  <Tooltip label={'Click to copy'}>
    <Box as="span" position="relative" cursor="pointer">
      <Code
        lineHeight={1}
        as="span"
        colorScheme={'green'}
        onClick={() => {
          copy(String(children));
        }}
        fontSize={'100%'}
      >
        {children}
      </Code>
      <SmallCapsText
        position="absolute"
        right={0}
        as="sub"
        fontSize={'50%'}
        userSelect="none"
      >
        HEADER
      </SmallCapsText>
    </Box>
  </Tooltip>
);

const SmallCapsText = styled(Text)`
  font-variant-caps: petite-caps;
`;
