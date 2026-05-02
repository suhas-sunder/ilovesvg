import * as React from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { LoaderFunction } from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import { PHProvider } from "./provider";
import NavBar from "./client/components/navigation/NavBar";
import { logAppError } from "./client/lib/errorLogging";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400..800&family=Inter+Tight:wght@600..800&display=swap",
  },
  { rel: "canonical", href: "https://ilovesvg.com" },
];

export const loader: LoaderFunction = async ({ request }) => {
  if (request.method !== "GET") return null;

  // Only normalize real page navigations
  const dest = request.headers.get("sec-fetch-dest") || "";
  const accept = request.headers.get("accept") || "";
  const isDocument = dest === "document" || accept.includes("text/html");
  if (!isDocument) return null;

  const url = new URL(request.url);
  const p0 = url.pathname;

  // Never touch the homepage
  if (p0 === "/") return null;

  // Skip common static prefixes
  if (
    p0.startsWith("/build/") ||
    p0.startsWith("/assets/") ||
    p0.startsWith("/fonts/")
  ) {
    return null;
  }

  // Skip file-like paths (/foo.png, /site.webmanifest)
  if (/\.[a-zA-Z0-9]+$/.test(p0)) return null;

  // Normalize path: collapse duplicate slashes, strip trailing slashes,
  // strip trailing dots/spaces (very rare, but safe)
  const p1 = p0.replace(/\/{2,}/g, "/");
  const p2 = p1.replace(/\/+$/, "");
  const p3 = p2.replace(/[.\s]+$/, "");
  const normalized = p3 || "/";

  if (normalized !== p0) {
    url.pathname = normalized;
    return new Response(null, {
      status: 308, // permanent, preserves method
      headers: { Location: url.toString() },
    });
  }

  return null;
};

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <PHProvider>
          <ClientRuntimeErrorLogger />
          <NavBar />
          {children}
          <ScrollRestoration />
          <Scripts />

          {/* Load AdSense after app scripts */}
          <script
            async
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4810616735714570"
            crossOrigin="anonymous"
          />
        </PHProvider>
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

function ClientRuntimeErrorLogger() {
  React.useEffect(() => {
    function onError(event: ErrorEvent) {
      logAppError(event.error || event.message, {
        flowStep: "window_error",
        flowKind: "runtime",
      });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      logAppError(event.reason, {
        flowStep: "unhandled_rejection",
        flowKind: "runtime",
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  React.useEffect(() => {
    if (isRouteErrorResponse(error) && error.status === 404) return;
    logAppError(error, {
      flowStep: "root_error_boundary",
      flowKind: "error-boundary",
    });
  }, [error]);

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1 className="text-2xl font-bold text-sky-950">{message}</h1>
      <p className="mt-2 text-slate-700">{details}</p>
      <a
        href="/"
        className="mt-4 inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-colors cursor-pointer hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        Back to the converter
      </a>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
