import { e, rte, te } from "@/fp-ts";
import { isDecodeError } from "@/iots";
import { ApiKey, Project, ProjectSlug } from "@/project";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import * as E from "fp-ts/lib/Either";
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
          console.log("namespace", namespace);
          const snapshot = await firestore
            .collection(`/namespaces/${namespace}/projects`)
            .orderBy(`apiKeys.${apiKeyValue}`)
            .limit(1)
            .get();

          console.log("snapshot", snapshot.docs.length);

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
        E.mapLeft((e) => {
          console.log("error !!", e);
          if (isDecodeError(e)) {
            console.error(draw(e));
          } else {
            console.log("not a decode error", e);
          }
          return e;
        })
      )
    )
  );
