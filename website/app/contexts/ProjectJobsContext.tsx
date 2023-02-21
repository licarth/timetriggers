import { e, JobDocument, ProjectId } from "@timetriggers/domain";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { pipe } from "fp-ts/lib/function";
import * as React from "react";
import { environmentVariable } from "~/environmentVariable";
// import { FullStoryAPI } from "react-fullstory";
import { draw } from "io-ts/lib/Decoder";
import { initializeFirebaseWeb } from "../initializeFirebaseWeb";

const { firestore, auth } = initializeFirebaseWeb();

type ContextState = {
  projectId: ProjectId;
  jobs: JobDocument[];
};

const ProjectJobsContext = React.createContext<ContextState | undefined>(
  undefined
);

const ProjectJobsProvider = ({
  children,
  projectId,
}: React.PropsWithChildren & { projectId: ProjectId }) => {
  const [jobs, setJobs] = React.useState<JobDocument[]>([]);

  console.log(
    `✅ auth.currentUser`,
    auth.currentUser?.uid,
    `projectId`,
    projectId
  );

  const jobsRef = `namespaces/${environmentVariable("PUBLIC_NAMESPACE")}/jobs`;

  React.useEffect(
    () =>
      onSnapshot(
        query(
          collection(firestore, jobsRef),
          where("projectId", "==", projectId),
          orderBy("jobDefinition.scheduledAt", "desc"),
          limit(100)
        ),
        (snapshot) => {
          pipe(
            snapshot.docs.map((doc) =>
              JobDocument.codec("firestore").decode(doc.data())
            ),
            e.split,
            ({ successes, errors }) => {
              setJobs(successes);
              console.log(
                `🚀 Found ${successes.length} jobs (${errors.length} errors) for project ${projectId}.`
              );
              errors.forEach((e) => console.error(draw(e)));
            }
          );
        }
      ),
    []
  );

  return (
    <ProjectJobsContext.Provider value={{ projectId, jobs }}>
      {children}
    </ProjectJobsContext.Provider>
  );
};

function useProjectJobs() {
  const context = React.useContext(ProjectJobsContext);
  if (context === undefined) {
    throw new Error("useProjectJobs must be used within a ProjectJobsProvider");
  }
  return context;
}

export { ProjectJobsProvider, useProjectJobs };
