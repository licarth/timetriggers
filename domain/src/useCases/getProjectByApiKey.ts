import { e } from "@/fp-ts";
import { ApiKey, Project } from "@/project";
import * as E from "fp-ts/lib/Either.js";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { draw } from "io-ts/lib/Decoder";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  namespace: string;
};

export const getProjectByApiKey = ({
  apiKeyValue,
}: {
  apiKeyValue: ApiKey["value"];
}) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.chainW(({ firestore, namespace }) =>
      pipe(
        apiKeyValue,
        E.fromPredicate(
          (apiKeyValue) => apiKeyValue.length > 0,
          () => "Invalid api key" as const
        ),
        TE.fromEither,
        TE.chainW(
          TE.tryCatchK(
            async () => {
              const snapshot = await firestore
                .collection(`/namespaces/${namespace}/projects`)
                .orderBy(`apiKeys.${apiKeyValue}`)
                .limit(1)
                .get();

              return snapshot.docs;
            },
            (reason) => {
              return "firebase-error" as const;
            }
          )
        ),
        RTE.fromTaskEither
      )
    ),
    RTE.filterOrElseW(
      (d) => d.length !== 0,
      () => "Project not found" as const
    ),
    RTE.filterOrElseW(
      (d) => d.length < 2,
      () => `Multiple projects found for api key ${apiKeyValue}` as const
    ),
    RTE.map((d) => pipe(d[0].data())),
    RTE.chainEitherKW((d) =>
      pipe(
        d,
        Project.codec("firestore").decode,
        e.leftSideEffect((e) => {
          console.error(`Cannot decode project`, draw(e));
        })
      )
    )
  );
