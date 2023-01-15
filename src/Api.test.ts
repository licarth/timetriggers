import { addSeconds } from "date-fns";
import { sequenceS } from "fp-ts/lib/Apply.js";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as T from "fp-ts/lib/Task.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { draw } from "io-ts/lib/Decoder.js";
import _ from "lodash";
import { Api } from "./Api.js";
import { TestClock } from "./Clock/TestClock.js";
import { FirestoreApi } from "./Firebase/FirestoreApi.js";
import { InMemoryApi } from "./InMemory/InMemoryApi.js";
import { ScheduledAt } from "./ScheduledAt.js";
import { CallbackReceiver } from "./test/CallbackReceiver.js";
import { DecodeError } from "io-ts/lib/Decoder.js";

describe("Api", () => {
  beforeAll(async () => {});
  const clock = new TestClock();

  const apiBuilders = {
    InMemory: () => TE.of(new InMemoryApi(clock)),
    Firestore: () => FirestoreApi.build({ clock }),
  } as Record<string, () => TE.TaskEither<any, Api>>;

  let apis = {} as Record<string, Api>;
  let callbackReceiver: CallbackReceiver;

  beforeAll(async () => {
    apis = await pipe(
      _.mapValues(apiBuilders, (apiBuilder) => apiBuilder()),
      sequenceS(TE.taskEither),
      TE.getOrElseW(() => {
        fail("could not build apis");
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
        await api.cancelAllJobs()();
        callbackReceiver.close();
      });

      it("should schedule a job", async () => {
        // const jobDateUtcString = "2023-02-01T00:00:00.000Z";
        const jobDateUtcString = addSeconds(clock.now(), 3).toISOString();

        const callbackId = await pipe(
          api.schedule({
            scheduledAt: ScheduledAt.fromUTCString(jobDateUtcString),
          }),
          TE.getOrElseW(() => T.of(undefined))
        )();

        if (!callbackId) {
          throw new Error("Failed to schedule job");
        }

        console.log(ScheduledAt.fromUTCString(jobDateUtcString));

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

        clock.tickSeconds(3);

        await callbackReceiver.waitForCallback(callbackId);
      });
    });
  }
});
