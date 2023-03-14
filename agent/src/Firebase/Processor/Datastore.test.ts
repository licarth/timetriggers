import { te } from "@/fp-ts";
import { randomString } from "@/test/randomString";
import { JobDocument, ScheduledAt, TestClock } from "@timetriggers/domain";
import { addHours, addMilliseconds } from "date-fns";
import * as TE from "fp-ts/TaskEither";
import { firstValueFrom, Observable } from "rxjs";
import { emulatorFirestore } from "../emulatorFirestore";
import { Datastore } from "./Datastore";
import { FirestoreDatastore } from "./FirestoreDatastore";

const HOUR_IN_MS = 1000 * 60 * 60;

const datastores: Record<string, (clock: TestClock) => Datastore> = {
  // InMemoryDataStore: (clock: TestClock) =>
  //   InMemoryDataStore.factory({ clock, pollingInterval: POLL_INTERVAL }),
  FirestoreEmulator: (clock: TestClock) =>
    FirestoreDatastore.factory({
      clock,
      namespace: `test-${randomString(10)}`,
      firestore: emulatorFirestore().firestore,
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

  describe("Not Sharded", () => {
    describe("schedule and retrieve with listenToNewJobsBefore()", () => {
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
        it(`should find previously scheduled jobs ${expected} results for a job scheduled in ${scheduledMsFromNow}`, async () => {
          await te.unsafeGetOrThrow(
            datastore.schedule(
              JobDocument.factory({
                scheduledAt: ScheduledAt.fromDate(
                  addMilliseconds(clock.now(), scheduledMsFromNow)
                ),
              })
            )
          );

          await checkThatFirstValue(
            datastore.waitForRegisteredJobsByRegisteredAt({
              maxNoticePeriodMs: HOUR_IN_MS,
            }),
            (jobs) => {
              expect(jobs.length).toBe(1);
            }
          );

          await checkThatFirstValue(
            datastore.waitForRegisteredJobsByRegisteredAt({
              maxNoticePeriodMs: HOUR_IN_MS,
            }),
            (jobs) => {
              expect(jobs.length).toBe(expected);
            }
          );
        });
      }
    });

    describe("listenToNewJobsBefore", () => {
      it("should not return a job that's planned beyond", async () => {
        await te.unsafeGetOrThrow(
          datastore.schedule(
            JobDocument.factory({
              scheduledAt: ScheduledAt.fromDate(addHours(clock.now(), 10)),
            })
          )
        );
        await te.unsafeGetOrThrow(
          datastore.schedule(
            JobDocument.factory({
              scheduledAt: ScheduledAt.fromDate(addHours(clock.now(), 0)),
            })
          )
        );

        await checkThatFirstValue(
          datastore.waitForRegisteredJobsByRegisteredAt({
            maxNoticePeriodMs: HOUR_IN_MS,
          }),
          (jobs) => {
            expect(jobs.length).toBe(1);
          }
        );
      });
    });
  });

  describe("Sharded", () => {
    describe("listenToNewJobsBefore", () => {
      it("should return jobs in shard", async () => {
        await Promise.all([
          te.unsafeGetOrThrow(
            datastore.schedule(JobDocument.factory({ clock, shards: ["2-0"] }))
          ),
          te.unsafeGetOrThrow(
            datastore.schedule(JobDocument.factory({ clock, shards: ["2-1"] }))
          ),
        ]);

        await checkThatFirstValue(
          datastore.waitForRegisteredJobsByRegisteredAt(
            { maxNoticePeriodMs: HOUR_IN_MS },
            { prefix: 2, nodeIds: [1] }
          ),
          (jobs) => {
            expect(jobs.length).toBe(1);
          }
        );
      });

      it("should all jobs if nodeCount is 1", async () => {
        await Promise.all([
          te.unsafeGetOrThrow(
            datastore.schedule(JobDocument.factory({ clock, shards: ["2-0"] }))
          ),
          te.unsafeGetOrThrow(
            datastore.schedule(JobDocument.factory({ clock, shards: ["2-1"] }))
          ),
        ]);

        await checkThatFirstValue(
          datastore.waitForRegisteredJobsByRegisteredAt(
            {
              maxNoticePeriodMs: HOUR_IN_MS,
            },
            { prefix: 1, nodeIds: [] }
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
