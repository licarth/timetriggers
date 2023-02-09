import { Shard } from "@/domain/Shard";
import { ShardsToListenTo } from "@/Firebase/Processor/ShardsToListenTo";
import { flow } from "fp-ts/lib/function.js";
import _ from "lodash";
import { CustomConsistentHashing as ConsistentHash } from "./CustomConsistentHashing";

export const consistentHashingFirebaseArray = (
  resourceName: string | number,
  tensOfServerCount: number
): string[] => {
  const firebaseArray = [];
  const hr = ConsistentHash.build([]);

  for (let serverCount = 1; serverCount <= tensOfServerCount; serverCount++) {
    _.times(10, (i) => hr.addNode(String((serverCount - 1) * 10 + i)));
    const serverToUse = hr.getNode(String(resourceName));
    firebaseArray.push(`${serverCount}-${serverToUse}`);
  }

  return firebaseArray;
};

export const consistentHashingFirebaseArrayPreloaded = (
  tensOfServerCount: number
) => {
  const hrs: ConsistentHash[] = [];

  let hr = ConsistentHash.build([]);
  for (let serverCount = 1; serverCount <= tensOfServerCount; serverCount++) {
    _.times(10, (i) => hr.addNode(String((serverCount - 1) * 10 + i)));
    hrs.push(hr.clone());
  }

  return (resourceName: string | number): string[] => {
    return hrs.map((hr, i) => {
      const serverToUse = hr.getNode(String(resourceName));
      return `${i + 1}-${serverToUse}`;
    });
  };
};

export const consistentHashing = (serverCount: number) => {
  const hr = ConsistentHash.build(_.times(serverCount, (i) => String(i)));
  return (resourceName: string | number) => {
    return Number(hr.getNode(String(resourceName)));
  };
};

export const getShardsToListenTo = (
  serverIndex: number,
  serverCount: number,
  maxArrayInQuery: number = 10 // Default Firebase value
) => {
  // For serverCount between 2 and 11, it's easy.
  if (serverCount === 1) {
    return undefined;
  }
  if (serverCount <= 11) {
    return _.times(maxArrayInQuery, (i) =>
      Shard.of(serverIndex * maxArrayInQuery + i, serverCount)
    ) as Shard[];
  }

  // Build the whole line for serverCount > 11
  const matrix = _.times(11, (y) =>
    _.times(maxArrayInQuery, (x) => x + y * 10)
  );

  let k = 10;
  for (let i = 12; i <= serverCount; i++) {
    let newLine = [];

    const numItemsToTake = Math.floor((11 * maxArrayInQuery) / i);

    for (let j = 0; j < numItemsToTake; j++) {
      newLine.push(matrix[k].pop());
      k = modulo(k - 1, i - 1);
    }
    //@ts-ignore
    matrix.push(newLine.sort((a, b) => a - b));
  }

  return matrix[serverIndex].map((i) => Shard.of(i, 11));
};

export const getShardsToListenToObject = (
  serverIndex: number,
  serverCount: number
): ShardsToListenTo | null => {
  const nodeIds = getShardsToListenTo(serverIndex, serverCount)?.map(
    (s) => s.nodeId
  );
  return nodeIds
    ? {
        nodeIds,
        nodeCount: serverCount,
      }
    : null;
};

export const getShardsToListenToString = flow(getShardsToListenTo, (x) =>
  x ? x.map((s) => s.toString()) : x
);

// 3 servers => 3-20 => 3-29

const modulo = (n: number, m: number) => ((n % m) + m) % m;
