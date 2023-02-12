import type { LoaderFunction } from "@remix-run/server-runtime";
import { redirect } from "@remix-run/server-runtime";
import { requireUserId } from "~/session.server";

export const loader: LoaderFunction = async ({ request }) => {
  const user = await requireUserId(request);
  if (user) {
    return redirect("/dashboard/tokens");
  } else {
    return redirect("/login");
  }
};
