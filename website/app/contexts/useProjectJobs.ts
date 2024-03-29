import type { ProjectId, ScheduledAt } from '@timetriggers/domain';
import { e, JobDocument } from '@timetriggers/domain';
import {
  collection,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { pipe } from 'fp-ts/lib/function';
import { draw } from 'io-ts/lib/Decoder';
import { useEffect, useState } from 'react';
import { environmentVariable } from '~/environmentVariable';
import { initializeFirebaseWeb } from '~/initializeFirebaseWeb';
import { useProject } from './ProjectContext';

const { firestore } = initializeFirebaseWeb();

type ProjectJobs =
  | {
      jobs: JobDocument[];
      errors: string[];
    }
  | 'loading';

type HookReturn =
  | {
      loading: false;
      projectId: ProjectId;
      jobs: JobDocument[];
      errors: string[] | null;
      moreResults: boolean;
    }
  | { loading: true };

const jobsRef = `namespaces/${environmentVariable(
  'PUBLIC_NAMESPACE',
)}/jobs`;

export const usePastProjectTriggers = ({
  startAfterScheduledAt,
  limit,
}: {
  startAfterScheduledAt?: ScheduledAt;
  limit?: number;
}): HookReturn => {
  const {
    project: { id: projectId },
  } = useProject();
  const [results, setResults] = useState<ProjectJobs>('loading');
  const theLimit = limit || 10;

  useEffect(() => {
    setResults('loading');
    return onSnapshot(
      query(
        collection(firestore, jobsRef),
        where('projectId', '==', projectId),
        where('status.value', 'in', [
          'queued',
          'rate-limited',
          'running',
          'completed',
          // 'cancelled', // TODO: Find a way to show cancelled triggers
          'dead',
        ]),
        orderBy('jobDefinition.scheduledAt', 'desc'),
        ...(startAfterScheduledAt
          ? [startAfter(startAfterScheduledAt)]
          : []),
        fbLimit(theLimit + 1),
      ),
      (snapshot) => {
        pipe(
          snapshot.docs.map((doc) =>
            JobDocument.codec('firestore').decode(doc.data()),
          ),
          e.split,
          ({ successes, errors }) => {
            console.log(
              `🚀 Found ${successes.length} jobs (${errors.length} errors) for project ${projectId}.`,
            );
            errors.forEach((e) => console.error(draw(e)));
            setResults({ jobs: successes, errors: errors.map(draw) });
          },
        );
      },
      (error) => {
        console.error(error);
        setResults({ jobs: [], errors: [error.message] });
      },
    );
  }, [projectId, startAfterScheduledAt]);

  return results !== 'loading'
    ? {
        loading: false,
        projectId,
        jobs: results.jobs.slice(0, theLimit),
        errors: results.errors,
        moreResults: results.jobs.length === theLimit + 1,
      }
    : { loading: true };
};

export const useFutureProjectTriggers = ({
  startAfterScheduledAt,
  limit,
}: {
  startAfterScheduledAt?: ScheduledAt;
  limit?: number;
}): HookReturn => {
  const {
    project: { id: projectId },
  } = useProject();
  const [results, setResults] = useState<ProjectJobs>('loading');
  const theLimit = limit || 10;

  useEffect(() => {
    setResults('loading');
    return onSnapshot(
      query(
        collection(firestore, jobsRef),
        where('projectId', '==', projectId),
        where('status.value', 'in', ['registered']),
        orderBy('jobDefinition.scheduledAt', 'asc'),
        ...(startAfterScheduledAt
          ? [startAfter(startAfterScheduledAt)]
          : []),
        fbLimit(theLimit + 1),
      ),
      (snapshot) => {
        pipe(
          snapshot.docs.map((doc) =>
            JobDocument.codec('firestore').decode(doc.data()),
          ),
          e.split,
          ({ successes, errors }) => {
            console.log(
              `🚀 Found ${successes.length} jobs (${errors.length} errors) for project ${projectId}.`,
            );
            errors.forEach((e) => console.error(draw(e)));
            setResults({ jobs: successes, errors: errors.map(draw) });
          },
        );
      },
      (error) => {
        console.error(error);
        setResults({ jobs: [], errors: [error.message] });
      },
    );
  }, [projectId, startAfterScheduledAt]);

  return results !== 'loading'
    ? {
        loading: false,
        projectId,
        jobs: results.jobs.slice(0, theLimit),
        errors: results.errors,
        moreResults: results.jobs.length === theLimit + 1,
      }
    : { loading: true };
};
