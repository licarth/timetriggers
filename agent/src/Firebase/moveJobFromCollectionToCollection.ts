import { JobDocument } from "@timetriggers/domain";
import { JobDefinition } from "@timetriggers/domain";

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
      JobDefinition.codec("firestore").encode(jobDefinition)
    );
  });
};

export const moveJobDocument = ({
  firestore,
  jobDocument,
  fromCollectionPath,
  toCollectionPath,
}: {
  firestore: FirebaseFirestore.Firestore;
  jobDocument: JobDocument;
  fromCollectionPath: string;
  toCollectionPath: string;
}) => {
  return firestore.runTransaction(async (transaction) => {
    transaction.delete(
      firestore
        .collection(fromCollectionPath)
        .doc(`${jobDocument.jobDefinition.id}`),
      { exists: true }
    );
    transaction.set(
      firestore.collection(toCollectionPath).doc(jobDocument.jobDefinition.id),
      JobDocument.codec("firestore").encode(jobDocument)
    );
  });
};
