import { redirect } from "@remix-run/server-runtime";

export const loader = () => redirect("api_keys");
