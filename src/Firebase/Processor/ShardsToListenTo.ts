export type ShardsToListenTo = {
  nodeCount: number;
  nodeIds: number[];
};

export const toShards = (shardsToListenTo?: ShardsToListenTo) => {
  if (!shardsToListenTo) return undefined;
  const { nodeCount, nodeIds } = shardsToListenTo;
  return nodeIds.map((nodeId) => `${nodeCount}-${nodeId}`);
};
