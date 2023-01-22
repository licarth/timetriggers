import _ from "lodash";
import {
  consistentHashing,
  consistentHashingFirebaseArray,
} from "./ConsistentHashing";

const randomString = () => {
  return Math.random().toString(36).substring(7);
};

describe("Firebase Consistent Hashing", () => {
  it("should return an empty array when only one server", async () => {
    const res = consistentHashingFirebaseArray("anyRessource", 0);
    expect(res).toEqual([]);
  });

  it("should be fixed", async () => {
    const res = consistentHashingFirebaseArray("anyRessource", 10);
    expect(res).toEqual([
      "1-5",
      "2-5",
      "3-28",
      "4-35",
      "5-35",
      "6-35",
      "7-60",
      "8-60",
      "9-60",
      "10-60",
    ]);
  });

  it("should be deterministic", async () => {
    const s = randomString();
    // console.log(_.times(10, (i) => consistentHashing(`string-${i}`, 10)));
    expect(consistentHashingFirebaseArray(s, 10)).toEqual(
      consistentHashingFirebaseArray(s, 10)
    );
  });

  it.skip("should distribute evenly accross 10 servers", async () => {
    const randomStrings = _.times(100, () => randomString());
    const maxNumberOfServers = 10;
    const res = randomStrings.map((s) =>
      consistentHashingFirebaseArray(s, maxNumberOfServers)
    );

    for (
      let serverCount = 1;
      serverCount <= maxNumberOfServers;
      serverCount++
    ) {
      const counts = _.countBy(
        res.map((r) => r[serverCount - 1]).map((s) => s.split("-")[1])
      );
      console.log("numServers = " + serverCount * 10, counts);
    }
  });

  it.skip("should distribute evenly 1000 items accross 100 servers", async () => {
    const randomStrings = _.times(1000, () => randomString());
    const numServers = 10 * 10;
    const cHash = consistentHashing(numServers);
    const res = randomStrings.map((s) => cHash(s));

    const counts = _.countBy(res);
    console.log(counts);
  });
});
