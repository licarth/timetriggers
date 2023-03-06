import { exec } from "child_process";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import { Observable, ReplaySubject } from "rxjs";
import {
  ClusterNodeInformation,
  CoordinationClient,
} from "./CoordinationClient";

export class KubernetesStatefulsetCoordinationClient
  implements CoordinationClient
{
  private currentClusterSize?: number;
  private currentNodeId: number;
  private clearIntervalId?: NodeJS.Timeout;
  private subject = new ReplaySubject<ClusterNodeInformation>(1); // Emit the most recent information to new subscribers

  private constructor({ currentNodeId }: { currentNodeId: number }) {
    this.currentNodeId = currentNodeId;
  }

  private async startClusterSizePolling() {
    this.clearIntervalId = setInterval(async () => {
      try {
        const clusterSize = await this.getClusterSize();
        if (clusterSize !== this.currentClusterSize && clusterSize) {
          this.currentClusterSize = clusterSize;
          console.log(`[CoordinationClient] Cluster size: ${clusterSize}`);
          this.subject.next({
            currentNodeId: this.currentNodeId,
            clusterSize,
          });
        }
      } catch (e) {
        console.error(`Could not get cluster size: ${e}`);
      }
    }, 1000);
  }

  static build = () => {
    const currentNodeId = parseInt(
      _.last(process.env["POD_NAME"]?.split("-")) ?? "-1"
    );
    if (!isNaN(currentNodeId) && currentNodeId >= 0) {
      console.log(`[CoordinationClient] Current node ID: ${currentNodeId}`);
      const client = new KubernetesStatefulsetCoordinationClient({
        currentNodeId,
      });
      client.startClusterSizePolling();
      return TE.of(client);
    } else {
      return TE.left(
        new Error(
          "POD_NAME environment variable is not set or is not in the expected format"
        )
      );
    }
  };

  getClusterNodeInformation(): Observable<ClusterNodeInformation> {
    return this.subject.asObservable();
  }

  close(): TE.TaskEither<Error, void> {
    this.clearIntervalId && clearInterval(this.clearIntervalId);
    return TE.of(undefined);
  }

  /**
   * Uses kubectl to get the current cluster size, asynchronously.
   */
  private async getClusterSize() {
    try {
      const availableReplicas = parseInt(
        (
          await promiseExec(
            "kubectl get statefulset timetriggers-agent -o jsonpath='{.status.availableReplicas}'"
          )
        )
          .toString()
          .trim()
      );
      const replicas = parseInt(
        (
          await promiseExec(
            "kubectl get statefulset timetriggers-agent -o jsonpath='{.spec.replicas}'"
          )
        )
          .toString()
          .trim()
      );

      return Math.min(availableReplicas, replicas);
    } catch (e) {
      console.error("Error getting cluster size", e);
      return undefined;
    }
  }
}

const promiseExec = (command: string) =>
  new Promise<string>((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
