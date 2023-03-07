import { Card, Flex, Heading, Stack, Text, useColorModeValue } from '@chakra-ui/react';
import { Link, useLoaderData } from '@remix-run/react';
import type { LoaderFunction } from '@remix-run/server-runtime';
import { redirect } from '@remix-run/server-runtime';
import { e, getProjectsForUser, Project } from '@timetriggers/domain';
import { pipe } from 'fp-ts/lib/function';
import * as RTE from 'fp-ts/lib/ReaderTaskEither';
import * as C from 'io-ts/lib/Codec.js';
import { getUserOrRedirect } from '~/loaders/getUserOrRedirect';
import { loaderFromRte } from '~/utils/loaderFromRte.server';

const wireCodec = C.array(Project.codec('string'));

export const loader: LoaderFunction = async ({ request }) =>
    loaderFromRte(
        pipe(
            RTE.Do,
            RTE.bind('user', () => getUserOrRedirect(request, '/login')),
            RTE.chainW(({ user }) => getProjectsForUser(user.id)),
            RTE.filterOrElseW(
                (projects) => projects.length !== 1,
                (projects) => redirect(`/projects/${projects[0].slug}`),
            ),
            RTE.filterOrElseW(
                (projects) => projects.length > 0,
                () => redirect(`/create-project`),
            ),
            RTE.map((projects) => wireCodec.encode(projects)),
        ),
    );

const Document = () => {
    const projects = e.unsafeGetOrThrow(pipe(useLoaderData(), wireCodec.decode));

    const bgColor = useColorModeValue('white', 'gray.800');
    return (
        <Stack spacing={8}>
            <Text>
                🎉 You are a participant in more than one timetriggers.io project ! Please select
                below which project you'd like to see.
            </Text>
            <Flex bgColor={bgColor} wrap="wrap">
                {projects.map((project) => (
                    <Card key={project.id} to={project.slug} as={Link} m={4} p={6} size="sm">
                        <Heading size="sm">{String(project.slug)}</Heading>
                    </Card>
                ))}
            </Flex>
        </Stack>
    );
};

export default Document;
