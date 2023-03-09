import * as TE from "fp-ts/lib/TaskEither.js";
import { Observable, of } from "rxjs";
import {
  ClusterNodeInformation,
  CoordinationClient,
} from "./CoordinationClient";

export class SingleNodeCoordinationClient implements CoordinationClient {
  getClusterNodeInformation(): Observable<ClusterNodeInformation> {
    return of({ currentNodeId: 0, clusterSize: 1 });
  }
  close(): TE.TaskEither<Error, void> {
    return TE.of(undefined);
  }
}
