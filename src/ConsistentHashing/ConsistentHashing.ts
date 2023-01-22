// @ts-nocheck
import ConsistentHash from "consistent-hashing";
import _ from "lodash";

export const consistentHashing = (
  resourceName: string | number,
  maxNumberOfServers: number
): string[] => {
  const firebaseArray = [];
  for (let serverCount = 1; serverCount <= maxNumberOfServers; serverCount++) {
    const hr = new ConsistentHash(_.times(10 * serverCount, (i) => `${i}`));
    const serverToUse = hr.getNode(String(resourceName));
    firebaseArray.push(serverToUse);
  }

  return firebaseArray;
};
