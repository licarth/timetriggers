import { InMemoryDataStructure } from "./InMemoryDataStructure";
import axios from "axios";

export class InMemoryWorker {
  constructor(private dataStructure: InMemoryDataStructure) {
    dataStructure.queuedJobs.subscribe(async (jobDefinition) => {
      axios.post("http://localhost:3001", {
        callbackId: jobDefinition.id,
      });
    });
  }

  start() {}

  stop() {}

  runNextJob() {}
}
