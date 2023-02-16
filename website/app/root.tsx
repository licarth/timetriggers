import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import { extendTheme, theme as baseTheme } from "@chakra-ui/react";
import { mode } from "@chakra-ui/theme-tools";

import {
  ChakraProvider,
  cookieStorageManagerSSR,
  localStorageManager,
} from "@chakra-ui/react";
import type { GlobalProps } from "@emotion/react";
import { withEmotionCache } from "@emotion/react";
import type { LinksFunction, LoaderArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node"; // Depends on the runtime you choose
import React, { useContext, useEffect } from "react";

import _ from "lodash";
import { ClientStyleContext, ServerStyleContext } from "./context";
import { FirebaseAuthProvider } from "./contexts/FirebaseAuthContext";
import { environmentVariable } from "./environmentVariable";
import { initializeFirebaseWeb } from "./initializeFirebaseWeb";
import styled from "@emotion/styled";

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
  title: "timetriggers.io",
  viewport: "initial-scale=1,viewport-fit=cover,width=device-width",
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
      <Html lang="en">
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
        <Body>
          {children}
          <ScrollRestoration />
          <Scripts />
          <LiveReload />
        </Body>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(data.ENV)}`,
          }}
        />
      </Html>
    );
  }
);

const Body = styled.body`
  height: 100%;
  min-height: -webkit-fill-available;
`;

const Html = styled.html`
  height: 100%;
  min-height: -webkit-fill-available;
`;

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
    styles: {
      global: (props: GlobalProps) => ({
        // Optionally set global CSS styles
        body: {
          bg: mode("gray.50", "gray.800")(props),
        },
      }),
    },
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
        </FirebaseAuthProvider>
      </ChakraProvider>
    </Document>
  );
}
