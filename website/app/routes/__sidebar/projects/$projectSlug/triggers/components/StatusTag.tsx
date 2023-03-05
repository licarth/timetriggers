import { Spinner, Tag, Text, Tooltip } from "@chakra-ui/react";
import type { JobDocument } from "@timetriggers/domain";
import { colorByStatusCode } from "./colorByStatusCode";
import { httpCodeExplanation } from "./httpCodeExplanation";
import { humanReadibleDurationFromNow } from "./humanReadibleDurationFromNow";

export const StatusTag = ({ job }: { job: JobDocument }) => {
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
              <Tooltip
                label={
                  <Text>
                    {httpCodeExplanation(
                      job.lastStatusUpdate.response.statusCode.codeInt
                    )}
                  </Text>
                }
              >
                <Text>{job.lastStatusUpdate.response.statusCode.codeInt}</Text>
              </Tooltip>
            </Tag>
          </>
        )}
      {!["running", "completed"].includes(job.status.value) && (
        <>
          <Tooltip
            label={humanReadibleDurationFromNow(job.jobDefinition.scheduledAt)}
          >
            <Tag size={"sm"} colorScheme={"blue"} alignContent={"center"}>
              {job.status.value}
            </Tag>
          </Tooltip>
        </>
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
