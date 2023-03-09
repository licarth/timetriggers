import type { HeadingProps } from '@chakra-ui/react';
import { Heading } from '@chakra-ui/react';

export const H1 = (
  p: {
    children?: React.ReactNode;
    centered?: boolean;
  } & HeadingProps,
) => (
  <Heading
    mb={4}
    fontWeight={'light'}
    textAlign={p.centered ? 'center' : 'left'}
    {...p}
  >
    {p.children}
  </Heading>
);
