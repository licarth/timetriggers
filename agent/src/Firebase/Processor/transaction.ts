import * as TE from "fp-ts/lib/TaskEither.js";

type TransactionError = {
  _tag: "TransactionError";
  message: string;
};

type UpdateFunctionError<E> = {
  _tag: "UpdateFunctionError";
  error: E;
};

export const transaction = <E, A>(
  firestore: FirebaseFirestore.Firestore,
  updateTaskEitherFn: (
    transaction: FirebaseFirestore.Transaction
  ) => TE.TaskEither<E, A>
): TE.TaskEither<E | TransactionError, A> => {
  return TE.tryCatch(
    () =>
      firestore.runTransaction(async (transaction) => {
        // THIS should return a failed promise if updateTaskEitherFn fails ! In order to rollback the transaction.
        const taskEither = updateTaskEitherFn(transaction);
        const r = await taskEither();
        if (r._tag === "Left") {
          throw {
            _tag: "UpdateFunctionError",
            error: r.left,
          };
        } else {
          return r.right;
        }
      }),
    (e) => {
      return (e as UpdateFunctionError<E>)._tag === "UpdateFunctionError"
        ? (e as UpdateFunctionError<E>).error
        : {
            _tag: "TransactionError",
            message: String(e),
          };
    }
  );
};
