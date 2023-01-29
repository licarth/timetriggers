import { TestClock } from "@/Clock/TestClock";
import { JobDefinition } from "@/domain/JobDefinition";
import { ScheduledAt } from "@/domain/ScheduledAt";
import { te } from "@/fp-ts";
import { addMilliseconds } from "date-fns";
import { InMemoryDataStore } from "./InMemoryDataStore";

describe("InMemoryDataStore", () => {
  describe("schedule", () => {
    it("should schedule a job properly", async () => {
      const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));

      const pollingInterval = 100;

      const datastore = InMemoryDataStore.factory({
        clock,
        pollingInterval,
      });
      await te.unsafeGetOrThrow(
        datastore.schedule(
          JobDefinition.factory({
            scheduledAt: ScheduledAt.fromDate(
              addMilliseconds(clock.now(), 1000)
            ),
          })
        )
      );

      let jobDefs: JobDefinition[] = [];
      datastore
        .newlyRegisteredJobsBefore({ millisecondsFromNow: 1000 })
        .subscribe((jobs) => {
          jobDefs = jobs;
        });
      clock.tickMs(pollingInterval);
      expect(jobDefs.length).toBe(1);
    });
  });

  describe("newlyRegisteredJobsBefore", () => {
    it("should not return a job that's planned beyond", async () => {
      const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));

      const pollingInterval = 100;

      const datastore = InMemoryDataStore.factory({
        clock,
        pollingInterval,
      });
      await te.unsafeGetOrThrow(
        datastore.schedule(
          JobDefinition.factory({
            scheduledAt: ScheduledAt.fromDate(
              addMilliseconds(clock.now(), 1000)
            ),
          })
        )
      );

      let jobDefs: JobDefinition[] = [];
      datastore
        .newlyRegisteredJobsBefore({ millisecondsFromNow: 500 })
        .subscribe((jobs) => {
          jobDefs = jobs;
        });
      clock.tickMs(pollingInterval);
      expect(jobDefs.length).toBe(0);
    });
  });
});
