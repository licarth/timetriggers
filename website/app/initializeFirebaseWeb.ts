import { getApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

import {
  connectFirestoreEmulator,
  initializeFirestore,
} from "firebase/firestore";

export function initializeFirebaseWeb({
  useEmulators = false,
}: Partial<{
  useEmulators: boolean;
}> = {}) {
  try {
    const existingApp = getApp();
    return {
      auth: getAuth(existingApp),
      app: existingApp,
      firestore: getFirestore(existingApp),
    };
  } catch (e) {
    console.log("🔸 Initializing Firebase App");
  }

  let firebaseConfig = {
    apiKey: "AIzaSyCvEBNCfc7YVbxOoLRb_-Lb96EmCdDqz6o",
    authDomain: "doi-production.firebaseapp.com",
    projectId: "doi-production",
    storageBucket: "doi-production.appspot.com",
    messagingSenderId: "588644874913",
    appId: "1:588644874913:web:94bd2f3df5156716a5cee0",
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const firestore = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
  });

  if (useEmulators) {
    console.log("🔸 Using firebase emulators");
    connectFirestoreEmulator(firestore, "localhost", 8080);
    connectAuthEmulator(auth, "http://localhost:8081", {
      disableWarnings: true,
    });
  }

  return { auth, app, firestore };
}

const randomString = () => {
  return Math.random().toString(36).substring(7);
};
