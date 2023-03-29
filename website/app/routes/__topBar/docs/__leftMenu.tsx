import {
  Heading,
  Stack,
  useBreakpointValue,
  useColorModeValue,
} from '@chakra-ui/react';
import { Link, Outlet } from '@remix-run/react';
import { useState } from 'react';
import { smallCaps } from './__leftMenu/smallCaps';

export default function Route() {
  const isDesktop = useBreakpointValue({ base: false, md: true });
  return (
    <Stack
      direction={isDesktop ? 'row' : 'column'}
      h={isDesktop ? '100%' : 'auto'}
      alignItems={'stretch'}
      justifyContent="stretch"
    >
      <DocsTableOfContents />
      <Outlet />
    </Stack>
  );
}

const DocsTableOfContents = () => {
  const isDesktop = useBreakpointValue({ base: false, md: true });
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { text: 'Introduction', link: '/docs/introduction' },
    {
      text: 'Api',
      link: '/docs/api',
      children: [
        {
          text: 'Schedule a trigger',
          link: '/docs/api/schedule',
        },
        {
          text: 'Cancel a trigger',
          link: '/docs/api/cancel',
        },
        {
          text: 'Re-schedule a trigger',
          link: '/docs/api/reschedule',
        },
      ],
    },
    {
      text: 'Examples',
      link: '/docs/examples',
    },
    {
      text: 'FAQ',
      link: '/docs/faq',
    },
    {
      text: 'Product Roadmap',
      link: '/docs/product-roadmap',
    },
  ];
  return (
    <Stack
      m={0}
      minW={'250px'}
      p={5}
      bgColor={useColorModeValue('gray.200', 'gray.700')}
      overflowY={'hidden'}
      // Size transition
      transition={'flex 0.2s ease-in-out'}
    >
      <Heading
        as="h5"
        onClick={() => !isDesktop && setIsOpen((v) => !v)}
      >
        {smallCaps(`${isOpen ? '▲' : '▼'} TABLE OF CONTENTS`)}
      </Heading>
      {(isOpen || isDesktop) &&
        links.map(({ text, link, children }) => (
          <Stack key={link}>
            <Link to={link}>{text}</Link>
            {children && (
              <Stack pl={2}>
                {children.map(({ text, link }) => (
                  <Link key={link} to={link}>
                    {text}
                  </Link>
                ))}
              </Stack>
            )}
          </Stack>
        ))}
    </Stack>
  );
};
