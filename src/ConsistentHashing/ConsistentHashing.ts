// @ts-nocheck
import ConsistentHash from "./consistent-hash";
import _ from "lodash";

export const consistentHashing = (
  resourceName: string | number,
  maxNumberOfServers: number
): string[] => {
  const firebaseArray = [];
  for (let serverCount = 1; serverCount <= maxNumberOfServers; serverCount++) {
    const hr = new ConsistentHash({
      // distribution: "uniform",
      // weight: 10,
      // range: 1003,
    });

    _.times(serverCount * 10, (i) => hr.add(`${i}`));

    const serverToUse = hr.get(resourceName);
    firebaseArray.push(`${serverCount}-${serverToUse}`);
  }

  return firebaseArray;
};
