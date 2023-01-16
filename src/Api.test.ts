import { addMilliseconds, addSeconds } from "date-fns";
import { sequenceS } from "fp-ts/lib/Apply.js";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as T from "fp-ts/lib/Task.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { draw } from "io-ts/lib/Decoder.js";
import _ from "lodash";
import { Api } from "./Api.js";
import { SystemClock } from "./Clock/SystemClock.js";
import { TestClock } from "./Clock/TestClock.js";
import { FirestoreApi } from "./Firebase/FirestoreApi.js";
import { InMemoryApi } from "./InMemory/InMemoryApi.js";
import { JobId } from "./JobId.js";
import { ScheduledAt } from "./ScheduledAt.js";
import { CallbackReceiver } from "./test/CallbackReceiver.js";

jest.setTimeout(10000);

describe("Api", () => {
  const clock = new SystemClock();

  const apiBuilders = {
    InMemory: () => TE.of(new InMemoryApi(clock)),
    Firestore: () =>
      FirestoreApi.build({
        clock,
        rootDocumentPath: "example-collection/job-queue-b",
        numProcessors: 3,
      }),
  } as Record<string, () => TE.TaskEither<any, Api>>;

  let apis = {} as Record<string, Api>;
  let callbackReceiver: CallbackReceiver;

  beforeAll(async () => {
    apis = await pipe(
      _.mapValues(apiBuilders, (apiBuilder) => apiBuilder()),
      sequenceS(TE.taskEither),
      TE.getOrElseW((e) => {
        throw new Error("could not build apis");
        return T.of({} as Record<string, Api>);
      })
    )();
  });

  for (const [apiName] of Object.entries(apiBuilders)) {
    let api: Api;
    // @ts-ignore
    describe(`${apiName}`, () => {
      beforeAll(async () => {
        api = apis[apiName];
        await api.cancelAllJobs()();
        callbackReceiver = await CallbackReceiver.build();
      });

      afterAll(async () => {
        // await api.cancelAllJobs()();
        await callbackReceiver.close();
        await api.close()();
      });

      it("should schedule a job and execute it", async () => {
        // const jobDateUtcString = "2023-02-01T00:00:00.000Z";
        const jobDateUtcString = addSeconds(clock.now(), 2).toISOString();

        const callbackId = await pipe(
          api.schedule({
            scheduledAt: ScheduledAt.fromUTCString(jobDateUtcString),
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

        // clock.tickSeconds(3);

        await callbackReceiver.waitForCallback(callbackId);
      });

      it("should schedule 10 jobs and execute them one by one", async () => {
        const arrayOfTe = _.times(10, (i) =>
          api.schedule({
            scheduledAt: ScheduledAt.fromUTCString(
              addMilliseconds(clock.now(), i * 300).toISOString()
            ),
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

        // clock.tickSeconds(3);

        for (const callbackId of callbackIds) {
          await callbackReceiver.waitForCallback(callbackId);
        }
        // expect(callbackReceiver.getCallbackIdsReceived()).toHaveLength(10);
      });
    });
  }
});
