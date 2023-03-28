import { environmentVariable } from './environmentVariable';
import { initializeApp } from './initializeFirebaseNode.server';

export const buildDeps = () => {
  const { firestore, auth } = initializeApp();
  const deps = {
    firestore,
    namespace: environmentVariable('PUBLIC_NAMESPACE'),
    auth,
  };
  return deps;
};
