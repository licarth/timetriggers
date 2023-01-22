// @ts-nocheck
import ConsistentHash from "consistent-hash";
import _ from "lodash";

export const consistentHashing = (
  resourceName: string | number,
  maxNumberOfServers: number
): string[] => {
  const firebaseArray = [];
  const hr = new ConsistentHash({
    distribution: "uniform",
    // weight: 10,
    // range: 1003,
  });
  for (let serverCount = 1; serverCount <= maxNumberOfServers; serverCount++) {
    for (let sn = 0; sn < 10; sn++) {
      hr.add(`${(serverCount - 1) * 10 + sn}`);
    }
  }

  for (let serverCount = 1; serverCount <= maxNumberOfServers; serverCount++) {
    const serverToUse = hr.get(resourceName);
    firebaseArray.push(`${serverCount}-${serverToUse}`);
  }

  return firebaseArray;
};
