import { initializeApp } from "../Firebase/initializeApp";

const { firestore } = initializeApp({
  serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
});

(async () => {
  // list projects
  await firestore.runTransaction(async (t) => {
    const projectDocs = await firestore
      .collection(`/namespaces/${process.env.NAMESPACE}/projects`)
      .get();
    projectDocs.forEach(async (projectDoc) => {
      const { id: projectId } = projectDoc;
      const usageDoc = firestore.doc(
        `/namespaces/${process.env.NAMESPACE}/projects/${projectId}/usage/monthly`
      );
      await firestore.recursiveDelete(
        firestore.doc(
          `/namespaces/${process.env.NAMESPACE}/projects/${projectId}/usage`
        )
      );
      t.set(usageDoc, {
        projectId,
      });
    });
  });

  console.log("✅ done");
})();
