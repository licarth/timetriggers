import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Card,
  Center,
  Code,
  Heading,
  HStack,
  Spinner,
  Stack,
  Tag,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { useLoaderData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/server-runtime";
import type { JobDocument, ScheduledAt } from "@timetriggers/domain";
import { e, Project } from "@timetriggers/domain";
import { formatDistanceToNow } from "date-fns";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as C from "io-ts/lib/Codec.js";
import _ from "lodash";
import { useEffect, useState } from "react";
import { BsArrowCounterclockwise } from "react-icons/bs";
import { VscCircleFilled } from "react-icons/vsc";
import { ProjectProvider, useProject, useProjectJobs } from "~/contexts";
import { getProjectSlugOrRedirect } from "~/loaders/getProjectIdOrRedirect";
import { getProjectBySlugOrRedirect } from "~/loaders/getProjectOrRedirect";
import { getUserOrRedirect } from "~/loaders/getUserOrRedirect";
import { loaderFromRte } from "~/utils/loaderFromRte.server";

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
const StatusTag = ({ job }: { job: JobDocument }) => {
  return (
    <>
      {job.lastStatusUpdate?._tag === "HttpCallCompleted" &&
        job.lastStatusUpdate?.response && (
          <>
            <Tag
              size={"sm"}
              colorScheme={colorByStatusCode(
                job.lastStatusUpdate.response.statusCode.codeInt
              )}
            >
              {job.lastStatusUpdate.response.statusCode.codeInt}
            </Tag>
          </>
        )}
      {!["running", "completed"].includes(job.status.value) && (
        <Tooltip
          label={humanReadibleDurationFromNow(job.jobDefinition.scheduledAt)}
        >
          <Tag size={"sm"} colorScheme={"blue"} alignContent={"center"}>
            {job.status.value}
          </Tag>
        </Tooltip>
      )}
      {job.status.value == "running" && (
        <Tag size={"sm"} colorScheme={"orange"}>
          <Spinner size={"xs"} />
        </Tag>
      )}
      {job.lastStatusUpdate?._tag === "HttpCallErrored" && (
        <Tooltip label={job.lastStatusUpdate.errorMessage}>
          <Tag
            display={"flex"}
            size={"sm"}
            colorScheme={"red"}
            variant="outline"
          >
            ERROR
          </Tag>
        </Tooltip>
      )}
    </>
  );
};

const humanReadableSizeBytes = (sizeInBytes: number) => {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }
  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(2)} KB`;
  }
  if (sizeInBytes < 1024 * 1024 * 1024) {
    return `${(sizeInBytes / 1024 / 1024).toFixed(2)} MB`;
  }
  return `${(sizeInBytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const JobLine = ({ job }: { job: JobDocument }) => (
  <Card w={"100%"} variant="outline" p={1} m={1} justifyContent="stretch">
    <HStack>
      <StatusTag job={job} />
      <Tag size={"sm"}>{job.jobDefinition.http?.options?.method} </Tag>
      <Text fontSize="sm">{job.jobDefinition.http?.domain()}</Text>
      {job.lastStatusUpdate &&
        job.lastStatusUpdate._tag === "HttpCallCompleted" &&
        job.lastStatusUpdate.response?.sizeInBytes && (
          <Text fontSize={"70%"}>
            {humanReadableSizeBytes(job.lastStatusUpdate.response.sizeInBytes)}
          </Text>
        )}
      {pipe(
        job.status.durationMs(),
        E.fold(
          () => <></>,
          (durationMs) => <Text fontSize={"70%"}>{durationMs} ms</Text>
        )
      )}
      {/* <IconButton
        size={"xs"}
        variant={"unstyled"}
        style={{ marginLeft: "auto" }}
        aria-label="expand-trigger-card"
        icon={<MdExpandMore />}
      /> */}
    </HStack>
  </Card>
);

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
          {"EARLER JOBS >"}
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
      {jobs
        // .filter(({ status: { value } }) => value != "registered")
        .map((job) => (
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
          <Heading>Past Triggers</Heading>
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

const colorByStatusCode = (statusCode: number) => {
  if (statusCode >= 200 && statusCode < 300) {
    return "green";
  }
  if (statusCode >= 300 && statusCode < 400) {
    return "blue";
  }
  if (statusCode >= 400 && statusCode < 500) {
    return "yellow";
  }
  if (statusCode >= 500 && statusCode < 600) {
    return "red";
  }
  return "gray";
};

const humanReadibleDurationFromNow = (date: Date) => {
  // With date-fns
  const duration = formatDistanceToNow(date, { addSuffix: true });
  return duration;
};
