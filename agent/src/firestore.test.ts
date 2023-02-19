import { FieldValue } from "@google-cloud/firestore";
import { format } from "date-fns";
import _ from "lodash";
import { initializeApp } from "./Firebase/initializeApp";

jest.setTimeout(100000);

const DOCUMENT_KEY = "testcollection/testdoc";

const firestore = initializeApp({
  serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
}).firestore;

describe("Firestore", () => {
  describe("Store a day by minute", () => {
    it.skip("With {'HHmm': <count>}", async () => {
      const hours = _.range(0, 24).flatMap((hour) =>
        _.range(0, 60).flatMap((minute) =>
          format(new Date(2021, 0, 1, hour, minute, 0), "HHmm")
        )
      );

      const randomNumberPerHour = Object.fromEntries(
        _.sortBy(hours).map((hour) => [
          hour,
          _.random(0, Number.MAX_SAFE_INTEGER),
        ]) // max int 2^53
      );

      console.log(randomNumberPerHour["211000"]);

      await firestore.doc(DOCUMENT_KEY).update({
        "010200": FieldValue.increment(1),
      });
      // await firestore.doc(DOCUMENT_KEY).set({
      //   ...randomNumberPerHour,
      // });
    });

    it("With {hour: {minute: <count>} }", async () => {
      // HHmmss

      const data = Object.fromEntries(
        _.range(0, 24).map((hour) => [
          hour,
          Object.fromEntries(
            _.range(0, 60).map((minute) => [minute, _.random(0, 0)])
          ),
        ])
      );

      await firestore.runTransaction(async (t) => {
        const documentRef = firestore.doc(DOCUMENT_KEY);
        const doc = await t.get(documentRef);

        const docData = doc.data();
        if (docData) {
          console.log(docData[0][0]);
          t.update(documentRef, {
            "0.0": FieldValue.increment(1),
          });
        }
      });
    });
  });
});
