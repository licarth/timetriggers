import {
  Heading,
  Stack,
  useBreakpointValue,
  useColorModeValue,
} from '@chakra-ui/react';
import { Link, Outlet, useLocation } from '@remix-run/react';
import { useState } from 'react';
import { smallCaps } from '~/utils/smallCaps';
import { tableOfContents } from './tableOfContents';

export default function Route() {
  const isDesktop = useBreakpointValue({ base: false, md: true });
  const { pathname } = useLocation();
  // extract first part of url
  const parts = pathname.split('/');

  const docsOrBlog = parts[1];
  if (docsOrBlog !== 'docs' && docsOrBlog !== 'blog') {
    return <></>;
  }

  return (
    <Stack
      direction={isDesktop ? 'row' : 'column'}
      h={isDesktop ? '100%' : 'auto'}
      alignItems={'stretch'}
      justifyContent="stretch"
    >
      <DocsTableOfContents docsOrBlog={docsOrBlog} />
      <Outlet />
    </Stack>
  );
}
const DocsTableOfContents = ({
  docsOrBlog,
}: {
  docsOrBlog: 'docs' | 'blog';
}) => {
  const isDesktop = useBreakpointValue({ base: false, md: true });
  const [isOpen, setIsOpen] = useState(false);

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
        {smallCaps(`${isDesktop ? '' : isOpen ? '▲' : '▼'} ARTICLES`)}
      </Heading>
      {(isOpen || isDesktop) &&
        tableOfContents[docsOrBlog].map(
          ({ text, link, children }) => (
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
          ),
        )}
    </Stack>
  );
};
