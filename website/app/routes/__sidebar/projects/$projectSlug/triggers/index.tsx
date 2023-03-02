import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Card,
  Center,
  Code,
  Flex,
  Heading,
  HStack,
  IconButton,
  Spinner,
  Stack,
  Tag,
  Text,
} from "@chakra-ui/react";
import { useLoaderData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/server-runtime";
import type { JobDocument, ScheduledAt } from "@timetriggers/domain";
import { e, Project } from "@timetriggers/domain";
import { formatDistance, formatDuration, intervalToDuration } from "date-fns";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as C from "io-ts/lib/Codec.js";
import _ from "lodash";
import { useEffect, useState } from "react";
import { BsArrowCounterclockwise } from "react-icons/bs";
import { MdExpandLess, MdExpandMore } from "react-icons/md";
import { VscCircleFilled } from "react-icons/vsc";
import { H1, H2 } from "~/components";
import { ProjectProvider, useProject, useProjectJobs } from "~/contexts";
import { getProjectSlugOrRedirect } from "~/loaders/getProjectIdOrRedirect";
import { getProjectBySlugOrRedirect } from "~/loaders/getProjectOrRedirect";
import { getUserOrRedirect } from "~/loaders/getUserOrRedirect";
import { loaderFromRte } from "~/utils/loaderFromRte.server";
import { humanReadibleDurationFromNow, useRateLimits } from "./components";
import { StatusTag } from "./components/StatusTag";

const wireCodec = C.struct({ project: Project.codec("string") });

export const loader: LoaderFunction = async ({ params, request }) => {
  return loaderFromRte(
    pipe(
      RTE.Do,
      RTE.bind("projectSlug", () =>
        getProjectSlugOrRedirect(params.projectSlug, "/projects")
      ),
      RTE.bind("user", () => getUserOrRedirect(request)),
      RTE.bindW("project", ({ projectSlug }) =>
        getProjectBySlugOrRedirect({ projectSlug }, "..")
      ),
      RTE.map(({ project }) => wireCodec.encode({ project }))
    )
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

const RateLimits = ({ jobDocument }: { jobDocument: JobDocument }) => {
  const s = useRateLimits({ jobDocument });

  if (s.loading) {
    return <Spinner />;
  }

  return (
    <Box p={3} m={2}>
      <H2>Rate Limits</H2>
      {s.rateLimits.map((rateLimit) => (
        <HStack key={rateLimit.key} mt={1}>
          <Tag size={"sm"}>{rateLimit.key.split(":")[0]}</Tag>
          {rateLimit.satisfiedAt && (
            <Tag size={"sm"} colorScheme={"green"}>
              Satisfied (waited{" "}
              {rateLimit.createdAt &&
                formatDistance(rateLimit.satisfiedAt, rateLimit.createdAt, {
                  includeSeconds: true,
                })}
              )
            </Tag>
          )}
          {!rateLimit.satisfiedAt && (
            <Tag size={"sm"} colorScheme="yellow">
              Waiting...
            </Tag>
          )}
        </HStack>
      ))}
    </Box>
  );
};

const JobLine = ({ job: jobDocument }: { job: JobDocument }) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => setExpanded(!expanded);

  return (
    <Card w={"100%"} variant="outline" p={1} m={1} justifyContent="stretch">
      <Stack ml={1}>
        <HStack onClick={() => toggleExpanded()}>
          <StatusTag job={jobDocument} />
          <Tag size={"sm"}>
            {jobDocument.jobDefinition.http?.options?.method}{" "}
          </Tag>
          <Text fontSize="sm">{jobDocument.jobDefinition.http?.domain()}</Text>
          {jobDocument.lastStatusUpdate &&
            jobDocument.lastStatusUpdate._tag === "HttpCallCompleted" &&
            jobDocument.lastStatusUpdate.response?.sizeInBytes && (
              <Text fontSize={"70%"}>
                {humanReadableSizeBytes(
                  jobDocument.lastStatusUpdate.response.sizeInBytes
                )}
              </Text>
            )}
          {pipe(
            jobDocument.status.durationMs(),
            E.fold(
              () => <></>,
              (durationMs) => <Text fontSize={"70%"}>{durationMs} ms</Text>
            )
          )}
          <IconButton
            size={"xs"}
            variant={"unstyled"}
            style={{ marginLeft: "auto" }}
            aria-label="expand-trigger-card"
            icon={expanded ? <MdExpandLess /> : <MdExpandMore />}
          />
        </HStack>
        {expanded && (
          <Flex alignItems={"flex-start"} flexWrap="wrap">
            <Box p={2} m={2} variant="unstyled">
              <H2>Request Headers</H2>
              <Text fontSize={"70%"}>
                {jobDocument.jobDefinition.http?.url}
              </Text>
              {jobDocument.lastStatusUpdate &&
                jobDocument.lastStatusUpdate._tag === "HttpCallCompleted" &&
                jobDocument.jobDefinition.http?.options?.headers && (
                  <Code
                    fontSize={"70%"}
                    // keep line breaks
                    whiteSpace="pre-wrap"
                    maxH={"100px"}
                    overflow={"scroll"}
                  >
                    {jobDocument.jobDefinition.http?.options?.headers.headersArray.map(
                      (header) => `${header.key}: ${header.value}\n`
                    )}
                  </Code>
                )}
            </Box>
            <RateLimits jobDocument={jobDocument} />
          </Flex>
        )}
      </Stack>
    </Card>
  );
};

const EmptyState = () => (
  <Center w={"100%"} h={"100%"}>
    <Text fontSize={"xl"}>No triggers found !</Text>
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
  const state = useProjectJobs({
    startAfterScheduledAt: startAfter,
    limit: 15,
  });

  const { jobs, errors, moreResults } =
    state.loading === false
      ? state
      : { jobs: [], errors: [], moreResults: false };

  return (
    <Box
      w={{
        base: "100%",
      }}
    >
      <HStack justifyContent={"space-between"} w={"100%"}>
        {startAfter ? (
          <Button
            variant={startAfter ? "solid" : "outline"}
            leftIcon={
              startAfter ? (
                <BsArrowCounterclockwise />
              ) : (
                <VscCircleFilled color={"red"} />
              )
            }
            size={"xs"}
            onClick={() => setStartAfter(undefined)}
            // isDisabled={!startAfter}
          >
            {startAfter && "BACK TO"} LIVE
          </Button>
        ) : (
          <Tag size="sm" variant="outline">
            <VscCircleFilled color={"red"} /> LIVE
          </Tag>
        )}
        <Button
          size={"xs"}
          isDisabled={!moreResults}
          onClick={() => setStartAfter(_.last(jobs)?.jobDefinition.scheduledAt)}
        >
          {"EARLIER JOBS >"}
        </Button>
      </HStack>
      {!_.isEmpty(errors) && (
        <Alert status="error">
          <Stack alignItems={"flex-start"}>
            <HStack>
              <AlertIcon />
              <Text>There was an error listing your jobs:</Text>
            </HStack>
            {<Code>{errors}</Code>}
          </Stack>
        </Alert>
      )}
      {state.loading ? (
        <Center>
          <Spinner />
        </Center>
      ) : (
        <PaginatedPastTriggers jobs={jobs} />
      )}
      {state.loading === false && !startAfter && _.isEmpty(jobs) && (
        <EmptyState />
      )}
    </Box>
  );
};

const PaginatedPastTriggers = ({ jobs }: { jobs: JobDocument[] }) => {
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
          <H1>Past Triggers</H1>
          <PastTriggersList />
        </Stack>
      }
    </>
  );
};

export default () => {
  const { project } = e.unsafeGetOrThrow(
    pipe(useLoaderData(), wireCodec.decode)
  );

  return (
    <ProjectProvider project={project}>
      <JobsList />
    </ProjectProvider>
  );
};
