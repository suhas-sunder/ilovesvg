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

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  { rel: "canonical", href: "https://ilovesvg.com" },
];

export const loader: LoaderFunction = async ({ request }) => {
  if (request.method !== "GET") return null;

  // Only normalize full-page HTML navigations
  const dest = request.headers.get("sec-fetch-dest") || "";
  const accept = request.headers.get("accept") || "";
  const isDocument = dest === "document" || accept.includes("text/html");
  if (!isDocument) return null;

  const url = new URL(request.url);
  const host = url.hostname;
  const p0 = url.pathname;

  // Optional: consolidate host to apex (keep or remove this block as you prefer)
  if (host === "www.ilovesvg.com") {
    url.hostname = "ilovesvg.com";
    return new Response(null, {
      status: 308,
      headers: { Location: url.toString() },
    });
  }

  // Never touch root
  if (p0 === "/") return null;

  // Skip obvious static buckets
  if (
    p0.startsWith("/build/") ||
    p0.startsWith("/assets/") ||
    p0.startsWith("/fonts/")
  ) {
    return null;
  }

  // Skip file-like paths, e.g. /foo.png, /site.webmanifest
  if (/\.[a-zA-Z0-9]+$/.test(p0)) return null;

  // Normalize path:
  // 1) collapse duplicate slashes
  // 2) remove trailing slashes
  // 3) remove trailing dots/spaces (rare, but safe)
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
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

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
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
