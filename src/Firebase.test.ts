import { deleteApp } from "firebase-admin/app";
import { FirestoreApi } from "./Firebase/FirestoreApi";
import { initializeApp } from "./Firebase/initializeApp";
import { te } from "./fp-ts";

describe(`Firebase`, () => {
  it("should start and stop cleanly with emulator", async () => {
    const app = initializeApp();
    await app.firestore.listCollections();
    await app.firestore.terminate();
  });

  it("should start and stop cleanly with real firestore", async () => {
    const app = initializeApp({
      appName: "doi_test_real",
      serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    });
    await app.firestore.listCollections();
    await app.firestore.terminate();
    await deleteApp(app.app);
  });

  it("should start and stop cleanly with emulator", async () => {
    const api = await te.unsafeGetOrThrow(
      FirestoreApi.build({
        rootDocumentPath: "test",
        numProcessors: 0,
        runScheduler: false,
      })
    );
    console.log("scheduler", api.scheduler);
    console.log("processors", api.processors);
    await te.unsafeGetOrThrow(api.close());
  });

  it("should start and stop cleanly with real firestore", async () => {
    const realFirestore = initializeApp({
      appName: "doi_test_real",
      serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    }).firestore;

    const api = await te.unsafeGetOrThrow(
      FirestoreApi.build({
        rootDocumentPath: "test",
        numProcessors: 0,
        runScheduler: false,
        firestore: realFirestore,
      })
    );
    console.log("scheduler", api.scheduler);
    console.log("processors", api.processors);
    await te.unsafeGetOrThrow(api.close());
  });
});
