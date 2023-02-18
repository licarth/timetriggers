import { TestClock } from "@timetriggers/domain";
import { JobDefinition } from "@timetriggers/domain";
import { ScheduledAt } from "@timetriggers/domain";
import { Shard } from "@timetriggers/domain";
import { te } from "@/fp-ts";
import { randomString } from "@/test/randomString";
import { addMilliseconds } from "date-fns";
import * as TE from "fp-ts/TaskEither";
import { firstValueFrom, Observable } from "rxjs";
import { Datastore } from "./Datastore";
import { FirestoreDatastore } from "./FirestoreDatastore";

const SECOND = 1000;

const POLL_INTERVAL = 100;

const datastores: Record<string, (clock: TestClock) => Datastore> = {
  // InMemoryDataStore: (clock: TestClock) =>
  //   InMemoryDataStore.factory({ clock, pollingInterval: POLL_INTERVAL }),
  FirestoreEmulator: (clock: TestClock) =>
    FirestoreDatastore.factory({
      clock,
      rootDocumentPath: `test-${randomString(10)}/tasks`,
    }),
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

  describe.only("Not Sharded", () => {
    describe.only("schedule and retrieve with listenToNewJobsBefore()", () => {
      const cases = [
        {
          scheduledMsFromNow: 1000,
          expected: 1,
        },
        // {
        //   scheduledMsFromNow: 1000,
        //   expected: 0,
        // },
        // {
        //   scheduledMsFromNow: 1000,
        //   expected: 1, ,
        // },
        // {
        //   scheduledMsFromNow: 1000,
        //   expected: 0,
        // },
        // {
        //   scheduledMsFromNow: 1000,
        //   expected: 1,
        // },
      ];
      for (const { scheduledMsFromNow, expected } of cases) {
        it.skip(`should find previously scheduled jobs ${expected} results for a job scheduled in ${scheduledMsFromNow}`, async () => {
          await te.unsafeGetOrThrow(
            datastore.schedule(
              JobDefinition.factory({
                scheduledAt: ScheduledAt.fromDate(
                  addMilliseconds(clock.now(), scheduledMsFromNow)
                ),
              })
            )
          );

          await checkThatFirstValue(
            datastore.listenToNewlyRegisteredJobs({}),
            (jobs) => {
              expect(jobs.length).toBe(1);
            }
          );

          await checkThatFirstValue(
            datastore.listenToNewlyRegisteredJobs({}),
            (jobs) => {
              expect(jobs.length).toBe(expected);
            }
          );
        });
      }
    });

    describe.skip("listenToNewJobsBefore", () => {
      it("should respond immediately (without clock tick)", async () => {
        await checkThatFirstValue(
          datastore.listenToNewlyRegisteredJobs({}),
          (jobs) => {
            expect(jobs.length).toBe(0);
          }
        );
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

        await checkThatFirstValue(
          datastore.listenToNewlyRegisteredJobs(),
          (jobs) => {
            expect(jobs.length).toBe(0);
          }
        );
      });
    });
  });

  describe.skip("Sharded", () => {
    describe("listenToNewJobsBefore", () => {
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

        await checkThatFirstValue(
          datastore.listenToNewlyRegisteredJobs(
            {},
            { nodeCount: 2, nodeIds: [1] }
          ),
          (jobs) => {
            expect(jobs.length).toBe(1);
          }
        );
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

        await checkThatFirstValue(
          datastore.listenToNewlyRegisteredJobs(
            {},
            { nodeCount: 1, nodeIds: [] }
          ),
          (jobs) => {
            expect(jobs.length).toBe(2);
          }
        );
      });
    });
  });
});

const checkThatFirstValue = async <E, T>(
  t: TE.TaskEither<E, Observable<T>>,
  expectation: (jobs: T) => void
) => {
  await firstValueFrom(await te.unsafeGetOrThrow(t)).then((jobs) => {
    expectation(jobs);
  });
};
