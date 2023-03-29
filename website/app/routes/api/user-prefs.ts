import type { ActionFunction } from '@remix-run/server-runtime';
import { UserPrefs } from '@timetriggers/domain';
import { userPrefs } from '~/cookies.server';

export const action: ActionFunction = async ({ request }) => {
  const requestJson = await request.json();

  const decodedUserPrefs = new UserPrefs({
    initialNavSize: requestJson.initialNavSize,
  });

  return new Response('OK', {
    headers: {
      'Set-Cookie': await userPrefs.serialize(
        UserPrefs.codec('string').encode(decodedUserPrefs),
      ),
    },
  });
};
