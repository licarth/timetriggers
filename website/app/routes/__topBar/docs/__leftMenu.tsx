import { HStack, Stack, useColorModeValue } from '@chakra-ui/react';
import { Link, Outlet } from '@remix-run/react';

export default function Route() {
  return (
    <HStack h="100%" alignItems={'stretch'} justifyContent="stretch">
      <DocsTableOfContents />
      <Outlet />
    </HStack>
  );
}

const DocsTableOfContents = () => {
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
      display={{ base: 'none', md: 'flex' }}
      minW={'250px'}
      p={5}
      bgColor={useColorModeValue('gray.200', 'gray.700')}
    >
      {links.map(({ text, link, children }) => (
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
