import {
  cert,
  initializeApp as firebaseInit,
  getApps,
  getApp,
  App,
} from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";

dotenv.config();

let initializationOptions = {};
let firestore: Firestore;
let app: App;

export function initializeApp() {
  if (getApps().length === 0) {
    if (process.env.PUBLIC_USE_EMULATORS === "true") {
      console.log("🔸 Using Emulators in the Jobs");
      process.env["FIRESTORE_EMULATOR_HOST"] = "localhost:8080";
      initializationOptions = {
        ...initializationOptions,
        projectId: "flightplot-web",
      };
    } else {
      initializationOptions = {
        ...initializationOptions,
        credential: cert(
          JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "")
        ),
      };
    }
    app = firebaseInit(initializationOptions);
    firestore = getFirestore(app);
    firestore.settings({
      ignoreUndefinedProperties: true,
    });
  } else {
    app = getApp();
    firestore = getFirestore(app);
  }

  return { app, firestore };
}
