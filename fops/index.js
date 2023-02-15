const { initializeApp } = require("firebase-admin/app");
const dotenv = require("dotenv");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

dotenv.config();

const app = initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  ),
});

const f = getFirestore(app);

const args = process.argv.slice(2);

const command = args[0];

(async () => {
  if (command === "move") {
    await f.runTransaction(async (t) => {
      const source = args[1];
      const destination = args[2];
      if (!source || !destination) {
        console.log("Usage: fops move <source> <destination>");
        process.exit(1);
      }
      const sourceRef = f.doc(source);
      const destinationRef = f.doc(destination);
      const sourceDoc = await t.get(sourceRef);
      if (!sourceDoc.exists) {
        console.log(`Document ${source} does not exist`);
        process.exit(1);
      }
      const destinationDoc = await t.get(destinationRef);
      if (destinationDoc.exists) {
        console.log(`Document ${destination} already exists`);
        process.exit(1);
      }
      t.set(destinationRef, sourceDoc.data());
      t.delete(sourceRef);
    });
    process.exit(0);
  } else {
    process.exit(1);
  }
})();
