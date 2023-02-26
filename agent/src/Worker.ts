import { Observable } from "rxjs";
import { HttpCallStatusUpdate } from "@timetriggers/domain";
import { JobDefinition } from "@timetriggers/domain";

export interface Worker {
  /**
   * Executes a job.
   *
   *
   */
  execute(jobDefinition: JobDefinition): Observable<HttpCallStatusUpdate>;

  close(): Promise<void>;
}
