import {
  Button,
  Card,
  CardProps,
  HStack,
  Icon,
  Input,
  Spinner,
  Stack,
} from '@chakra-ui/react';
import { useLoaderData } from '@remix-run/react';
import type { LoaderFunction } from '@remix-run/server-runtime';
import { redirect } from '@remix-run/server-runtime';
import {
  e,
  FirebaseUser,
  Project,
  ProjectSlug,
  UtcDate,
} from '@timetriggers/domain';
import { pipe } from 'fp-ts/lib/function';
import * as RTE from 'fp-ts/lib/ReaderTaskEither';
import * as C from 'io-ts/lib/Codec.js';
import * as _ from 'lodash';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import { H1, H2 } from '~/components';
import { getProjectSlugOrRedirect } from '~/loaders/getProjectIdOrRedirect';
import { getProjectBySlugOrRedirect } from '~/loaders/getProjectOrRedirect';
import { getUserOrRedirect } from '~/loaders/getUserOrRedirect';
import { loaderFromRte } from '~/utils/loaderFromRte.server';

const wireCodec = C.struct({
  project: Project.codec('string'),
  user: FirebaseUser.codec,
  now: UtcDate.codec('string'),
});

export const loader: LoaderFunction = async ({ params, request }) => {
  return loaderFromRte(
    pipe(
      RTE.Do,
      RTE.bind('projectSlug', () =>
        getProjectSlugOrRedirect(params.projectSlug, '/projects'),
      ),
      RTE.bind('user', () => getUserOrRedirect(request)),
      RTE.bindW('project', ({ projectSlug }) =>
        getProjectBySlugOrRedirect({ projectSlug }, '..'),
      ),
      RTE.map(({ user, project }) => {
        if (project && project.hasReadAccess(user.id)) {
          return {
            project: Project.codec('string').encode(project),
            user: FirebaseUser.codec.encode(user),
            now: UtcDate.codec('string').encode(
              UtcDate.fromDate(new Date()),
            ),
          };
        } else {
          return redirect('..');
        }
      }),
    ),
  );
};

export default function () {
  const { project, user, now } = e.unsafeGetOrThrow(
    pipe(useLoaderData(), wireCodec.decode),
  );

  return (
    <Stack maxW={{ base: 'full', md: '3xl' }}>
      <H1>Settings</H1>
      <CardWithPadding>
        <H2>Project Slug</H2>
        <EditProjectName project={project} />
      </CardWithPadding>
      <CardWithPadding>
        <H2>Pricing Plan</H2>
      </CardWithPadding>
      <CardWithPadding>
        <H2>Members</H2>
      </CardWithPadding>
      <CardWithPadding colorScheme={'red'}>
        <H2 colorScheme={'red'}>Danger Zone</H2>
      </CardWithPadding>
    </Stack>
  );
}

const CardWithPadding = (
  p: { children: React.ReactNode } & CardProps,
) => (
  <Card p={4} {...p}>
    {p.children}
  </Card>
);

const EditProjectName = ({ project }: { project: Project }) => {
  type Inputs = {
    projectId: string;
    slug: string;
  };
  const {
    register,
    watch,
    formState: { errors, isDirty },
  } = useForm<Inputs>();

  watch('slug');

  // Callback version of watch.  It's your responsibility to unsubscribe when done.
  useEffect(() => {
    const subscription = watch((value, { name, type }) => {
      value.slug !== undefined && checkSlugAvailable(value.slug);
    });

    return () => subscription.unsubscribe();
  }, [watch]);

  const [available, setAvailable] = useState<{
    loading: boolean;
    available?: boolean;
  }>();
  const checkSlugAvailable = _.debounce((slug: string) => {
    setAvailable({ loading: true });
    fetch(`/check-slug-available?slug=${slug}`).then((r) =>
      r
        .json()
        .then((r) =>
          setAvailable({ loading: false, available: r?.isAvailable }),
        ),
    );
  }, 300);
  return (
    <form method={'post'} action={'/rename-project'}>
      <HStack justify={'left'} spacing={3}>
        {/* Hidden input for project id */}
        <input
          type="hidden"
          {...register(`projectId`)}
          value={project.id}
        />

        <Input
          size={'xs'}
          defaultValue={project.slug}
          htmlSize={30}
          width="auto"
          // onChange={(e) => checkSlugAvailable(e.target.value)}
          {...register('slug', {
            required: true,
            validate: ProjectSlug.validate,
          })}
        />
        {available &&
          (available?.loading ? (
            <Spinner size={'xs'} />
          ) : !available?.available ? (
            <Icon
              // cross
              as={FaExclamationTriangle}
              color={'yellow.500'}
            />
          ) : (
            <Icon as={FaCheck} color={'green.500'} />
          ))}
        <Button
          size={'xs'}
          variant={'outline'}
          type={'submit'}
          isDisabled={!available?.available || available.loading}
        >
          Rename
        </Button>
      </HStack>
    </form>
  );
};
