import {
  Clock,
  Http,
  JobId,
  JobScheduleArgs,
  ScheduledAt,
  SystemClock,
  te,
  Url,
} from "@timetriggers/domain";
import { addSeconds } from "date-fns";
import { pipe } from "fp-ts/lib/function.js";
import * as T from "fp-ts/lib/Task.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import { Api } from "./Api.js";
import { DatastoreApi } from "./Firebase/DatastoreApi.js";
import { FirestoreDatastore } from "./Firebase/Processor/FirestoreDatastore";
import { Processor } from "./Firebase/Processor/Processor.js";
import { Scheduler } from "./Firebase/Processor/Scheduler.js";
import { CallbackReceiver } from "./test/CallbackReceiver.js";

jest.setTimeout(20 * 1000);

const randomString = (length: number) =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length);

const NUM_JOBS = 10;

describe(`Firebase Distributed`, () => {
  const testRunId = randomString(4);
  console.log(`testRunId: ${testRunId}`);
  let callbackReceiver: CallbackReceiver;

  beforeEach(async () => {
    callbackReceiver = await CallbackReceiver.factory();
  });

  afterEach(async () => {
    callbackReceiver && (await callbackReceiver.close());
  });

  it(`should schedule ${NUM_JOBS} jobs and execute them one by one`, async () => {
    const namespace = `test-${testRunId}`;
    const clock = new SystemClock();
    const datastore = FirestoreDatastore.factory({ clock, namespace });
    const api = new DatastoreApi({
      clock,
      datastore,
    });

    await te.unsafeGetOrThrow(
      Scheduler.build({
        datastore,
        clock,
        schedulePeriodMs: 500,
        noRateLimits: true,
      })
    );
    await te.unsafeGetOrThrow(Processor.factory({ datastore, clock }));

    console.log(`scheduling ${NUM_JOBS} jobs...`);
    const now = new Date();
    await createJobs({
      api,
      clock,
      numJobs: 1,
      callbackReceiverPort: callbackReceiver.port,
    });
    const callbackIds = await createJobs({
      api,
      clock,
      numJobs: NUM_JOBS,
      callbackReceiverPort: callbackReceiver.port,
    });
    console.log(
      `All ${NUM_JOBS} jobs scheduled in ${
        new Date().getTime() - now.getTime()
      }ms`
    );

    await callbackReceiver.waitForAllCallbacks([...callbackIds]);
    console.log(`All ${NUM_JOBS} callbacks received`);
  });
});

const createJobs = async ({
  api,
  clock,
  numJobs,
  callbackReceiverPort,
}: {
  api: Api;
  clock: Clock;
  numJobs: number;
  callbackReceiverPort: number;
}) => {
  const arrayOfTe = _.times(numJobs, (i) =>
    api.schedule(
      JobScheduleArgs.factory({
        scheduledAt: ScheduledAt.fromUTCString(
          addSeconds(clock.now(), 0).toISOString()
        ),
        http: Http.factory({
          url: Url.localhost(callbackReceiverPort),
        }),
      })
    )
  );
  const callbackIds = await pipe(
    arrayOfTe,
    TE.sequenceArray,
    TE.getOrElseW(() => T.of([] as JobId[]))
  )();

  return callbackIds;
};
