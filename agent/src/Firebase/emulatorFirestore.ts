import dotenv from "dotenv";
import { initializeApp as firebaseInit } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

export function emulatorFirestore({
  appName,
}: Partial<{
  appName: string;
}> = {}) {
  console.log("🔸 Using Emulators in the Agent");
  process.env["FIRESTORE_EMULATOR_HOST"] = "localhost:8080";
  const initializationOptions = {
    projectId: "doi-production",
  };
  const app = firebaseInit(initializationOptions, appName || randomString());
  const firestore = getFirestore(app);

  firestore.settings({
    ignoreUndefinedProperties: true,
  });

  delete process.env["FIRESTORE_EMULATOR_HOST"];
  return { app, firestore };
}

const randomString = () => {
  return Math.random().toString(36).substring(7);
};
