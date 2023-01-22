import _ from "lodash";
import { consistentHashing } from "./ConsistentHashing";

const randomString = () => {
  return Math.random().toString(36).substring(7);
};

describe("Firebase Consistent Hashing", () => {
  it("should return an empty array when only one server", async () => {
    const res = consistentHashing("anyRessource", 0);
    expect(res).toEqual([]);
  });

  it("should be deterministic", async () => {
    const s = randomString();
    console.log(_.times(10, (i) => consistentHashing(`string-${i}`, 5)));
    expect(consistentHashing(s, 10)).toEqual(consistentHashing(s, 10));
  });

  it.skip("should distribute evenly accross 10 servers", async () => {
    const randomStrings = _.times(100, () => randomString());
    const maxNumberOfServers = 10;
    const res = randomStrings.map((s) =>
      consistentHashing(s, maxNumberOfServers)
    );

    for (
      let serverCount = 0;
      serverCount <= maxNumberOfServers;
      serverCount++
    ) {
      const counts = _.countBy(
        res.map((r) => r[serverCount]).map((s) => s.split("-")[1])
      );
      console.log("numServers = " + serverCount, counts);
    }
  });
});
