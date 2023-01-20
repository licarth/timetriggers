import dotenv from "dotenv";
import { App, cert, initializeApp as firebaseInit } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";

dotenv.config();

let initializationOptions = {};
let firestore: Firestore;
let app: App;

export function initializeApp() {
  if (process.env.PUBLIC_USE_EMULATORS === "true") {
    // console.log("🔸 Using Emulators in the Jobs");
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
  app = firebaseInit(initializationOptions, randomString());
  firestore = getFirestore(app);
  firestore.settings({
    ignoreUndefinedProperties: true,
  });

  return { app, firestore };
}

const randomString = () => {
  return Math.random().toString(36).substring(7);
};
