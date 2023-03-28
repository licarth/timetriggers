import { getApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

import {
  connectFirestoreEmulator,
  initializeFirestore,
} from 'firebase/firestore';
import { environmentVariable } from './environmentVariable';

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
    console.log('🔸 Initializing Firebase App for the first time');
  }

  let firebaseConfig = {
    apiKey: 'AIzaSyCvEBNCfc7YVbxOoLRb_-Lb96EmCdDqz6o',
    authDomain: 'doi-production.firebaseapp.com',
    projectId: 'doi-production',
    storageBucket: 'doi-production.appspot.com',
    messagingSenderId: '588644874913',
    appId: '1:588644874913:web:94bd2f3df5156716a5cee0',
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const firestore = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
  });

  if (
    useEmulators ||
    environmentVariable('PUBLIC_USE_EMULATORS') === 'true'
  ) {
    console.log('🔸 Using Emulators in the Website (React)');
    connectFirestoreEmulator(firestore, '0.0.0.0', 8080);
    connectAuthEmulator(auth, 'http://0.0.0.0:8081', {
      disableWarnings: true,
    });
  }

  return { auth, app, firestore };
}
