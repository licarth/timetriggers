import { AxiosWorkerPool } from "@/AxiosWorkerPool";
import { TestClock } from "@/Clock/TestClock";
import { JobDefinition } from "@/domain/JobDefinition";
import { JobId } from "@/domain/JobId";
import { externallyResolvablePromise } from "@/externallyResolvablePromise";
import { te } from "@/fp-ts";
import {
  HttpCallCompleted,
  HttpCallResponse,
  StatusCode,
} from "@/HttpCallStatusUpdate";
import { sleep } from "@/sleep";
import { CallbackReceiver } from "@/test/CallbackReceiver";
import { Worker } from "@/Worker";
import { WorkerPool } from "@/WorkerPool";
import * as TE from "fp-ts/lib/TaskEither.js";
import { of } from "rxjs";
import { InMemoryDataStore } from "./InMemoryDataStore";
import { Processor } from "./Processor";

jest.setTimeout(10000);

const worker: Worker = {
  close: () => Promise.resolve(),
  execute: () =>
    of(
      new HttpCallCompleted({
        startedAt: new Date(),
        completedAt: new Date(),
        response: new HttpCallResponse({
          statusCode: StatusCode.fromInt(200),
          statusText: "OK",
        }),
      })
    ),
};

const fakeWorkerPool: WorkerPool = {
  nextWorker: () => TE.of(worker),
  close: () => TE.of(undefined),
};

describe("Processor (not sharded)", () => {
  it("should process single job in queue", async () => {
    const callbackReceiver = await CallbackReceiver.factory();

    const clock = new TestClock();
    const jobId = JobId.factory();
    const processor = Processor.factory({
      datastore: InMemoryDataStore.factory({
        clock,
        queuedJobs: [
          JobDefinition.factory({
            id: jobId,
            url: `http://localhost:${callbackReceiver.port}`,
            clock,
          }),
        ],
      }),
    });
    te.unsafeGetOrThrow(processor.run());
    await callbackReceiver.waitForCallback(jobId);
    await te.unsafeGetOrThrow(processor.close());
  });

  it("should wait for job to be processed before closing", async () => {
    let { promise: callbackReceiverPromise, resolve: jobDoneResolve } =
      externallyResolvablePromise<() => void>();
    let { promise: jobStartedPromise, resolve: jobStartedResolve } =
      externallyResolvablePromise<void>();

    const callbackReceiver = await CallbackReceiver.factory({
      postHandler: (markAsReceived) => async (req, res) => {
        jobStartedResolve();
        await new Promise<void>((resolve) => {
          jobDoneResolve(() => {
            resolve();
          });
        });
        markAsReceived(req.body.callbackId);
        res.sendStatus(200);
      },
    });

    const clock = new TestClock();
    const processor = new Processor({
      workerPool: new AxiosWorkerPool({ clock, minSize: 1, maxSize: 1 }),
      datastore: InMemoryDataStore.factory({
        clock,
        queuedJobs: [
          JobDefinition.factory({
            url: `http://localhost:${callbackReceiver.port}`,
            clock,
          }),
        ],
      }),
    });
    await te.unsafeGetOrThrow(processor.run());
    let closed = false;

    // Wait for job processing to start
    await jobStartedPromise;

    const closingPromise = te.unsafeGetOrThrow(processor.close()).then(() => {
      closed = true;
    });
    // Check that the processor is not closed yet
    await sleep(1000);
    expect(closed).toBe(false);
    const unlockCallbackReceiver = await callbackReceiverPromise;
    unlockCallbackReceiver();
    await closingPromise;
    expect(closed).toBe(true);
    await callbackReceiver.close();
    // Check that the processor is closed now
  });
});

describe("Processor sharded", () => {
  it("should process job in its shard", () => {});
});
