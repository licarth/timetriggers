import { e, JobDocument, RateLimit } from "@timetriggers/domain";
import { collection, onSnapshot, query } from "firebase/firestore";
import { pipe } from "fp-ts/lib/function";
import { draw } from "io-ts/lib/Decoder";
import { useEffect, useState } from "react";
import { environmentVariable } from "~/environmentVariable";
import { initializeFirebaseWeb } from "~/initializeFirebaseWeb";

const { firestore } = initializeFirebaseWeb();

type HookReturn =
  | {
      loading: false;
      errors: string[] | null;
      rateLimits: RateLimit[];
    }
  | { loading: true };

const jobsRef = `namespaces/${environmentVariable("PUBLIC_NAMESPACE")}/jobs`;

export const useRateLimits = ({
  jobDocument,
}: {
  jobDocument: JobDocument;
}): HookReturn => {
  const [results, setResults] = useState<HookReturn>({ loading: true });

  const jobId = jobDocument.jobDefinition.id;

  useEffect(() => {
    return onSnapshot(
      query(collection(firestore, jobsRef + `/${jobId}/rate-limits`)),
      (snapshot) => {
        pipe(
          snapshot.docs.map((doc) =>
            RateLimit.codec("firestore").decode(doc.data())
          ),
          e.split,
          ({ successes, errors }) => {
            console.log(
              `🚀 Found ${successes.length} rate limits (${errors.length} errors) for job ${jobId}.`
            );
            errors.forEach((e) => console.error(draw(e)));
            setResults({
              loading: false,
              rateLimits: successes,
              errors: errors.map(draw),
            });
          }
        );
      },
      (error) => {
        console.error(error);
        setResults({ loading: false, rateLimits: [], errors: [error.message] });
      }
    );
  }, [jobId]);

  return results;
};
