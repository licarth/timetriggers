import type { LoaderArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { SignIn } from "~/components/login/SignIn";

export async function loader({ request }: LoaderArgs) {
  // const userId = await getUserId(request);
  // if (userId) return redirect("/");
  return json({});
}

export const meta: MetaFunction = () => {
  return {
    title: "Login",
  };
};

export default function LoginPage() {
  return <SignIn />;
}
