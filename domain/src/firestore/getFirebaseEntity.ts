import { CodecType } from "@/project";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { draw } from "io-ts/lib/Decoder";
import * as D from "io-ts/lib/Decoder.js";
import { flow } from "lodash";
import { EntityWithDecoder } from "./EntityWithDecoder";

interface EntityWithDecoderFunction<T> {
  codec: (codecType: CodecType) => D.Decoder<unknown, T>;
}
export const getOneFromFirestore = <T>(
  entityClass: EntityWithDecoder<T> | EntityWithDecoderFunction<T>,
  pathWithoutNamespace: string
) => {
  return pipe(
    RTE.ask<{
      firestore: FirebaseFirestore.Firestore;
      namespace: string;
      transaction?: FirebaseFirestore.Transaction;
    }>(),
    RTE.chainW(({ firestore, namespace, transaction }) => {
      const doc = firestore.doc(
        `/namespaces/${namespace}/${
          pathWithoutNamespace.startsWith("/")
            ? pathWithoutNamespace.slice(1)
            : pathWithoutNamespace
        }`
      );
      return pipe(
        TE.tryCatch(
          async () => {
            const snapshot = await (!!transaction
              ? transaction.get(doc)
              : doc.get());
            return snapshot;
          },
          (reason) => ({ _tag: "FirestoreError", message: String(reason) })
        ),
        TE.filterOrElseW(
          (d) => d.exists,
          () => ({ _tag: "NotFound" })
        ),
        TE.map((d) => d.data()),
        RTE.fromTaskEither
      );
    }),
    RTE.chainEitherKW(
      flow(
        (typeof entityClass.codec === "function"
          ? entityClass.codec("firestore")
          : entityClass.codec
        ).decode,
        E.mapLeft((e) => {
          console.error(`Could not decode \n`, draw(e));
          return { _tag: "DecoderError", message: draw(e) };
        })
      )
    )
  );
};
