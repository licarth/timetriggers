import { Clock } from "@/Clock/Clock";
import { TestClock } from "@/Clock/TestClock";
import { JobDefinition } from "@/domain/JobDefinition";
import { ScheduledAt } from "@/domain/ScheduledAt";
import { Shard } from "@/domain/Shard";
import { te } from "@/fp-ts";
import { addMilliseconds } from "date-fns";
import { firstValueFrom } from "rxjs";
import { Datastore } from "./Datastore";
import { InMemoryDataStore } from "./InMemoryDataStore";

const SECOND = 1000;

const POLL_INTERVAL = 100;

const datastores: Record<string, (clock: Clock) => Datastore> = {
  InMemoryDataStore: (clock: Clock) =>
    InMemoryDataStore.factory({ clock, pollingInterval: POLL_INTERVAL }),
};

describe.each(Object.entries(datastores))("%s", (name, datastoreBuilder) => {
  let clock: TestClock;
  let datastore: Datastore;

  beforeEach(() => {
    clock = new TestClock(new Date("2020-01-01T00:00:00.000Z"));
    datastore = datastoreBuilder(clock);
  });

  afterEach(async () => {
    await te.unsafeGetOrThrow(datastore.close());
  });

  describe("Not Sharded", () => {
    describe("schedule and retrieve with newlyRegisteredJobsBefore()", () => {
      const cases = [
        {
          scheduledMsFromNow: 1000,
          checkMillisecondsFromNow: 2000,
          expected: 1,
        },
        {
          scheduledMsFromNow: 1000,
          checkMillisecondsFromNow: 500,
          expected: 0,
        },
        {
          scheduledMsFromNow: 1000,
          checkMillisecondsFromNow: 1000,
          expected: 1,
        },
        {
          scheduledMsFromNow: 1000,
          checkMillisecondsFromNow: 999,
          expected: 0,
        },
        {
          scheduledMsFromNow: 1000,
          checkMillisecondsFromNow: 1001,
          expected: 1,
        },
      ];
      for (const {
        scheduledMsFromNow,
        checkMillisecondsFromNow,
        expected,
      } of cases) {
        it(`should find ${expected} results for a job scheduled in ${scheduledMsFromNow} ms from (millisecondsFromNow=${checkMillisecondsFromNow})`, async () => {
          await te.unsafeGetOrThrow(
            datastore.schedule(
              JobDefinition.factory({
                scheduledAt: ScheduledAt.fromDate(
                  addMilliseconds(clock.now(), scheduledMsFromNow)
                ),
              })
            )
          );
          await firstValueFrom(
            datastore.newlyRegisteredJobsBefore({
              millisecondsFromNow: checkMillisecondsFromNow,
            })
          ).then((jobs) => {
            expect(jobs.length).toBe(expected);
          });
        });
      }
    });

    describe("newlyRegisteredJobsBefore", () => {
      it("should respond immediately (without clock tick)", async () => {
        await firstValueFrom(
          datastore.newlyRegisteredJobsBefore({
            millisecondsFromNow: 1000,
          })
        ).then((jobs) => {
          expect(jobs.length).toBe(0);
        });
      });

      it("should not return a job that's planned beyond", async () => {
        await te.unsafeGetOrThrow(
          datastore.schedule(
            JobDefinition.factory({
              scheduledAt: ScheduledAt.fromDate(
                addMilliseconds(clock.now(), 1000)
              ),
            })
          )
        );
        await firstValueFrom(
          datastore.newlyRegisteredJobsBefore({
            millisecondsFromNow: 500,
          })
        ).then((jobs) => {
          expect(jobs.length).toBe(0);
        });
      });
    });
  });

  describe("Sharded", () => {
    describe("newlyRegisteredJobsBefore", () => {
      it("should return only jobs in shard", async () => {
        await Promise.all([
          te.unsafeGetOrThrow(
            datastore.schedule(JobDefinition.factory({ clock }), (id) => [
              Shard.of(0, 2),
            ])
          ),
          te.unsafeGetOrThrow(
            datastore.schedule(JobDefinition.factory({ clock }), (id) => [
              Shard.of(1, 2),
            ])
          ),
        ]);

        await firstValueFrom(
          datastore.newlyRegisteredJobsBefore(
            {
              millisecondsFromNow: 1000,
            },
            { nodeCount: 2, nodeIds: [1] }
          )
        ).then((jobs) => {
          expect(jobs.length).toBe(1);
        });
      });

      it("should all jobs if nodeCount is 1", async () => {
        await Promise.all([
          te.unsafeGetOrThrow(
            datastore.schedule(JobDefinition.factory({ clock }), (id) => [
              Shard.of(0, 2),
            ])
          ),
          te.unsafeGetOrThrow(
            datastore.schedule(JobDefinition.factory({ clock }), (id) => [
              Shard.of(1, 2),
            ])
          ),
        ]);

        await firstValueFrom(
          datastore.newlyRegisteredJobsBefore(
            {
              millisecondsFromNow: 1000,
            },
            { nodeCount: 1, nodeIds: [] }
          )
        ).then((jobs) => {
          expect(jobs.length).toBe(2);
        });
      });
    });
  });
});
