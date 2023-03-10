import { Spinner, Tag, Tooltip } from '@chakra-ui/react';
import type { JobDocument } from '@timetriggers/domain';
import {
  humanReadibleDurationFromNow,
  StatusCodeTag,
} from '~/components';

export const StatusTag = ({ job }: { job: JobDocument }) => {
  return (
    <>
      {job.lastStatusUpdate?._tag === 'HttpCallCompleted' &&
        job.lastStatusUpdate?.response && (
          <StatusCodeTag
            code={job.lastStatusUpdate.response.statusCode.codeInt}
          />
        )}
      {job.status.value === 'registered' &&
        job.jobDefinition.scheduledAt < new Date() &&
        '⚠️'}
      {!['running', 'completed'].includes(job.status.value) && (
        <>
          <Tooltip
            label={humanReadibleDurationFromNow(
              job.jobDefinition.scheduledAt,
            )}
          >
            <Tag
              size={'sm'}
              colorScheme={'blue'}
              alignContent={'center'}
            >
              {job.status.value}
            </Tag>
          </Tooltip>
        </>
      )}
      {job.status.value == 'running' && (
        <Tag size={'sm'} colorScheme={'orange'}>
          <Spinner size={'xs'} />
        </Tag>
      )}
      {job.lastStatusUpdate?._tag === 'HttpCallErrored' && (
        <Tooltip label={job.lastStatusUpdate.errorMessage}>
          <Tag
            display={'flex'}
            size={'sm'}
            colorScheme={'red'}
            variant="outline"
          >
            ERROR
          </Tag>
        </Tooltip>
      )}
    </>
  );
};
