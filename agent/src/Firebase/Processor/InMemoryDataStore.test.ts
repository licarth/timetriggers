import { JobDocument, JobScheduleArgs, TestClock } from "@timetriggers/domain";
import { JobDefinition } from "@timetriggers/domain";
import { ScheduledAt } from "@timetriggers/domain";
import { Shard } from "@timetriggers/domain";
import { te } from "@/fp-ts";
import { addMilliseconds } from "date-fns";
import { firstValueFrom } from "rxjs";
import { Datastore } from "./Datastore";
import { InMemoryDataStore } from "./InMemoryDataStore";

describe("InMemoryDataStore", () => {
  describe("schedule", () => {
    it("should schedule a job properly", async () => {
      const clock = new TestClock();
      const pollingInterval = 100;
      const datastore = InMemoryDataStore.factory({
        clock,
        pollingInterval,
      });
      await te.unsafeGetOrThrow(
        datastore.schedule(
          JobScheduleArgs.factory({
            scheduledAt: ScheduledAt.fromDate(
              addMilliseconds(clock.now(), 1000)
            ),
          })
        )
      );
      let docs: JobDocument[] = [];
      (
        await te.unsafeGetOrThrow(
          datastore.waitForRegisteredJobsByRegisteredAt({
            maxNoticePeriodMs: 1000,
          })
        )
      ).subscribe((jobs) => {
        docs = jobs;
      });
      clock.tickMs(pollingInterval);
      expect(docs.length).toBe(1);
    });
  });

  describe("listenToNewJobsBefore", () => {
    it("should not return a job that's planned beyond limits", async () => {
      const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));

      const pollingInterval = 100;

      const datastore = InMemoryDataStore.factory({
        clock,
        pollingInterval,
      });
      await te.unsafeGetOrThrow(
        datastore.schedule(
          JobScheduleArgs.factory({
            scheduledAt: ScheduledAt.fromDate(
              addMilliseconds(clock.now(), 1000)
            ),
          })
        )
      );

      let docs: JobDocument[] = [];
      (
        await te.unsafeGetOrThrow(
          datastore.waitForRegisteredJobsByRegisteredAt({
            maxNoticePeriodMs: 500,
          })
        )
      ).subscribe((jobs) => {
        docs = jobs;
      });
      clock.tickMs(pollingInterval);
      expect(docs.length).toBe(0);
    });
  });
});

describe("Sharded InMemoryDatastore", () => {
  describe("listenToNewJobsBefore", () => {
    it("should return only jobs in shard", async () => {
      const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
      const pollingInterval = 100;
      const datastore = InMemoryDataStore.factory({
        clock,
        pollingInterval,
      });
      await Promise.all([
        te.unsafeGetOrThrow(
          datastore.schedule(JobScheduleArgs.factory({ clock }), (id) => [
            Shard.of(0, 2),
          ])
        ),
        te.unsafeGetOrThrow(
          datastore.schedule(JobScheduleArgs.factory({ clock }), (id) => [
            Shard.of(1, 2),
          ])
        ),
      ]);
      const obs = await te.unsafeGetOrThrow(
        datastore.waitForRegisteredJobsByRegisteredAt(
          {
            maxNoticePeriodMs: 1000,
          },
          { prefix: 2, nodeIds: [1] }
        )
      );
      const jobsPromise = firstValueFrom(obs);
      clock.tickMs(pollingInterval);
      await jobsPromise.then((jobs) => {
        expect(jobs.length).toBe(1);
      });
    });
    it("should all jobs if nodeCount is 1", async () => {
      const clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
      const pollingInterval = 100;
      const datastore = InMemoryDataStore.factory({
        clock,
        pollingInterval,
      });
      await Promise.all([
        te.unsafeGetOrThrow(
          datastore.schedule(JobScheduleArgs.factory({ clock }), () => [
            Shard.of(0, 2),
          ])
        ),
        te.unsafeGetOrThrow(
          datastore.schedule(JobScheduleArgs.factory({ clock }), () => [
            Shard.of(1, 2),
          ])
        ),
      ]);
      const obs = await te.unsafeGetOrThrow(
        datastore.waitForRegisteredJobsByRegisteredAt(
          {
            maxNoticePeriodMs: 1000,
          },
          { prefix: 1, nodeIds: [] }
        )
      );

      const jobsPromise = firstValueFrom(obs);
      clock.tickMs(pollingInterval);
      await jobsPromise.then((jobs) => {
        expect(jobs.length).toBe(2);
      });
    });
  });
});
