import _ from "lodash";
import {
  consistentHashing,
  consistentHashingFirebaseArray,
  consistentHashingFirebaseArrayPreloaded,
  getShardsToListenTo,
} from "./ConsistentHashing";
import { randomString } from "../test/randomString";

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

  it("prealoaded version should be much faster once loaded - should work until 100*10=1000 machines", async () => {
    const preparedFunction = consistentHashingFirebaseArrayPreloaded(100);
    // _.times(10, (i) => console.log(preparedFunction(randomString())));
    expect(preparedFunction("someString")).toEqual([
      "1-9",
      "2-14",
      "3-14",
      "4-37",
      "5-37",
      "6-50",
      "7-50",
      "8-50",
      "9-50",
      "10-50",
      "11-50",
      "12-50",
      "13-50",
      "14-131",
      "15-131",
      "16-131",
      "17-131",
      "18-131",
      "19-131",
      "20-131",
      "21-131",
      "22-131",
      "23-131",
      "24-131",
      "25-131",
      "26-131",
      "27-131",
      "28-131",
      "29-131",
      "30-131",
      "31-131",
      "32-131",
      "33-131",
      "34-131",
      "35-131",
      "36-131",
      "37-131",
      "38-131",
      "39-131",
      "40-131",
      "41-131",
      "42-131",
      "43-131",
      "44-131",
      "45-131",
      "46-131",
      "47-131",
      "48-131",
      "49-131",
      "50-131",
      "51-131",
      "52-131",
      "53-131",
      "54-131",
      "55-131",
      "56-131",
      "57-131",
      "58-131",
      "59-131",
      "60-131",
      "61-131",
      "62-131",
      "63-131",
      "64-131",
      "65-131",
      "66-131",
      "67-131",
      "68-131",
      "69-131",
      "70-131",
      "71-131",
      "72-131",
      "73-131",
      "74-131",
      "75-131",
      "76-131",
      "77-131",
      "78-131",
      "79-131",
      "80-131",
      "81-131",
      "82-131",
      "83-131",
      "84-131",
      "85-131",
      "86-131",
      "87-131",
      "88-131",
      "89-131",
      "90-131",
      "91-131",
      "92-131",
      "93-131",
      "94-131",
      "95-131",
      "96-131",
      "97-131",
      "98-131",
      "99-131",
      "100-131",
    ]);
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

describe.skip("consistentHashingFirebaseArrayPreloaded", () => {
  let testedFunction: (s: string) => string[];
  beforeAll(() => {
    const now = Date.now();
    testedFunction = consistentHashingFirebaseArrayPreloaded(30);
    console.log("data preloaded in: " + (Date.now() - now) + "ms");
    // 30 * 10 servers takes 440 ms
    // 50 * 10 servers takes 1.1 seconds
    // 100 * 10 servers takes 5.2 seconds
  });

  it("should be able to return 100 results under 5 seconds", () => {
    jest.setTimeout(20000);
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      testedFunction(randomString());
    }
    const end = Date.now();
    expect(end - start).toBeLessThan(5000);
    console.log("it took: " + (end - start) + "ms");
  });
});

// 30 * 10 servers (300 servers max) => 130 ms per generation
// 50 * 10 servers (500 servers max) => 360 ms per generation
// 100 * 10 servers (1000 servers max) => 1.560 s per generation 😵
