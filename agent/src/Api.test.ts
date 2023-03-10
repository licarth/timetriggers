import {
  Clock,
  Http,
  JobId,
  JobScheduleArgs,
  ScheduledAt,
  SystemClock,
  TestClock,
  Url,
} from "@timetriggers/domain";
import { addHours, addMilliseconds } from "date-fns";
import { pipe } from "fp-ts/lib/function.js";
import * as T from "fp-ts/lib/Task.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import { Api } from "./Api.js";
import { DatastoreApi } from "./Firebase/DatastoreApi.js";
import { Datastore } from "./Firebase/Processor/Datastore.js";
import { FirestoreDatastore } from "./Firebase/Processor/FirestoreDatastore";
import { InMemoryDataStore } from "./Firebase/Processor/InMemoryDataStore.js";
import { Processor } from "./Firebase/Processor/Processor.js";
import { Scheduler } from "./Firebase/Processor/Scheduler.js";
import { te } from "./fp-ts/te.js";
import { CallbackReceiver } from "./test/CallbackReceiver.js";

jest.setTimeout(5000);

const randomString = (length: number) =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length);

const clocks = {
  SystemClock: new SystemClock(),
  TestClock: new TestClock(),
};

const NUM_JOBS = 2;

describe(`Api tests`, () => {
  const testRunId = randomString(4);
  console.log(`testRunId: ${testRunId}`);
  const datastoreBuilders = {
    InMemoryDatastore: (clock, namespace) =>
      InMemoryDataStore.factory({ clock }),
    FirestoreEmulator: (clock, namespace) =>
      FirestoreDatastore.factory({
        clock,
        namespace,
      }),
  } as Record<string, (clock: Clock, namespace: string) => Datastore>;

  let callbackReceiver: CallbackReceiver;

  for (const [apiName] of Object.entries(datastoreBuilders)) {
    for (const [clockName, clock] of Object.entries(clocks)) {
      let api: Api;
      let scheduler: Scheduler;
      let processor: Processor;
      // @ts-ignore
      describe(`${apiName} (${clockName} clock)`, () => {
        beforeEach(async () => {
          const namespace = `test-${testRunId}-${apiName}-${clockName}`;
          const datastore = datastoreBuilders[apiName](clock, namespace);
          api = new DatastoreApi({
            clock,
            datastore,
          });

          scheduler = await te.unsafeGetOrThrow(
            Scheduler.build({
              datastore,
              clock,
              schedulePeriodMs: 500,
              noRateLimits: true,
            })
          );
          processor = await te.unsafeGetOrThrow(
            Processor.factory({ datastore, clock })
          );
          callbackReceiver = await CallbackReceiver.factory();
        });

        afterEach(async () => {
          callbackReceiver && (await callbackReceiver.close());
          api && (await te.getOrLog(api.close()));
          scheduler && (await te.getOrLog(scheduler.close()));
          processor && (await te.getOrLog(processor.close()));
        });

        it("should schedule a job and execute it", async () => {
          const jobDateUtcString = addHours(clock.now(), -10).toISOString();
          console.log(`jobDateUtcString: ${jobDateUtcString}`);

          const callbackId = await te.getOrLog(
            api.schedule(
              JobScheduleArgs.factory({
                scheduledAt: ScheduledAt.fromUTCString(jobDateUtcString),
                http: Http.factory({
                  url: Url.localhost(callbackReceiver.port),
                }),
              })
            )
          );

          if (!callbackId) {
            throw new Error("Failed to schedule job");
          }
          clock.tickSeconds(1);
          await callbackReceiver.waitForCallback(callbackId);
        });

        it(`should schedule ${NUM_JOBS} jobs and execute them one by one`, async () => {
          const arrayOfTe = _.times(NUM_JOBS, (i) =>
            api.schedule(
              JobScheduleArgs.factory({
                scheduledAt: ScheduledAt.fromUTCString(
                  addMilliseconds(clock.now(), 1).toISOString()
                ),
                http: Http.factory({
                  url: Url.localhost(callbackReceiver.port),
                }),
              })
            )
          );
          const callbackIds = await pipe(
            arrayOfTe,
            TE.sequenceArray,
            TE.getOrElseW(() => T.of([] as JobId[]))
          )();

          if (callbackIds.length === 0) {
            throw new Error("Failed to schedule jobs");
          }

          clock.tickSeconds(1);

          for (const callbackId of callbackIds) {
            await callbackReceiver.waitForCallback(callbackId);
          }
        });

        it.skip("should run jobs already scheduled before listening with the scheduler", async () => {
          // Only applicable to Api implementations that have a scheduler
        });

        it.skip("should do nothing when there is no job", async () => {});
      });
    }
  }
});

const rootDocumentPathFromNs = (namespace: string) => `tests/${namespace}`;
