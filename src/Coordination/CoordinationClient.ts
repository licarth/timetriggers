import { Observable } from "rxjs";
import * as TE from "fp-ts/lib/TaskEither";

export type ClusterNodeInformation = {
  currentNodeId: number;
  clusterSize: number;
};

export interface CoordinationClient {
  getClusterNodeInformation(): Observable<ClusterNodeInformation>;
  close(): TE.TaskEither<Error, void>;
}
