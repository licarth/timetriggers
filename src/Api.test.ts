import { addMilliseconds, addSeconds } from "date-fns";
import { sequenceS } from "fp-ts/lib/Apply.js";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as T from "fp-ts/lib/Task.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { draw } from "io-ts/lib/Decoder.js";
import _ from "lodash";
import { Api } from "./Api.js";
import { Clock } from "./Clock/Clock.js";
import { SystemClock } from "./Clock/SystemClock.js";
import { TestClock } from "./Clock/TestClock.js";
import { FirestoreApi } from "./Firebase/FirestoreApi.js";
import { initializeApp } from "./Firebase/initializeApp.js";
import { InMemoryApi } from "./InMemory/InMemoryApi.js";
import { JobId } from "./JobId.js";
import { ScheduledAt } from "./ScheduledAt.js";
import { CallbackReceiver } from "./test/CallbackReceiver.js";

jest.setTimeout(200000);

const randomString = (length: number) =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length);

const clocks = {
  SystemClock: new SystemClock(),
  // TestClock: new TestClock(),
};

const NUM_JOBS = 10;

// const firestore = initializeApp().firestore;
const realFirestore = initializeApp({
  appName: "doi_test_real",
  serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
  // serviceAccount: process.env.FIREBASE_SA_DOI_LOADTEST,
}).firestore;
// const loadtestFirestore = initializeApp({
//   appName: "loadtests",
//   serviceAccount: process.env.FIREBASE_SA_DOI_LOADTEST,
// }).firestore;

describe(`Api tests`, () => {
  const testRunId = randomString(4);
  console.log(`testRunId: ${testRunId}`);
  const apiBuilders = {
    InMemory: (clock, namespace) => TE.of(new InMemoryApi({ clock })),
    // FirestoreExternalRealApi: (clock, namespace) =>
    //   FirestoreApi.build({
    //     clock,
    //     rootDocumentPath: namespace,
    //     numProcessors: 10,
    //     runScheduler: true,
    //     firestore: realFirestore,
    //   }),
    FirestoreInternal: (clock, namespace) =>
      FirestoreApi.build({
        clock,
        rootDocumentPath: namespace,
        numProcessors: 3,
        runScheduler: true,
      }),
  } as Record<
    string,
    (clock: Clock, namespace: string) => TE.TaskEither<any, Api>
  >;

  let callbackReceiver: CallbackReceiver;

  for (const [apiName] of Object.entries(apiBuilders)) {
    for (const [clockName, clock] of Object.entries(clocks)) {
      let api: Api;
      // @ts-ignore
      describe(`${apiName} (${clockName} clock)`, () => {
        beforeEach(async () => {
          const namespace = `test-${testRunId}/${apiName}-${clockName}`;
          api = await pipe(
            apiBuilders[apiName](clock, namespace),
            TE.getOrElse((e) => {
              throw new Error(`could not build api ${apiName}: ${e}`);
            })
          )();
          await api.cancelAllJobs()();
          callbackReceiver = await CallbackReceiver.build();
        });

        afterEach(async () => {
          // await api.cancelAllJobs()();
          callbackReceiver && (await callbackReceiver.close());
          api && (await api.close()());
        });

        it.skip("should schedule a job and execute it", async () => {
          const jobDateUtcString = addSeconds(clock.now(), 2).toISOString();

          const callbackId = await pipe(
            api.schedule({
              scheduledAt: ScheduledAt.fromUTCString(jobDateUtcString),
              url: `http://localhost:${callbackReceiver.port}`,
            }),
            TE.getOrElseW(() => T.of(undefined))
          )();

          if (!callbackId) {
            throw new Error("Failed to schedule job");
          }

          const eitherNextPlanned = await api.getNextPlanned(10)();
          if (E.isLeft(eitherNextPlanned)) {
            if (eitherNextPlanned.left) {
              console.log(draw(eitherNextPlanned.left));
            }
          }
          expect(eitherNextPlanned).toMatchObject(
            E.of([
              {
                id: expect.any(String),
                scheduledAt: ScheduledAt.fromUTCString(jobDateUtcString),
              },
            ])
          );

          clock.tickSeconds(20);

          await callbackReceiver.waitForCallback(callbackId);
        });

        it(`should schedule ${NUM_JOBS} jobs and execute them one by one`, async () => {
          const arrayOfTe = _.times(NUM_JOBS, (i) =>
            api.schedule({
              scheduledAt: ScheduledAt.fromUTCString(
                addMilliseconds(clock.now(), 1).toISOString()
              ),
              url: `http://localhost:${callbackReceiver.port}`,
            })
          );
          const callbackIds = await pipe(
            arrayOfTe,
            TE.sequenceArray,
            TE.getOrElseW(() => T.of([] as JobId[]))
          )();

          if (callbackIds.length === 0) {
            throw new Error("Failed to schedule jobs");
          }

          clock.tickSeconds(20);

          for (const callbackId of callbackIds) {
            await callbackReceiver.waitForCallback(callbackId);
          }
          console.log(`All ${NUM_JOBS} callbacks received`);
        });

        it.skip("should run jobs already scheduled before listening with the scheduler", async () => {
          // Only applicable to Api implementations that have a scheduler
        });
      });
    }
  }
});
