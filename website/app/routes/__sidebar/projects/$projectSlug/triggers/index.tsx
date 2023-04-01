import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Card,
  Center,
  Code,
  Flex,
  HStack,
  IconButton,
  Spacer,
  Spinner,
  Stack,
  Tag,
  Text,
  Tooltip,
} from '@chakra-ui/react';
import { useLoaderData } from '@remix-run/react';
import type { LoaderFunction } from '@remix-run/server-runtime';
import type { JobDocument, ScheduledAt } from '@timetriggers/domain';
import { e, Project } from '@timetriggers/domain';
import { format, formatDistance } from 'date-fns';
import * as E from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';
import * as RTE from 'fp-ts/lib/ReaderTaskEither';
import * as C from 'io-ts/lib/Codec.js';
import _ from 'lodash';
import { useEffect, useState } from 'react';
import { BsArrowCounterclockwise } from 'react-icons/bs';
import { MdExpandLess, MdExpandMore } from 'react-icons/md';
import { VscCircleFilled } from 'react-icons/vsc';
import { H1, H2 } from '~/components';
import {
  ProjectProvider,
  useFutureProjectTriggers,
  usePastProjectTriggers,
  useProject,
} from '~/contexts';
import { getProjectSlugOrRedirect } from '~/loaders/getProjectIdOrRedirect';
import { getProjectBySlugOrRedirect } from '~/loaders/getProjectOrRedirect';
import { getUserOrRedirect } from '~/loaders/getUserOrRedirect';
import { loaderFromRte } from '~/utils/loaderFromRte.server';
import {
  humanReadibleDurationFromNow,
  useRateLimits,
} from './components';
import { StatusTag } from './components/StatusTag';

const wireCodec = C.struct({ project: Project.codec('string') });

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
      RTE.map(({ project }) => wireCodec.encode({ project })),
    ),
  );
};
const humanReadableSizeBytes = (sizeInBytes: number) => {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }
  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(0)} KB`;
  }
  if (sizeInBytes < 1024 * 1024 * 1024) {
    return `${(sizeInBytes / 1024 / 1024).toFixed(2)} MB`;
  }
  return `${(sizeInBytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const RateLimits = ({
  jobDocument,
}: {
  jobDocument: JobDocument;
}) => {
  const rateLimitStates = useRateLimits({ jobDocument });

  if (rateLimitStates.loading) {
    return <Spinner />;
  }

  return (
    <Box p={3} m={2}>
      <H2>Rate Limits</H2>
      {jobDocument.rateLimitKeys?.map((rateLimitKey) => {
        const rateLimit = rateLimitStates.rateLimits.find(
          (r) => r.key === rateLimitKey,
        );
        return (
          <HStack key={rateLimitKey} mt={1}>
            <Tag size={'sm'}>{rateLimitKey.split(':')[0]}</Tag>
            {rateLimit?.satisfiedAt && (
              <>
                <Tag size={'sm'} colorScheme={'green'}>
                  ✅
                </Tag>
                <Text>
                  waited{' '}
                  {rateLimit.createdAt &&
                    formatDistance(
                      rateLimit.satisfiedAt,
                      rateLimit.createdAt,
                      {
                        includeSeconds: true,
                      },
                    )}
                </Text>
              </>
            )}
            {rateLimit && !rateLimit.satisfiedAt && (
              <Tag size={'sm'} colorScheme="yellow">
                ⏳ Waiting...
              </Tag>
            )}
          </HStack>
        );
      })}
    </Box>
  );
};

const JobLine = ({ job: jobDocument }: { job: JobDocument }) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => setExpanded(!expanded);

  return (
    <Card w={'100%'} variant="outline" m={1} justifyContent="stretch">
      <Stack ml={1}>
        <HStack
          onClick={() => toggleExpanded()}
          cursor="pointer"
          p={1}
        >
          <StatusTag job={jobDocument} />
          <Tag size={'sm'}>
            {jobDocument.jobDefinition.http?.options?.method}{' '}
          </Tag>
          <Text fontSize="sm">
            {jobDocument.jobDefinition.http?.domain()}
          </Text>
          {jobDocument.lastStatusUpdate &&
            jobDocument.lastStatusUpdate._tag ===
              'HttpCallCompleted' &&
            jobDocument.lastStatusUpdate.response?.sizeInBytes && (
              <Text fontSize={'70%'}>
                {humanReadableSizeBytes(
                  jobDocument.lastStatusUpdate.response.sizeInBytes,
                )}
              </Text>
            )}
          {pipe(
            jobDocument.status.durationMs(),
            E.fold(
              () => <></>,
              (durationMs) => (
                <Text fontSize={'70%'}>{durationMs} ms</Text>
              ),
            ),
          )}
          {jobDocument.status.value === 'registered' && (
            <Tooltip
              label={format(
                jobDocument.jobDefinition.scheduledAt,
                'PPpp (z)',
              )}
            >
              <Text fontSize={'0.7em'} fontStyle="italic">
                {humanReadibleDurationFromNow(
                  jobDocument.jobDefinition.scheduledAt,
                )}
              </Text>
            </Tooltip>
          )}
          <IconButton
            size={'xs'}
            variant={'unstyled'}
            style={{ marginLeft: 'auto' }}
            aria-label="expand-trigger-card"
            icon={expanded ? <MdExpandLess /> : <MdExpandMore />}
          />
        </HStack>
        {expanded && (
          <Flex
            alignItems={'flex-start'}
            flexWrap="wrap"
            fontSize={'0.7em'}
          >
            <Box p={2} m={2}>
              <Text>id: {jobDocument.jobDefinition.id}</Text>
              {jobDocument.jobDefinition.customKey && (
                <Text>
                  custom key: {jobDocument.jobDefinition.customKey}
                </Text>
              )}
              <Text>
                Scheduled At{' '}
                <Code fontSize={'0.8em'}>
                  {format(
                    jobDocument.jobDefinition.scheduledAt,
                    'PPpp (z)',
                  )}
                </Code>
              </Text>
              {jobDocument.status.startedAt && (
                <Text>
                  Started At{' '}
                  <Code fontSize={'0.8em'}>
                    {format(jobDocument.status.startedAt, 'PPpp (z)')}
                  </Code>
                </Text>
              )}
              <Spacer h={3} />
              <H2>Request Headers</H2>
              <Text fontSize={'70%'}>
                {jobDocument.jobDefinition.http?.url}
              </Text>
              {jobDocument.lastStatusUpdate &&
                jobDocument.lastStatusUpdate._tag ===
                  'HttpCallCompleted' &&
                jobDocument.jobDefinition.http?.options?.headers && (
                  <Code
                    fontSize={'70%'}
                    // keep line breaks
                    whiteSpace="pre-wrap"
                    maxH={'100px'}
                    overflow={'scroll'}
                  >
                    {jobDocument.jobDefinition.http?.options?.headers.headersArray.map(
                      (header) => `${header.key}: ${header.value}\n`,
                    )}
                  </Code>
                )}
            </Box>
            {jobDocument.status.value !== 'registered' && (
              <Box p={2} m={2}>
                <H2>Timings</H2>
                <Text whiteSpace={'pre'}>
                  {pipe(
                    _.zip(
                      jobDocument.status
                        .getTimingsMs(
                          jobDocument.jobDefinition.scheduledAt,
                        )
                        .map((t) => `${t} ms`),
                      [
                        'registered > rate-limited',
                        'rate-limited > queued',
                        'queued > started',
                        'started > completed',
                      ],
                    )
                      .map(([a, b]) => `${b}: ${a ?? '⏳'}`)
                      .join('\n'),
                  )}
                </Text>
              </Box>
            )}
            {jobDocument.status.value !== 'registered' && (
              <RateLimits jobDocument={jobDocument} />
            )}
          </Flex>
        )}
      </Stack>
    </Card>
  );
};

const EmptyState = () => (
  <Center w={'100%'} h={'100%'}>
    <Text fontSize={'xl'}>No triggers found !</Text>
  </Center>
);

const PastTriggersList = () => {
  const [startAfter, setStartAfter] = useState<ScheduledAt>();
  const {
    project: { id: projectId },
  } = useProject();

  useEffect(() => {
    setStartAfter(undefined);
  }, [projectId]);

  const [pause, setPause] = useState(false);
  const pastTriggers = usePastProjectTriggers({
    startAfterScheduledAt: startAfter,
    limit: 15,
  });
  const { jobs, errors, moreResults } =
    pastTriggers.loading === false
      ? pastTriggers
      : { jobs: [], errors: [], moreResults: false };

  return (
    <Box
      w={{
        base: '100%',
      }}
    >
      <HStack justifyContent={'space-between'} w={'100%'}>
        {startAfter ? (
          <Button
            variant={startAfter ? 'solid' : 'outline'}
            leftIcon={
              startAfter ? (
                <BsArrowCounterclockwise />
              ) : (
                <VscCircleFilled color={'red'} />
              )
            }
            size={'xs'}
            onClick={() => setStartAfter(undefined)}
            // isDisabled={!startAfter}
          >
            {startAfter && 'BACK TO'} LIVE
          </Button>
        ) : (
          <Tag size="sm" variant="outline">
            <VscCircleFilled color={'red'} /> LIVE
          </Tag>
        )}
        <Button
          size={'xs'}
          isDisabled={!moreResults}
          onClick={() =>
            setStartAfter(_.last(jobs)?.jobDefinition.scheduledAt)
          }
        >
          {'EARLIER JOBS >'}
        </Button>
      </HStack>
      {!_.isEmpty(errors) && (
        <Alert status="error">
          <Stack alignItems={'flex-start'}>
            <HStack>
              <AlertIcon />
              <Text>There was an error listing your jobs:</Text>
            </HStack>
            {<Code>{errors}</Code>}
          </Stack>
        </Alert>
      )}
      {pastTriggers.loading ? (
        <Center>
          <Spinner />
        </Center>
      ) : (
        <PaginatedTriggers jobs={jobs} />
      )}
      {pastTriggers.loading === false &&
        !startAfter &&
        _.isEmpty(jobs) && <EmptyState />}
    </Box>
  );
};

const FutureTriggersList = () => {
  const [startAfter, setStartAfter] = useState<ScheduledAt>();
  const {
    project: { id: projectId },
  } = useProject();

  useEffect(() => {
    setStartAfter(undefined);
  }, [projectId]);

  const futureTriggers = useFutureProjectTriggers({
    startAfterScheduledAt: startAfter,
    limit: 10,
  });

  const { jobs, errors, moreResults } =
    futureTriggers.loading === false
      ? futureTriggers
      : { jobs: [], errors: [], moreResults: false };

  return (
    <Box
      w={{
        base: '100%',
      }}
    >
      <HStack justifyContent={'space-between'} w={'100%'}>
        {startAfter ? (
          <Button
            variant={startAfter ? 'solid' : 'outline'}
            leftIcon={
              startAfter ? (
                <BsArrowCounterclockwise />
              ) : (
                <VscCircleFilled color={'red'} />
              )
            }
            size={'xs'}
            onClick={() => setStartAfter(undefined)}
            // isDisabled={!startAfter}
          >
            {startAfter && 'BACK TO'} LIVE
          </Button>
        ) : (
          <Tag size="sm" variant="outline">
            <VscCircleFilled color={'red'} /> LIVE
          </Tag>
        )}
        <Button
          size={'xs'}
          isDisabled={!moreResults}
          onClick={() =>
            setStartAfter(_.last(jobs)?.jobDefinition.scheduledAt)
          }
        >
          {'LATER JOBS >'}
        </Button>
      </HStack>
      {!_.isEmpty(errors) && (
        <Alert status="error">
          <Stack alignItems={'flex-start'}>
            <HStack>
              <AlertIcon />
              <Text>There was an error listing your jobs:</Text>
            </HStack>
            {<Code>{errors}</Code>}
          </Stack>
        </Alert>
      )}
      {futureTriggers.loading ? (
        <Center>
          <Spinner />
        </Center>
      ) : (
        <PaginatedTriggers jobs={futureTriggers.jobs} />
      )}
      {futureTriggers.loading === false &&
        !startAfter &&
        _.isEmpty(jobs) && <EmptyState />}
    </Box>
  );
};

const PaginatedTriggers = ({ jobs }: { jobs: JobDocument[] }) => {
  return (
    <Box m={1} pt={3}>
      {jobs.map((job) => (
        <JobLine key={job.jobDefinition.id} job={job} />
      ))}
    </Box>
  );
};

const JobsList = () => {
  return (
    <>
      {
        <Stack alignItems="flex-start">
          <H1>Future Triggers</H1>
          <FutureTriggersList />
          <H1>Past Triggers</H1>
          <PastTriggersList />
        </Stack>
      }
    </>
  );
};

export default () => {
  const { project } = e.unsafeGetOrThrow(
    pipe(useLoaderData(), wireCodec.decode),
  );

  return (
    <ProjectProvider project={project}>
      <JobsList />
    </ProjectProvider>
  );
};
