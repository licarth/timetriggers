export type ShardsToListenTo = {
  prefix: number;
  nodeIds: number[];
};

export const toShards = (shardsToListenTo?: ShardsToListenTo) => {
  if (!shardsToListenTo) return undefined;
  const { prefix, nodeIds } = shardsToListenTo;
  return nodeIds.map((nodeId) => `${prefix}-${nodeId}`);
};
