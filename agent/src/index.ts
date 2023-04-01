import { SystemClock } from "@timetriggers/domain";
import "source-map-support/register.js";
import { environmentVariable } from "./environmentVariable";
import { getOrReportToSentry } from "./Sentry/getOrReportToSentry";
import { initSentry } from "./Sentry/Sentry";
import { start } from "./start";

initSentry();

if (process.env.NEW_RELIC_KEY) {
  console.log("✅ New Relic is enabled");
} else {
  console.log("⚠️ New Relic is disabled");
}

(async () => {
  const namespace = environmentVariable("NAMESPACE") || "local-dev";
  if (environmentVariable("HTTP_API_ONLY") === "true") {
    console.log("HTTP_API_ONLY is set, not starting the processor");
    await getOrReportToSentry(
      start({
        namespace,
        api: {
          enabled: true,
        },
        scheduler: {
          enabled: false,
        },
        processor: {
          enabled: false,
        },
        httpApi: {
          enabled: true,
          port: Number(environmentVariable("HTTP_API_PORT")) || 3000,
        },
      })({ clock: new SystemClock() })
    );
    return;
  } else if (environmentVariable("NEW_SCHEDULER") === "true") {
    console.log("NEW_SCHEDULER is set");
    await getOrReportToSentry(
      start({
        namespace,
        api: {
          enabled: true,
        },
        scheduler: {
          enabled: true,
        },
        httpApi: {
          enabled: true,
          port: Number(environmentVariable("HTTP_API_PORT")) || 3000,
        },
      })({ clock: new SystemClock() })
    );
    return;
  }
})();
