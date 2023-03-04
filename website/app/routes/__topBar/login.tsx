import type { MetaFunction } from "@remix-run/node";
import { SignIn } from "~/components/login/SignIn";

export const meta: MetaFunction = () => {
  return {
    title: "Login",
  };
};

export default function LoginPage() {
  return <SignIn />;
}
