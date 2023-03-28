import type { ActionFunction } from '@remix-run/server-runtime';
import { json } from '@remix-run/server-runtime';
import {
  projectExists,
  ProjectId,
  ProjectSlug,
  renameProject,
  rte,
} from '@timetriggers/domain';
import { pipe } from 'fp-ts/lib/function';
import * as RTE from 'fp-ts/lib/ReaderTaskEither';
import * as C from 'io-ts/lib/Codec.js';
import { draw } from 'io-ts/lib/Decoder';
import { getUserOrRedirect } from '~/loaders/getUserOrRedirect';
import { actionFromRte } from '~/utils/loaderFromRte.server';

const postCodec = C.struct({
  slug: ProjectSlug.codec,
  projectId: ProjectId.codec,
});

export const action: ActionFunction = ({ request }) =>
  actionFromRte(
    pipe(
      RTE.Do,
      RTE.bindW('user', () => getUserOrRedirect(request)),
      RTE.chainFirstW(({ user }) => {
        console.log('user', user);
        console.log('isSuperAdmin', user.isSuperAdmin());
        return user.isSuperAdmin()
          ? RTE.right(undefined)
          : RTE.left(
              json({ message: 'Not authorized' }, { status: 403 }),
            );
      }),
      RTE.bindW('postParams', () => {
        return pipe(
          () => request.formData(),
          RTE.fromTask,
          RTE.map(Object.fromEntries),
          RTE.chainEitherK(postCodec.decode),
          rte.leftSideEffect((e) => console.log(draw(e))),
        );
      }),
      RTE.bindW('isAvailable', ({ postParams: { slug } }) =>
        pipe(
          projectExists({ projectSlug: slug }),
          RTE.map((bool) => !bool),
        ),
      ),
      RTE.chainFirstW(
        ({ isAvailable, postParams: { slug, projectId } }) =>
          isAvailable
            ? pipe(
                renameProject({ slug, projectId }),
                RTE.mapLeft(({ message }) => {
                  console.error(
                    `Error renaming project: ${projectId}. ${message}`,
                  );
                  return json(
                    {
                      message: `Error renaming project: ${projectId}. Look at logs.`,
                    },
                    {
                      status: 500,
                    },
                  );
                }),
              )
            : RTE.left(
                json(
                  { message: 'Slug already taken' },
                  { status: 409 },
                ),
              ),
      ),
      RTE.map(({ postParams: { slug } }) =>
        json({ message: 'Project renamed' }, { status: 200 }),
      ),
    ),
  );
