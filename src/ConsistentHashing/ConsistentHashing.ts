// @ts-nocheck
import ConsistentHash from "consistent-hashing";
import _ from "lodash";

export const consistentHashingFirebaseArray = (
  resourceName: string | number,
  maxNumberOfServers: number
): string[] => {
  const firebaseArray = [];
  const hr = new ConsistentHash([]);

  for (let serverCount = 1; serverCount <= maxNumberOfServers; serverCount++) {
    _.times(10, (i) => hr.addNode(String((serverCount - 1) * 10 + i)));
    const serverToUse = hr.getNode(String(resourceName));
    firebaseArray.push(`${serverCount}-${serverToUse}`);
  }

  return firebaseArray;
};

export const consistentHashing = (serverCount: number) => {
  const hr = new ConsistentHash(_.times(serverCount, (i) => String(i)));
  return (resourceName: string | number) => {
    return Number(hr.getNode(String(resourceName)));
  };
};
