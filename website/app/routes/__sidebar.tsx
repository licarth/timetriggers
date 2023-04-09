import { Container, Flex } from '@chakra-ui/react';
import styled from '@emotion/styled';
import { Outlet, useLoaderData } from '@remix-run/react';
import type { LoaderFunction } from '@remix-run/server-runtime';
import type { ProjectSlug } from '@timetriggers/domain';
import { rte } from '@timetriggers/domain';
import { loaderFromRte } from '~/utils/loaderFromRte.server';

import {
  e,
  FirebaseUser,
  getProjectsForUser,
  getProjectUsageFromSlug,
  MonthlyUsage,
  Project,
  UserPrefs,
} from '@timetriggers/domain';
import * as E from 'fp-ts/lib/Either.js';
import { flow, pipe } from 'fp-ts/lib/function';
import * as RTE from 'fp-ts/lib/ReaderTaskEither';
import * as TE from 'fp-ts/lib/TaskEither';
import * as C from 'io-ts/lib/Codec.js';
import * as D from 'io-ts/lib/Decoder.js';
import { DesktopSidebar } from '~/components/DesktopSidebar';
import { ErrorContainer } from '~/components/ErrorContainer';
import { Footer } from '~/components/footer/Footer';
import { MobileTopbar } from '~/components/MobileTopbar';
import { userPrefs } from '~/cookies.server';
import { getUserOrRedirect } from '~/loaders/getUserOrRedirect';

const wireCodec = pipe(
  C.struct({
    projects: C.array(Project.codec('string')),
    user: FirebaseUser.codec,
  }),
  C.intersect(
    C.partial({
      projectMonthlyUsage: MonthlyUsage.codec,
      userPrefs: UserPrefs.codec('string'),
    }),
  ),
);

export default () => {
  const { projects, user, projectMonthlyUsage, userPrefs } =
    e.unsafeGetOrThrow(pipe(useLoaderData(), wireCodec.decode));

  return (
    <RootStyledFlex flexDir="column" maxW="full" top={0}>
      <MobileTopbar user={user} projects={projects} />
      <StyledFlex flexDir="row" flexGrow={1}>
        <DesktopSidebar
          user={user}
          projects={projects}
          projectMonthlyUsage={projectMonthlyUsage}
          initialNavSize={userPrefs?.initialNavSize}
        />
        <Flex
          overflow="scroll"
          direction={'column'}
          flexGrow="1"
          justifyContent="space-between"
        >
          <Container
            maxW={'6xl'}
            py={{ base: '6', md: '12' }}
            px={{ base: '4', sm: '8' }}
          >
            <Outlet />
          </Container>
          <Footer />
        </Flex>
      </StyledFlex>
    </RootStyledFlex>
  );
};

const getUserPrefsOrDefault = (request: Request) =>
  pipe(
    TE.tryCatch(
      async () => {
        return await userPrefs.parse(request.headers.get('Cookie'));
      },
      (e) => e as Error,
    ),
    TE.chainEitherKW(
      flow(
        UserPrefs.codec('string').decode,
        E.mapLeft((e) => new Error(D.draw(e))),
      ),
    ),
    RTE.fromTaskEither,
    RTE.orElseW(() => RTE.right(UserPrefs.default())),
  );

export const loader: LoaderFunction = async ({ request }) =>
  loaderFromRte(
    pipe(
      RTE.of({
        projectSlug: new URL(request.url).pathname.split(
          '/',
        )[2] as ProjectSlug,
      }),
      RTE.chainW(({ projectSlug }) =>
        pipe(
          RTE.Do,
          rte.apSWMerge(
            pipe(
              RTE.Do,
              RTE.apSW('user', getUserOrRedirect(request, '/login')),
              RTE.bindW('projects', ({ user }) =>
                getProjectsForUser(user.id),
              ),
            ),
          ),
          RTE.apSW('userPrefs', getUserPrefsOrDefault(request)),
          RTE.apSW(
            'projectMonthlyUsage',
            projectSlug
              ? getProjectUsageFromSlug({ projectSlug })
              : RTE.right(undefined),
          ),
        ),
      ),
      RTE.map(wireCodec.encode),
    ),
  );

export const ErrorBoundary = ({ error }: { error: Error }) => {
  console.error(error);
  return <ErrorContainer error={"That's all we know :/"} />;
};

const RootStyledFlex = styled(Flex)`
  height: 100%;
`;

const StyledFlex = styled(Flex)`
  height: 100%;
  max-height: 100%;

  /* mobile viewport bug fix */
  height: -webkit-fill-available;

  /* See 
  https://allthingssmitty.com/2020/05/11/css-fix-for-100vh-in-mobile-webkit/
  and https://github.com/chakra-ui/chakra-ui/issues/6027 */
`;
