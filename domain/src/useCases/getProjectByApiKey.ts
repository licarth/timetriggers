import { e } from "@/fp-ts";
import { ApiKey, Project } from "@/project";
import * as E from "fp-ts/lib/Either";
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
          return new Error(String(reason));
        }
      )
    ),
    RTE.filterOrElseW(
      (d) => d.length !== 0,
      () => "Project not found"
    ),
    RTE.filterOrElseW(
      (d) => d.length < 2,
      () => `Multiple projects found for slug ${apiKeyValue}`
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
