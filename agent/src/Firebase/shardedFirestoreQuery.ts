export const shardedFirestoreQuery = (
  collection: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>,
  shards?: string[]
) => {
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
    collection;
  if (shards && shards.length > 0) {
    console.log("shards", shards);
    query = query.where("shards", "array-contains-any", shards);
  }
  return query;
};
