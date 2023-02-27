import { HStack, Spinner, Stack, Tag, Text, Tooltip } from "@chakra-ui/react";
import { useLoaderData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/server-runtime";
import type { JobDocument } from "@timetriggers/domain";
import { e, Project } from "@timetriggers/domain";
import { formatDistanceToNow } from "date-fns";
import { pipe } from "fp-ts/lib/function";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as C from "io-ts/lib/Codec.js";
import {
  ProjectJobsProvider,
  useProjectJobs,
} from "~/contexts/ProjectJobsContext";
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

const JobStatus = ({ job }: { job: JobDocument }) => {
  const tagWidth = "70px";
  return (
    <>
      {job.status.value === "registered" && (
        <Tooltip
          label={humanReadibleDurationFromNow(job.jobDefinition.scheduledAt)}
        >
          <Tag size={"sm"} colorScheme={"blue"} alignContent={"center"}>
            planned
          </Tag>
        </Tooltip>
      )}
      {job.status.value !== "registered" &&
        job.status.value !== "completed" && (
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
      <Text>
        {job.lastStatusUpdate?._tag === "HttpCallCompleted" &&
          job.lastStatusUpdate?.response && (
            <Tag
              size={"sm"}
              colorScheme={colorByStatusCode(
                job.lastStatusUpdate.response.statusCode.codeInt
              )}
            >
              {job.lastStatusUpdate.response.statusCode.codeInt}
            </Tag>
          )}
      </Text>
    </>
  );
};

const JobLine = ({ job }: { job: JobDocument }) => (
  <HStack>
    <JobStatus job={job} />
    <Tag size={"sm"}>{job.jobDefinition.http?.options?.method} </Tag>
    <Text fontSize="sm">{job.jobDefinition.http?.domain()}</Text>
  </HStack>
);

const JobsList = () => {
  const { jobs } = useProjectJobs();
  return (
    <Stack alignItems="flex-start">
      {jobs.map((job) => (
        <JobLine key={job.jobDefinition.id} job={job} />
      ))}
    </Stack>
  );
};

export default () => {
  const { project } = e.unsafeGetOrThrow(
    pipe(useLoaderData(), wireCodec.decode)
  );

  return (
    <ProjectJobsProvider projectId={project.id}>
      <JobsList />
    </ProjectJobsProvider>
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
