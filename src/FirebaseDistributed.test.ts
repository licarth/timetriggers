import { addSeconds } from "date-fns";
import { pipe } from "fp-ts/lib/function.js";
import * as T from "fp-ts/lib/Task.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import _ from "lodash";
import { Api } from "./Api.js";
import { AxiosWorkerPool } from "./AxiosWorkerPool.js";
import { Clock } from "./Clock/Clock.js";
import { SystemClock } from "./Clock/SystemClock.js";
import { getShardsToListenTo } from "./ConsistentHashing/ConsistentHashing.js";
import { ZookeeperCoordinationClient } from "./Coordination/ZookeeperCoordinationClient.js";
import { JobId } from "./domain/JobId.js";
import { ScheduledAt } from "./domain/ScheduledAt.js";
import { FirestoreApi } from "./Firebase/FirestoreApi.js";
import { FirestoreProcessor } from "./Firebase/FirestoreProcessor.js";
import { initializeApp } from "./Firebase/initializeApp.js";
import { te } from "./fp-ts/te.js";
import { CallbackReceiver } from "./test/CallbackReceiver.js";

jest.setTimeout(20 * 1000);

const randomString = (length: number) =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length);

const NUM_JOBS = 30;

const realFirestore = initializeApp({
  appName: "doi_test_real",
  serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
}).firestore;

describe(`Firebase Distributed`, () => {
  const testRunId = randomString(4);
  console.log(`testRunId: ${testRunId}`);
  let callbackReceiver: CallbackReceiver;

  beforeEach(async () => {
    callbackReceiver = await CallbackReceiver.build();
  });

  afterEach(async () => {
    callbackReceiver && (await callbackReceiver.close());
  });

  it(`should schedule ${NUM_JOBS} jobs and execute them one by one`, async () => {
    const rootDocumentPath = `test/${testRunId}`;
    const api = await te.unsafeGetOrThrow(
      FirestoreApi.build({
        rootDocumentPath,
        numProcessors: 0,
        runScheduler: true,
      })
    );

    launchProcessor(api, rootDocumentPath, "/" + testRunId);
    launchProcessor(api, rootDocumentPath, "/" + testRunId);
    launchProcessor(api, rootDocumentPath, "/" + testRunId);
    launchProcessor(api, rootDocumentPath, "/" + testRunId);
    launchProcessor(api, rootDocumentPath, "/" + testRunId);
    launchProcessor(api, rootDocumentPath, "/" + testRunId);
    launchProcessor(api, rootDocumentPath, "/" + testRunId);
    await launchProcessor(api, rootDocumentPath, "/" + testRunId);

    await sleep(2000);
    console.log(`scheduling ${NUM_JOBS} jobs...`);
    const now = new Date();
    await createJobs({
      api,
      clock: new SystemClock(),
      numJobs: 1,
      callbackReceiverPort: callbackReceiver.port,
    });
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
    api.schedule({
      scheduledAt: ScheduledAt.fromUTCString(
        addSeconds(clock.now(), 5).toISOString()
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

async function launchProcessor(
  api: FirestoreApi,
  rootDocumentPath: string,
  namespace: string
) {
  console.log(`server launching`);
  const server1 = await te.unsafeGetOrThrow(
    ZookeeperCoordinationClient.build({ namespace })
  );
  console.log(`server launched: ${server1}`);

  let currentProcessor: FirestoreProcessor | undefined;
  server1.getClusterNodeInformation().subscribe((newInfo) => {
    console.log(
      `restarting processor because of new cluster info: ${
        newInfo.currentNodeId + 1
      }/${newInfo.clusterSize}`
    );
    currentProcessor && currentProcessor.close();
    currentProcessor = new FirestoreProcessor({
      firestore: api.firestore,
      rootDocumentPath,
      workerPool: new AxiosWorkerPool({
        minSize: 1,
        maxSize: 1,
      }),
      shardsToListenTo: getShardsToListenTo(
        newInfo.currentNodeId,
        newInfo.clusterSize
      ),
    });
    te.unsafeGetOrThrow(currentProcessor.run());
  });
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
