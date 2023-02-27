import {
  humanReadibleCountdownBetween2Dates,
  humanReadibleMs,
} from "@/Firebase/Processor/humanReadibleMs";
import { ScheduledAt } from "@timetriggers/domain";
import { initializeApp } from "../Firebase/initializeApp";
import { parseHumanReadibleDuration, sleep } from "./utils";

const { firestore } = initializeApp({
  serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
});

(async () => {
  const qps = parseFloat(process.env.QPS || "0.3");
  const schedulingRateLimitQps = parseFloat(
    process.env.API_RATE_LIMIT_QPS || "20"
  );
  const initialDelay = parseHumanReadibleDuration(
    process.env.INITIAL_DELAY || "1s"
  );

  const testDurationMs = parseHumanReadibleDuration(process.env.DURING || "1m");

  const totalNumberOfJobs = Math.floor(testDurationMs / (1000 / qps));

  console.log(`totalNumberOfJobs: ${totalNumberOfJobs}`);

  const scheduledAtGenerator = function* (beginning: Date) {
    let i = 0;
    while (i < totalNumberOfJobs) {
      yield ScheduledAt.fromDate(
        new Date(beginning.getTime() + (i * 1000) / qps + initialDelay)
      );
      i++;
    }
  };
  const beginning = new Date();

  const func = scheduledAtGenerator(beginning);
  console.log(
    `🚀 Starting load test with QPS=${qps} for ${humanReadibleMs(
      testDurationMs
    )}`
  );

  const id = setInterval(async () => {
    const scheduledAt = func.next().value;
    if (!scheduledAt) {
      clearInterval(id);
      console.log(
        "⏳ done scheduling jobs, waiting for jobs to be executed..."
      );
      return;
    }
    const response = await fetch("https://api.timetriggers.io/schedule", {
      method: "GET",

      headers: {
        "X-Timetriggers-At": `${scheduledAt.toISOString()}`,
        "X-Timetriggers-Key": "Dqm0JAXuuSbEy0C1unRbb60ULU0nIWaC",
        "X-Timetriggers-Url": "https://api.timetriggers.io/1",
        "X-Timetriggers-Options": "no_noise",
      },
    });

    console.log(
      `🚀 ${response.status} Scheduled job ${
        (await response.json()).jobId
      }, time remaining before job scheduledAt: ${humanReadibleCountdownBetween2Dates(
        new Date(),
        scheduledAt
      )})`
    );
  }, 1000 / schedulingRateLimitQps);

  setTimeout(() => {
    clearInterval(id);
  }, testDurationMs);

  await sleep(testDurationMs + 1000);
  console.log("✅ done");
})();
