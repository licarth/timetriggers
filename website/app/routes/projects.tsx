import { Flex } from "@chakra-ui/react";
import { Outlet } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/server-runtime";
import { redirect } from "@remix-run/server-runtime";
import { Footer } from "~/components/footer/Footer";
import { environmentVariable } from "~/environmentVariable";
import { requireUserId } from "~/session.server";
import { Sidebar } from "../components/Sidebar/Sidebar";

const Root = () => {
  return (
    <Flex flexDir={"row"}>
      <Sidebar />
      <Content />
    </Flex>
  );
};

const Content = () => (
  <Flex direction={"column"} flexGrow="1" justifyContent="space-between">
    <Outlet />
    <Footer />
  </Flex>
);

export default Root;

export const loader: LoaderFunction = async ({ request }) => {
  const user = await requireUserId(request);
  if (user !== null || environmentVariable("PUBLIC_USE_EMULATORS") === "true") {
    return {};
  } else {
    return redirect("/login");
  }
};
