import { randomString } from "@/test/randomString";
import { te } from "@timetriggers/domain";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import { initializeApp } from "../initializeApp";
import { transaction } from "./transaction";

describe("transaction", () => {
  let firestore: FirebaseFirestore.Firestore;
  beforeAll(async () => {
    firestore = initializeApp({ useEmulators: true }).firestore;
  });

  afterAll(async () => {
    await firestore.terminate();
  });

  it("should handle failure properly", async () => {
    const collectionId = randomString(10);

    const taskEither = transaction(firestore, (t) =>
      pipe(
        TE.Do,
        TE.map(() => {
          t.create(firestore.collection(collectionId).doc(), { test: "test" });
        }),
        TE.chain(() => TE.left("error"))
      )
    );
    // expect it to throw
    await expect(te.unsafeGetOrThrow(taskEither)).rejects.toEqual("error");
    // make sure the transaction was rolled back
    const snapshot = await firestore.collection(collectionId).get();
    expect(snapshot.docs.length).toEqual(0);
  });
  it("should commit the transaction if TE is right", async () => {
    const collectionId = randomString(10);
    const taskEither = transaction(firestore, (t) =>
      pipe(
        TE.Do,
        TE.map(() => {
          t.create(firestore.collection(collectionId).doc(), { test: "test" });
          return "nice";
        })
      )
    );
    // expect it to throw
    expect(await te.unsafeGetOrThrow(taskEither)).toEqual("nice");
    // make sure the transaction was rolled back
    const snapshot = await firestore.collection(collectionId).get();
    expect(snapshot.docs.length).toEqual(1);
  });
});
