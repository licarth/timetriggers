import { addMinutes, addSeconds } from "date-fns";
import { pipe } from "fp-ts/lib/function.js";
import * as T from "fp-ts/lib/Task.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import { Api } from "./Api.js";
import { Clock } from "./Clock/Clock.js";
import { SystemClock } from "./Clock/SystemClock.js";
import { JobId } from "./domain/JobId.js";
import { ScheduledAt } from "./domain/ScheduledAt.js";
import { FirestoreApi } from "./Firebase/FirestoreApi.js";
import { initializeApp } from "./Firebase/initializeApp.js";
import { te } from "./fp-ts/te.js";
import { CallbackReceiver } from "./test/CallbackReceiver.js";

jest.setTimeout(20 * 1000);

const randomString = (length: number) =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length);

const NUM_JOBS = 100;

const firestore = initializeApp({
  // serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
  serviceAccount: process.env.FIREBASE_SA_DOI_PRODUCTION,
}).firestore;

describe.skip(`Firebase Seed jobs`, () => {
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
    const api = await te.unsafeGetOrThrow(
      FirestoreApi.build({
        rootDocumentPath: `/doi-production/tasks`,
        numProcessors: 0,
        runScheduler: false,
        firestore,
      })
    );

    console.log(`scheduling ${NUM_JOBS} jobs...`);
    const now = new Date();
    const callbackIds = await createJobs({
      api,
      clock: new SystemClock(),
      numJobs: NUM_JOBS,
      callbackReceiverPort: callbackReceiver.port,
    });
    console.log(
      `All ${NUM_JOBS} jobs scheduled in ${
        new Date().getTime() - now.getTime()
      }ms`
    );

    // await callbackReceiver.waitForAllCallbacks([...callbackIds]);
    // console.log(`All ${NUM_JOBS} callbacks received`);
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
    api.schedule({
      scheduledAt: ScheduledAt.fromUTCString(
        addSeconds(clock.now(), 10).toISOString()
      ),
      url: `http://localhost:${callbackReceiverPort}`,
    })
  );
  const callbackIds = await pipe(
    arrayOfTe,
    TE.sequenceArray,
    TE.getOrElseW(() => T.of([] as JobId[]))
  )();

  return callbackIds;
};
