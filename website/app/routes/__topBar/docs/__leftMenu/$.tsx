import type {
  AlertProps,
  AlertStatus,
  ContainerProps,
} from '@chakra-ui/react';
import {
  Alert,
  AlertIcon,
  Box,
  Code,
  Container,
  Spacer,
  Stack,
  Text,
  UnorderedList,
  useColorModeValue,
} from '@chakra-ui/react';
import styled from '@emotion/styled';
import type { RenderableTreeNode } from '@markdoc/markdoc';
import Markdoc, { Tag } from '@markdoc/markdoc';
import { json, type LoaderArgs } from '@remix-run/node';
import type { LinkProps } from '@remix-run/react';
import { Link, useLoaderData } from '@remix-run/react';
import React from 'react';
import { CodeExample, H1 } from '~/components';
import { Footer } from '~/components/footer/Footer';
import { Heading } from '~/components/Headings';

const getArticleContent = async (article: string) => {
  // get from public folder
  const response = await fetch(
    `http://localhost:3000/articles/${article}.md`,
  );
  if (!response.ok) {
    return null;
  }
  return await response.text();
};

export async function loader({ params }: LoaderArgs) {
  // here get the MD from your fs using or a database
  if (!params['*']) return json({ content: '' }, { status: 404 });
  let markdown = await getArticleContent(params['*']);
  if (!markdown) {
    return 'article-not-found';
  }
  let ids: string[] = [];
  const getId = (candidate: string) => {
    let id: string;
    if (ids.includes(candidate)) {
      let i = 1;
      while (ids.includes(`${candidate}-${i}`)) {
        i++;
      }
      id = `${candidate}-${i}`;
    } else {
      id = candidate;
    }
    ids.push(id);
    return id;
  };
  let ast = Markdoc.parse(markdown);
  let content = Markdoc.transform(ast, {
    tags: {
      code_example: {
        render: 'CodeExample',
        attributes: {},
      },
      callout: {
        render: 'Callout',
        // children: ['paragraph', 'tag', 'list'],
        transform(node, config) {
          return new Tag(
            this.render,
            {
              as: 'div',
              mb: 4,
              children: node.transformChildren(config),
              type: node.attributes.type,
            },
            node.transformChildren(config),
          );
        },
        attributes: {
          type: {
            type: String,
            default: 'info',
            matches: ['info', 'error', 'note', 'warning'],
          },
        },
      },
    },
    nodes: {
      link: {
        render: 'Link',
        transform(node, config) {
          return new Tag(
            this.render,
            {
              href: node.attributes.href,
              title: node.attributes.title,
            },
            node.transformChildren(config),
          );
        },
      },
      blockquote: {
        render: 'Text',
      },
      list: {
        render: 'Ul',
        transform(node, config) {
          return new Tag(
            this.render,
            { as: 'ul', ml: 4, mt: 1 },
            node.transformChildren(config),
          );
        },
      },
      paragraph: {
        render: 'Text',
        transform(node, config) {
          return new Tag(
            this.render,
            { as: 'p' },
            node.transformChildren(config),
          );
        },
      },
      code: {
        render: 'InlineCode',
        transform(node) {
          return new Tag(this.render, {}, [node.attributes.content]);
        },
      },
      heading: {
        render: 'Heading',
        transform(node, config) {
          const firstChild =
            node.children[0].children[0].attributes.content;
          const id =
            firstChild && typeof firstChild === 'string'
              ? firstChild
                  .toLowerCase()
                  // remove non-word chars, except spaces
                  .replace(/[^\w\s]/g, '')
                  .trim()
                  .replace(/ /g, '-')
              : '';

          return new Tag(
            this.render,
            {
              id: getId(id),
              level: node.attributes.level,
              as: `h${node.attributes.level}`,
            },
            node.transformChildren(config),
          );
        },
      },
    },
  });
  const headings = collectHeadings(content);

  return json({ content, headings });
}

type HeadingSection = {
  title: string;
  level: number;
  id: string;
};

function collectHeadings(
  node: RenderableTreeNode,
  sections: HeadingSection[] = [],
) {
  if (node && node instanceof Tag) {
    if (node.name.match(/(Heading)/)) {
      const title = node.children[0];
      if (typeof title === 'string') {
        sections.push({
          title,
          level: node.attributes.level,
          id: node.attributes.id,
        });
      }
    }

    if (node.children) {
      for (const child of node.children) {
        collectHeadings(child, sections);
      }
    }
  }

  return sections;
}

export default function Route() {
  const response = useLoaderData<typeof loader>();
  if (response === 'article-not-found') {
    return (
      <>
        <StyledContainer>
          <Box maxW={{ base: 'full', md: '3xl' }} m={'auto'}>
            <article>
              <Heading>Article not found</Heading>
              <Alert status="warning">
                <AlertIcon />
                The article you are looking for does not exist, or is
                in construction.
              </Alert>
            </article>
          </Box>
        </StyledContainer>
        <PageTableOfContents headings={[]} />
      </>
    );
  }
  const { content, headings } = response;
  return (
    <>
      <StyledContainer>
        <Stack maxW={{ base: 'full', md: '3xl' }} m={'auto'}>
          {Markdoc.renderers.react(content, React, {
            components: {
              CodeExample,
              Heading: Heading,
              InlineCode: Code,
              Text,
              Link: ({
                href,
                children,
              }: { href: string } & LinkProps) => (
                <Link to={href}>
                  <Text as="span" decoration={'underline'}>
                    {children}
                  </Text>
                </Link>
              ),
              Ul: UnorderedList,
              Callout: ({
                type,
                children,
              }: { type: AlertStatus } & AlertProps) => (
                <Alert status={type}>
                  <AlertIcon />
                  <Stack spacing={3}>{children}</Stack>
                </Alert>
              ),
            },
          })}
        </Stack>
        <Spacer minH={'50%'} />
        <Footer />
      </StyledContainer>
      <PageTableOfContents headings={headings} />
    </>
  );
}

const SContainer = styled(Container)`
  // Space items inside article
  article > * {
    margin-bottom: 16px;
    font-weight: 300;
  }
`;
const StyledContainer = ({ children }: ContainerProps) => {
  return (
    <SContainer
      flexGrow={1}
      maxW={{ base: 'full', md: 'full' }}
      mt={{ base: 3, md: 10 }}
      overflowY="scroll"
    >
      {children}
    </SContainer>
  );
};

const PageTableOfContents = ({
  headings,
}: {
  headings: HeadingSection[];
}) => (
  <Stack
    m={0}
    display={{ base: 'none', lg: 'flex' }}
    w={'300px'}
    minW={'300px'}
    p={5}
    bgColor={useColorModeValue('gray.200', 'gray.700')}
  >
    <Stack>
      <Heading as="h5">{smallCaps('ON THIS PAGE')}</Heading>
      {headings.map(({ title, level, id }) => (
        <Link key={`toc-link-${id}`} to={`#${id}`}>
          <Text ml={level * 2}>{title}</Text>
        </Link>
      ))}
    </Stack>
  </Stack>
);

const smallCaps = (text: string) => {
  return (
    <Text as="span" textTransform="uppercase" fontSize="xs">
      {text}
    </Text>
  );
};

export const ErrorBoundary = ({ error }: { error: Error }) => {
  return (
    <Container>
      <H1 mt="5">Oops ! {error.message}</H1>
    </Container>
  );
};
