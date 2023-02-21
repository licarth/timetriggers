import { HStack, Stack, Tag, TagLabel, Text } from "@chakra-ui/react";
import { useLoaderData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/server-runtime";
import type { JobDocument } from "@timetriggers/domain";
import { e, Project } from "@timetriggers/domain";
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

const colorScheme = (status: JobDocument["status"]["value"]) => {
  switch (status) {
    case "registered":
      return "blue";
    case "running":
      return "yellow";
    case "completed":
      return "green";
    case "queued":
      return "yellow";
  }
};

const JobStatus = ({ status }: { status: JobDocument["status"] }) => (
  <Tag
    size={"sm"}
    borderRadius="full"
    variant="solid"
    colorScheme={colorScheme(status.value)}
  >
    <TagLabel>{status.value}</TagLabel>
  </Tag>
);

const JobLine = ({ job }: { job: JobDocument }) => (
  <HStack>
    <JobStatus status={job.status} />
    <Tag size={"sm"}>{job.jobDefinition.http?.options?.method} </Tag>
    <Text fontSize="sm">{job.jobDefinition.http?.url}</Text>
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
