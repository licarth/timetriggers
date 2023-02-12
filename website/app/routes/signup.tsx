import type { LoaderArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { SignUp } from "~/components/login/SignUp";

export async function loader({ request }: LoaderArgs) {
  // const userId = await getUserId(request);
  // if (userId) return redirect("/");
  return json({});
}

export const meta: MetaFunction = () => {
  return {
    title: "Sign Up",
  };
};

export default function SignUpPage() {
  return <SignUp />;
}
