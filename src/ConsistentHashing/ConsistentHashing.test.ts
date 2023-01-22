import _ from "lodash";
import {
  consistentHashing,
  consistentHashingFirebaseArray,
  getShardsToListenTo,
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

  it("array and single method must match", async () => {
    const s = randomString();
    expect(consistentHashingFirebaseArray(s, 10)).toEqual(
      _.times(10, (i) => consistentHashing((i + 1) * 10)(s)).map(
        (s, i) => `${i + 1}-${s}`
      )
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

describe("getShardsToListenTo", () => {
  it("should return all shards when there is only 1 server", async () => {
    const res = getShardsToListenTo(0, 1);
    expect(res).toEqual(null);
  });
  it("should return items for server i=0 (total 2)", async () => {
    const res = getShardsToListenTo(0, 2);
    expect(res).toEqual([
      "2-0",
      "2-1",
      "2-2",
      "2-3",
      "2-4",
      "2-5",
      "2-6",
      "2-7",
      "2-8",
      "2-9",
    ]);
  });
  it("should return items for server i=3 (total 7)", async () => {
    const res = getShardsToListenTo(3, 7);
    expect(res).toEqual([
      "7-30",
      "7-31",
      "7-32",
      "7-33",
      "7-34",
      "7-35",
      "7-36",
      "7-37",
      "7-38",
      "7-39",
    ]);
  });
  it("should return items for server i=10 (total 11)", async () => {
    const res = getShardsToListenTo(10, 11);
    expect(res).toEqual([
      "11-100",
      "11-101",
      "11-102",
      "11-103",
      "11-104",
      "11-105",
      "11-106",
      "11-107",
      "11-108",
      "11-109",
    ]);
  });
  it("should return items for server i=11 (total 12)", async () => {
    const res = getShardsToListenTo(11, 12);
    expect(res).toEqual([
      "11-29",
      "11-39",
      "11-49",
      "11-59",
      "11-69",
      "11-79",
      "11-89",
      "11-99",
      "11-109",
    ]);
  });
  it("should return items for server i=10 (total 12)", async () => {
    const res = getShardsToListenTo(10, 12);
    expect(res).toEqual([
      "11-100",
      "11-101",
      "11-102",
      "11-103",
      "11-104",
      "11-105",
      "11-106",
      "11-107",
      "11-108",
    ]);
  });
  it("should return items for server i=12 (total 13)", async () => {
    const res = getShardsToListenTo(12, 13);
    expect(res).toEqual([
      "11-9",
      "11-19",
      "11-68",
      "11-78",
      "11-88",
      "11-98",
      "11-108",
      "11-109",
    ]);
  });
  it("should return items for server i=0 (total 110)", async () => {
    const res = getShardsToListenTo(0, 110);
    expect(res).toEqual(["11-0"]);
  });
  it("should return items for server i=0 (total 110)", async () => {
    const res = getShardsToListenTo(1, 110);
    expect(res).toEqual(["11-10"]);
  });
});
