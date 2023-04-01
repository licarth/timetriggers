import { until } from "@/test/until";
import {
  JobDefinition,
  JobDocument,
  ScheduledAt,
  te,
  TestClock,
} from "@timetriggers/domain";
import { addHours, addMilliseconds, addSeconds } from "date-fns";
import _ from "lodash";
import { InMemoryDataStore } from "./InMemoryDataStore";
import { Scheduler } from "./Scheduler";

const MINUTE = 1000 * 60;

describe.skip("Scheduler", () => {
  describe("startup", () => {
    let scheduler: Scheduler;
    afterEach(async () => {
      scheduler && (await te.unsafeGetOrThrow(scheduler.close()));
    });

    it("should schedule all jobs in the past", async () => {
      const clock = TestClock.factory();
      const datastore = InMemoryDataStore.factory({
        clock,
        registeredJobs: _.times(200, () =>
          JobDocument.registeredNowWithoutShards({
            jobDefinition: JobDefinition.factory({
              clock,
              scheduledAt: ScheduledAt.factory(addHours(clock.now(), -1)),
            }),
            clock,
          })
        ),
      });
      scheduler = await te.unsafeGetOrThrow(
        Scheduler.build({
          clock,
          datastore,
          scheduleAdvanceMs: 1000,
          scheduleBatch: 50,
          schedulePeriodMs: 100,
        })
      );

      await until(function () {
        console.log(datastore.queuedJobs.size);
        return datastore.queuedJobs.size === 200;
      }, 5000);
    });

    it("should schedule but not queue visible job in the future", async () => {
      const clock = TestClock.factory();
      const datastore = InMemoryDataStore.factory({
        clock,
        registeredJobs: _.times(1, () =>
          JobDocument.registeredNowWithoutShards({
            jobDefinition: JobDefinition.factory({
              clock,
              scheduledAt: ScheduledAt.factory(
                addMilliseconds(clock.now(), 500)
              ),
            }),
            clock,
          })
        ),
      });
      scheduler = await te.unsafeGetOrThrow(
        Scheduler.build({
          clock,
          datastore,
          scheduleAdvanceMs: 1000,
          scheduleBatch: 50,
          schedulePeriodMs: 100,
        })
      );

      await until(() => scheduler.plannedTimeouts.size === 1, 5000);

      expect(scheduler.plannedTimeouts.size).toBe(1);
      expect(datastore.queuedJobs.size).toBe(0);
    });

    it("should repeateadly schedule jobs to catch later jobs", async () => {
      const clock = TestClock.factory();
      const datastore = InMemoryDataStore.factory({
        clock,
        registeredJobs: _.times(1, () =>
          JobDocument.registeredNowWithoutShards({
            jobDefinition: JobDefinition.factory({
              scheduledAt: ScheduledAt.factory(addSeconds(clock.now(), 130)),
            }),
            clock,
          })
        ),
      });
      scheduler = await te.unsafeGetOrThrow(
        Scheduler.build({
          clock,
          datastore,
          scheduleAdvanceMs: 2 * MINUTE, // 2 minutes
          scheduleBatch: 50,
          schedulePeriodMs: 1 * MINUTE, // 1 minute
        })
      );

      expect(datastore.queuedJobs.size).toBe(0);
      clock.tickMinutes(1);
      // There is an async call so we must wait for it to complete
      expect(datastore.queuedJobs.size).toBe(0);
      clock.tickMinutes(2);
      await until(() => datastore.queuedJobs.size === 1, 5000);
    });
  });
});
