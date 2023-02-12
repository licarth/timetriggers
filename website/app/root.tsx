import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";

import {
  ChakraProvider,
  cookieStorageManagerSSR,
  localStorageManager,
} from "@chakra-ui/react";
import { withEmotionCache } from "@emotion/react";
import type { LinksFunction, LoaderArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node"; // Depends on the runtime you choose
import React, { useContext, useEffect } from "react";

import { extendTheme } from "@chakra-ui/react";
import _ from "lodash";
import { ClientStyleContext, ServerStyleContext } from "./context";
import { FirebaseAuthProvider } from "./contexts/FirebaseAuthContext";
import { environmentVariable } from "./environmentVariable";
import { initializeFirebaseWeb } from "./initializeFirebaseWeb";

export let links: LinksFunction = () => {
  return [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com" },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap",
    },
  ];
};

interface DocumentProps {
  children: React.ReactNode;
}

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "timetriggers",
  viewport: "width=device-width,initial-scale=1",
});

export async function loader({ request }: LoaderArgs) {
  return json({
    cookies: request.headers.get("cookie") ?? "",
    ENV: {
      ..._.pickBy(process.env, (value, key) => key.startsWith("PUBLIC_")),
    },
  });
}

const Document = withEmotionCache(
  ({ children }: DocumentProps, emotionCache) => {
    const serverStyleData = useContext(ServerStyleContext);
    const clientStyleData = useContext(ClientStyleContext);
    const data = useLoaderData();

    // Only executed on client
    useEffect(() => {
      // re-link sheet container
      emotionCache.sheet.container = document.head;
      // re-inject tags
      const tags = emotionCache.sheet.tags;
      emotionCache.sheet.flush();
      tags.forEach((tag) => {
        (emotionCache.sheet as any)._insertTag(tag);
      });
      // reset cache to reapply global styles
      clientStyleData?.reset();
    }, []);

    if (typeof document !== "undefined") {
      // Execute only on client
      initializeFirebaseWeb({
        useEmulators: environmentVariable("PUBLIC_USE_EMULATORS") === "true",
      });
    }

    return (
      <html lang="en" className="h-full">
        <head>
          <Meta />
          <Links />
          {serverStyleData?.map(({ key, ids, css }) => (
            <style
              key={key}
              data-emotion={`${key} ${ids.join(" ")}`}
              dangerouslySetInnerHTML={{ __html: css }}
            />
          ))}
        </head>
        <body className="h-full">
          {children}
          <ScrollRestoration />
          <Scripts />
          <LiveReload />
        </body>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(data.ENV)}`,
          }}
        />
      </html>
    );
  }
);

export default function App() {
  const { cookies } = useLoaderData();

  // 2. Add your color mode config
  const config = {
    initialColorMode: "dark",
    useSystemColorMode: true,
  };

  const components = {};
  const colors = {
    // brand: {
    //   900: "#1a365d",
    //   800: "#153e75",
    //   700: "#2a69ac",
    // },
  };

  // 3. extend the theme
  const theme = extendTheme({
    config,
    colors,
    components,
  });

  return (
    <Document>
      <ChakraProvider
        theme={theme}
        colorModeManager={
          typeof cookies === "string"
            ? cookieStorageManagerSSR(cookies)
            : localStorageManager
        }
      >
        <FirebaseAuthProvider>
          <Outlet />
          {/* <Footer /> */}
        </FirebaseAuthProvider>
      </ChakraProvider>
    </Document>
  );
}
