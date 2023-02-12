import dotenv from "dotenv";
import type { App } from "firebase-admin/app";
import {
  cert,
  getApp,
  getApps,
  initializeApp as firebaseInit,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

export function initializeApp({
  serviceAccount,
  useEmulators = false,
}: Partial<{
  serviceAccount: string;
  useEmulators?: boolean;
}> = {}) {
  let initializationOptions = {};
  let app: App;
  let firstInitialization = true;

  if (getApps().length !== 0) {
    app = getApp();
    firstInitialization = false;
  } else {
    if (useEmulators) {
      console.log("🔸 Using Emulators in the Jobs");
      process.env["FIRESTORE_EMULATOR_HOST"] = "localhost:8080";
      process.env["FIREBASE_AUTH_EMULATOR_HOST"] = "localhost:8081";
      initializationOptions = {
        ...initializationOptions,
        projectId: "doi-production",
      };
    } else {
      delete process.env["FIRESTORE_EMULATOR_HOST"];
      delete process.env["FIREBASE_AUTH_EMULATOR_HOST"];
      initializationOptions = {
        ...initializationOptions,
        credential: cert(
          JSON.parse(
            serviceAccount || process.env.FIREBASE_SERVICE_ACCOUNT_KEY || ""
          )
        ),
      };
    }
    app = firebaseInit(initializationOptions);
  }

  const firestore = getFirestore(app);
  const auth = getAuth(app);

  if (firstInitialization) {
    firestore.settings({
      ignoreUndefinedProperties: true,
    });
  }

  return { app, firestore, auth };
}
