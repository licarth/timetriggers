import { e } from "@/fp-ts";
import { FirebaseUserId, Project } from "@/project";
import type { auth } from "firebase-admin";
import { pipe } from "fp-ts/lib/function.js";
import * as RTE from "fp-ts/lib/ReaderTaskEither.js";
import * as TE from "fp-ts/lib/TaskEither.js";
import { DecodeError, draw } from "io-ts/lib/Decoder";
import _ from "lodash";

type Dependencies = {
  firestore: FirebaseFirestore.Firestore;
  auth: auth.Auth;
  namespace: string;
};

export const getProjectsForUser = (userId: FirebaseUserId) =>
  pipe(
    RTE.ask<Dependencies>(),
    RTE.chainW(({ firestore, namespace, auth }) =>
      TE.tryCatchK(
        async () => {
          const serializedUserId = FirebaseUserId.codec.encode(userId);
          const user = await auth.getUser(serializedUserId.id);
          const ownedProjects = firestore
            .collection(`/namespaces/${namespace}/projects`)
            .where("ownerId.id", "==", serializedUserId.id);
          const readerProjects = firestore
            .collection(`/namespaces/${namespace}/projects`)
            .where("readerIds", "array-contains", serializedUserId);
          const editorProjects = firestore
            .collection(`/namespaces/${namespace}/projects`)
            .where("editorIds", "array-contains", serializedUserId);

          const snapshots = await Promise.all([
            ownedProjects.get(),
            readerProjects.get(),
            editorProjects.get(),
          ]);

          return _.flatMap(
            snapshots.map((snapshot) =>
              pipe(
                snapshot.docs.map((doc) =>
                  pipe(doc.data(), Project.codec("firestore").decode)
                ),
                e.split,
                ({ successes, errors }) => {
                  if (errors.length > 0) {
                    errors.map((e) => console.error(draw(e as DecodeError)));
                  }
                  return successes;
                }
              )
            )
          );
        },
        (reason) => new Error(String(reason))
      )
    )
  );
