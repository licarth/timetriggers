import { InMemoryDataStructure } from "./InMemoryDataStructure";
import { AxiosWorker } from "@/AxiosWorker";

export class InMemoryWorker {
  constructor(private dataStructure: InMemoryDataStructure) {
    dataStructure.queuedJobs.subscribe(async (jobDefinition) => {
      new AxiosWorker({ clock: this.dataStructure.clock })
        .execute(jobDefinition)
        .subscribe();
    });
  }

  start() {}

  stop() {}

  runNextJob() {}
}
