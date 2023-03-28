import type { LoaderFunction } from '@remix-run/node';

import { destroyUserSession } from '~/session.server';

export const loader: LoaderFunction = async ({ request }) => {
  return destroyUserSession(request);
};
