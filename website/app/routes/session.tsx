import type { ActionFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import {
  FirebaseUserId,
  getProjectsForUser,
  te,
} from '@timetriggers/domain';
import { initializeApp } from '~/initializeFirebaseNode.server';
import { commitSession, getSession } from '../session.server';
import _ from 'lodash';

export const action: ActionFunction = async ({ request }) => {
  try {
    const { auth, firestore, namespace } = initializeApp();
    const payload = await request.json();
    if (request.method === 'POST') {
      const { idToken } = payload;
      const session = await getSession();
      session.set('idToken', idToken);
      const { uid: stringUid, email } = await auth.verifyIdToken(
        idToken,
      );
      const sessionCookie = await auth.createSessionCookie(idToken, {
        expiresIn: 1000 * 60 * 60 * 24 * 5,
      });

      session.set('session_cookie', sessionCookie);
      session.set('email', email);

      const uid = FirebaseUserId.from(stringUid);
      // Update user claims
      const userProjects = await te.unsafeGetOrThrow(
        getProjectsForUser(uid)({ auth, firestore, namespace }),
      );

      const projects = {
        is_owner: userProjects
          .filter((p) => p.ownerId.id === uid.id)
          .map((p) => p.id),
        can_read: userProjects
          .filter((p) =>
            p.readerIds?.map((uid) => uid.id)?.includes(uid.id),
          )
          .map((p) => p.id),
        can_edit: userProjects
          .filter((p) =>
            p.editorIds?.map((uid) => uid.id)?.includes(uid.id),
          )
          .map((p) => p.id),
      };

      await auth.setCustomUserClaims(stringUid, {
        projects,
      });

      return json(
        { idToken },
        {
          headers: {
            'Set-Cookie': await commitSession(session),
          },
        },
      );
    }
    return json({ message: 'Method not allowed' }, 405);
  } catch (e) {
    console.error(e);
    return json({ message: 'Server Error' }, 500);
  }
};
