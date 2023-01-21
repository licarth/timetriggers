import { Observable } from "rxjs";
import { HttpCallStatusUpdate } from "./HttpCallStatusUpdate/HttpCallStatusUpdate";
import { JobDefinition } from "./JobDefinition";

export interface Worker {
  /**
   * Executes a job.
   *
   *
   */
  execute(jobDefinition: JobDefinition): Observable<HttpCallStatusUpdate>;

  close(): Promise<void>;
}
