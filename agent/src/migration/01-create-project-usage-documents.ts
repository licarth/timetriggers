import { MonthlyUsage, ProjectId } from "@timetriggers/domain";
import { MonthlyUsageV1 } from "@timetriggers/domain/built/cjs/MonthlyUsage/MonthlyUsageV1";
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
        `/namespaces/${process.env.NAMESPACE}/projects/${projectId}/usage/all-forever:month`
      );
      // await firestore.recursiveDelete(
      //   firestore.doc(
      //     `/namespaces/${process.env.NAMESPACE}/projects/${projectId}/usage`
      //   )
      // );
      t.set(
        usageDoc,
        MonthlyUsage.codec.encode(
          new MonthlyUsageV1({
            projectId: projectId as ProjectId,
          })
        ),
        { merge: true }
      );
    });
  });

  console.log("✅ done");
})();
