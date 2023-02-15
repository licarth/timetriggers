import type { ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { initializeApp } from "~/initializeFirebaseNode.server";
import { commitSession, getSession } from "../session.server";

export const action: ActionFunction = async ({ request }) => {
  const { auth } = initializeApp();
  const payload = await request.json();
  if (request.method === "POST") {
    const { idToken } = payload;
    const session = await getSession();
    session.set("idToken", idToken);
    const { email } = await auth.verifyIdToken(idToken);
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: 1000 * 60 * 60 * 24 * 5,
    });

    session.set("session_cookie", sessionCookie);
    session.set("email", email);

    return json(
      { idToken },
      {
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      }
    );
  }
  return json({ message: "Method not allowed" }, 405);
};
