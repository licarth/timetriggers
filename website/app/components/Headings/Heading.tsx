import type { HeadingProps } from '@chakra-ui/react';
import {
  Heading as ChakraHeading,
  Icon,
  LinkBox,
} from '@chakra-ui/react';
import { Link } from '@remix-run/react';
import { FaLink } from 'react-icons/fa';

type SupportedHeadingType = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export const Heading = function (
  p: {
    as?: SupportedHeadingType;
    children?: React.ReactNode;
    centered?: boolean;
  } & HeadingProps,
) {
  const linkProps = p.id ? { as: Link, to: `#${p.id}` } : {};
  return (
    // @ts-ignore
    <LinkBox
      role="group"
      position={'relative'}
      display={'inline-block'}
      {...linkProps}
    >
      {p.id && (
        <Icon
          as={FaLink}
          display={'none'}
          position={'absolute'}
          top={'50%'}
          size={iconSizeFromAs(p.as || 'h1')}
          w={iconSizeFromAs(p.as || 'h1')}
          _groupHover={{ display: 'block' }}
          transform={'translate(-200%, 0)'}
        />
      )}
      <ChakraHeading
        mb={mbFromLevel(p.as || 'h1')}
        mt={mtFromLevel(p.as || 'h1')}
        as={p.as || 'h1'}
        fontWeight={'200'}
        textAlign={p.centered ? 'center' : 'left'}
        fontSize={sizeFromAs(p.as || 'h1')}
        {...p}
      >
        {p.children}
      </ChakraHeading>
    </LinkBox>
  );
};

const iconSizeFromAs = (as: SupportedHeadingType) => {
  switch (as) {
    case 'h1':
      return '15px';
    case 'h2':
      return '12px';
    case 'h3':
      return '12px';
    case 'h4':
      return '8px';
    case 'h5':
      return '8px';
    case 'h6':
      return '8px';
  }
};

const sizeFromAs = (as: SupportedHeadingType) => {
  switch (as) {
    case 'h1':
      return '4xl';
    case 'h2':
      return '3xl';
    case 'h3':
      return '2xl';
    case 'h4':
      return 'xl';
    case 'h5':
      return 'lg';
    case 'h6':
      return 'md';
  }
};

const mbFromLevel = (as: SupportedHeadingType) => {
  switch (as) {
    case 'h1':
      return 2;
    case 'h2':
      return 1;
    case 'h3':
      return 1;
    case 'h4':
      return 1;
    case 'h5':
      return 0;
    case 'h6':
      return 0;
  }
};

const mtFromLevel = (as: SupportedHeadingType) => {
  switch (as) {
    case 'h1':
      return 6;
    case 'h2':
      return 5;
    case 'h3':
      return 4;
    case 'h4':
      return 3;
    case 'h5':
      return 2;
    case 'h6':
      return 1;
  }
};
