export const shardedFirestoreQuery = (
  collection: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>,
  shards?: string[]
) => {
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
    collection;
  if (shards) {
    query = query.where("shards", "array-contains-any", shards);
  }
  return query;
};
