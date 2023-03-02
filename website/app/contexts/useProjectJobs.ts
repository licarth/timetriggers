import type { ProjectId, ScheduledAt } from "@timetriggers/domain";
import { e, JobDocument } from "@timetriggers/domain";
import {
  collection,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { pipe } from "fp-ts/lib/function";
import { draw } from "io-ts/lib/Decoder";
import { useEffect, useState } from "react";
import { environmentVariable } from "~/environmentVariable";
import { initializeFirebaseWeb } from "~/initializeFirebaseWeb";
import { useProject } from "./ProjectContext";

const { firestore } = initializeFirebaseWeb();

type ProjectJobs =
  | {
      jobs: JobDocument[];
      errors: string[];
    }
  | "loading";

type HookReturn =
  | {
      loading: false;
      projectId: ProjectId;
      jobs: JobDocument[];
      errors: string[] | null;
      moreResults: boolean;
    }
  | { loading: true };

const jobsRef = `namespaces/${environmentVariable("PUBLIC_NAMESPACE")}/jobs`;

export const useProjectJobs = ({
  startAfterScheduledAt,
  limit,
}: {
  startAfterScheduledAt?: ScheduledAt;
  limit?: number;
}): HookReturn => {
  const {
    project: { id: projectId },
  } = useProject();
  const [results, setResults] = useState<ProjectJobs>("loading");
  const theLimit = limit || 10;

  useEffect(() => {
    setResults("loading");
    return onSnapshot(
      query(
        collection(firestore, jobsRef),
        where("projectId", "==", projectId),
        orderBy("jobDefinition.scheduledAt", "desc"),
        ...(startAfterScheduledAt ? [startAfter(startAfterScheduledAt)] : []),
        fbLimit(theLimit + 1)
      ),
      (snapshot) => {
        pipe(
          snapshot.docs.map((doc) =>
            JobDocument.codec("firestore").decode(doc.data())
          ),
          e.split,
          ({ successes, errors }) => {
            console.log(
              `🚀 Found ${successes.length} jobs (${errors.length} errors) for project ${projectId}.`
            );
            errors.forEach((e) => console.error(draw(e)));
            setResults({ jobs: successes, errors: errors.map(draw) });
          }
        );
      },
      (error) => {
        console.error(error);
        setResults({ jobs: [], errors: [error.message] });
      }
    );
  }, [projectId, startAfterScheduledAt]);

  return results !== "loading"
    ? {
        loading: false,
        projectId,
        jobs: results.jobs.slice(0, theLimit),
        errors: results.errors,
        moreResults: results.jobs.length === theLimit + 1,
      }
    : { loading: true };
};
