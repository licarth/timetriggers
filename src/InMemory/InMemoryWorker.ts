import { InMemoryDataStructure } from "./InMemoryDataStructure";
import axios from "axios";

export class InMemoryWorker {
  constructor(private dataStructure: InMemoryDataStructure) {
    dataStructure.queuedJobs.subscribe(async (jobDefinition) => {
      console.log("Received job", jobDefinition.id);
      axios.post("http://localhost:3000", {
        callbackId: jobDefinition.id,
      });
    });
  }

  start() {}

  stop() {}

  runNextJob() {}
}
