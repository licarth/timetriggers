import type { ProjectId, ScheduledAt } from '@timetriggers/domain';
import { e, JobDocument } from '@timetriggers/domain';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { pipe } from 'fp-ts/lib/function';
import * as React from 'react';
import { environmentVariable } from '~/environmentVariable';
// import { FullStoryAPI } from "react-fullstory";
import { draw } from 'io-ts/lib/Decoder';
import { initializeFirebaseWeb } from '../initializeFirebaseWeb';

const { firestore, auth } = initializeFirebaseWeb();

type ContextState =
  | {
      loading: false;
      projectId: ProjectId;
      jobs: JobDocument[];
      errors: string[] | null;
    }
  | { loading: true };

const ProjectJobsContext = React.createContext<ContextState>({
  loading: true,
});

const ProjectJobsProvider = ({
  children,
  projectId,
}: React.PropsWithChildren & { projectId: ProjectId }) => {
  type ProjectJobs =
    | {
        jobs: JobDocument[];
        errors: string[];
      }
    | 'loading';

  const [results, setResults] =
    React.useState<ProjectJobs>('loading');

  const [startAfterScheduledAt, setStartAfterScheduledAt] =
    React.useState<ScheduledAt | null>(null);

  console.log(
    `✅ auth.currentUser`,
    auth.currentUser?.uid,
    `projectId`,
    projectId,
  );

  const jobsRef = `namespaces/${environmentVariable(
    'PUBLIC_NAMESPACE',
  )}/jobs`;

  React.useEffect(() => {
    setResults('loading');
    return onSnapshot(
      query(
        collection(firestore, jobsRef),
        where('projectId', '==', projectId),
        orderBy('jobDefinition.scheduledAt', 'desc'),
        ...(startAfterScheduledAt
          ? [startAfter(startAfterScheduledAt)]
          : []),
        limit(10),
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
  }, [projectId]);

  return (
    <ProjectJobsContext.Provider
      value={
        results !== 'loading'
          ? {
              loading: false,
              projectId,
              jobs: results.jobs,
              errors: results.errors,
            }
          : { loading: true }
      }
    >
      {children}
    </ProjectJobsContext.Provider>
  );
};

export { ProjectJobsProvider };
