import { FirebaseError } from "firebase-admin";

export const isFirebaseError = (e: unknown): e is FirebaseError => {
  return (e as FirebaseError)?.code !== undefined;
};
