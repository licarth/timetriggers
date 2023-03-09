import { consistentHashingFirebaseArrayPreloaded } from "@/ConsistentHashing/ConsistentHashing";
import { emulatorFirestore } from "@/Firebase/emulatorFirestore";
import { Datastore } from "@/Firebase/Processor/Datastore";
import { FirestoreDatastore } from "@/Firebase/Processor/FirestoreDatastore";
import {
  humanReadibleCountdownBetween2Dates,
  humanReadibleMs,
} from "@/Firebase/Processor/humanReadibleMs";
import { te } from "@/fp-ts";
import {
  Http,
  JobId,
  JobScheduleArgs,
  ScheduledAt,
  Shard,
} from "@timetriggers/domain";
import { initializeApp } from "../Firebase/initializeApp";
import { parseHumanReadibleDuration, sleep } from "./utils";

const { firestore } =
  process.env.EMULATOR === "true"
    ? emulatorFirestore()
    : initializeApp({
        serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      });

const preloadedHashingFunction = consistentHashingFirebaseArrayPreloaded(11);

(async () => {
  const datastore = FirestoreDatastore.factory({
    firestore,
    namespace: `doi-production`,
  });

  const scheduleVia = process.env.SCHEDULE_VIA || "datastore";
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
    scheduleVia === "http"
      ? await scheduleJobHttp(scheduledAt)
      : await scheduleJobDatastore(datastore, scheduledAt);
  }, 1000 / schedulingRateLimitQps);

  setTimeout(() => {
    clearInterval(id);
  }, testDurationMs);

  await sleep(testDurationMs + 1000);
  console.log("✅ done");
})();

async function scheduleJobHttp(scheduledAt: ScheduledAt) {
  const now = new Date();
  const response = await fetch(`${process.env.API}/schedule`, {
    method: "GET",

    headers: {
      "ttr-scheduled-at": `${scheduledAt.toISOString()}`,
      "ttr-api-key": `${process.env.KEY}`,
      "ttr-url": `${process.env.TARGET || "https://api.timetriggers.io/1"}`,
      "ttr-options": "no_noise",
    },
  });

  console.log(
    `[HTTP]🚀 ${response.status} (took ${humanReadibleMs(
      now.getTime() - new Date().getTime()
    )}) Scheduled job ${
      (await response.json()).jobId
    }, time remaining before job scheduledAt: ${humanReadibleCountdownBetween2Dates(
      new Date(),
      scheduledAt
    )})`
  );
}

async function scheduleJobDatastore(
  datastore: Datastore,
  scheduledAt: ScheduledAt
) {
  const now = new Date();
  const jobId = await te.unsafeGetOrThrow(
    datastore.schedule(
      new JobScheduleArgs({
        scheduledAt,
        http: new Http({
          options: undefined,
          url: "https://api.timetriggers.io/1",
        }),
      }),
      (jobId: JobId) =>
        preloadedHashingFunction(jobId)
          .slice(1)
          .map((s) => {
            const parts = s.split("-");
            return new Shard({
              nodeCount: Number(parts[0]),
              nodeId: Number(parts[1]),
            });
          })
    )
  );

  console.log(
    `🚀 took ${humanReadibleMs(
      now.getTime() - new Date().getTime()
    )}) Scheduled job ${jobId}, time remaining before job scheduledAt: ${humanReadibleCountdownBetween2Dates(
      new Date(),
      scheduledAt
    )})`
  );
}
