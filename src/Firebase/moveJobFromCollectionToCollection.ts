import { JobDefinition } from "@/JobDefinition";

export const moveJobDefinition = ({
  firestore,
  jobDefinition,
  fromCollectionPath,
  toCollectionPath,
}: {
  firestore: FirebaseFirestore.Firestore;
  jobDefinition: JobDefinition;
  fromCollectionPath: string;
  toCollectionPath: string;
}) => {
  return firestore.runTransaction(async (transaction) => {
    transaction.delete(
      firestore.collection(fromCollectionPath).doc(`${jobDefinition.id}`),
      { exists: true }
    );
    transaction.set(
      firestore.collection(toCollectionPath).doc(jobDefinition.id),
      JobDefinition.firestoreCodec.encode(jobDefinition)
    );
  });
};
