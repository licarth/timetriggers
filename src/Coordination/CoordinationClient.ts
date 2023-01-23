import { Observable } from "rxjs";

export type ClusterNodeInformation = {
  currentNodeId: number;
  clusterSize: number;
};

export interface CoordinationClient {
  getClusterNodeInformation(): Observable<ClusterNodeInformation>;
}
