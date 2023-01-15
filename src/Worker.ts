import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { JobDefinition } from "./JobDefinition";
import { JobStatusUpdate } from "./JobStatusUpdate";
import { Observable } from "rxjs";

/**
 * An actor executes a job when it's time to do so.
 *
 */
export interface Worker {
  /**
   * Executes a job.
   *
   *
   */

  execute(jobDefinition: JobDefinition): Observable<JobStatusUpdate>;
}
