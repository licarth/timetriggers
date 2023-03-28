import { te } from '@timetriggers/domain';
import type * as RTE from 'fp-ts/lib/ReaderTaskEither';
import { buildDeps } from '~/buildDeps.server';

export const loaderFromRte = async <U>(
  rte: RTE.ReaderTaskEither<ReturnType<typeof buildDeps>, any, U>,
) => {
  const result = rte(buildDeps());
  return await te.unsafeGetOrThrow(result);
};

export const actionFromRte = async <U>(
  rte: RTE.ReaderTaskEither<ReturnType<typeof buildDeps>, any, U>,
) => {
  const result = rte(buildDeps());
  const newLocal = await te.unsafeGetOrThrow(result);
  console.log('newLocal', newLocal);
  return newLocal;
};
