import { InMemoryDataStructure } from "./InMemoryDataStructure";
import axios from "axios";

export class InMemoryWorker {
  constructor(private dataStructure: InMemoryDataStructure) {
    dataStructure.queuedJobs.subscribe(async (jobDefinition) => {
      axios.post(jobDefinition.url, {
        callbackId: jobDefinition.id,
      });
    });
  }

  start() {}

  stop() {}

  runNextJob() {}
}
