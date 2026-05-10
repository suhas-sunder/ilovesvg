import compression from "compression";
import express from "express";
import morgan from "morgan";

// Short-circuit the type-checking of the built output.
const BUILD_PATH = "./build/server/index.js";
const DEVELOPMENT = process.env.NODE_ENV === "development";
const PORT = Number.parseInt(process.env.PORT || "3000");
const ACCESS_LOGS_ENABLED = process.env.ILOVESVG_ACCESS_LOGS === "1";
const MAX_LOGGED_PATH_LENGTH = 180;

const app = express();

morgan.token("safe-path", (req) => sanitizeLoggedPath(getRawRequestUrl(req)));

const accessLogger = morgan(":method :safe-path :status :response-time ms", {
  skip(req, res) {
    if (res.statusCode >= 500) return false;
    if (shouldSuppressAccessLog(req)) return true;
    return !DEVELOPMENT && !ACCESS_LOGS_ENABLED;
  },
});

process.on("uncaughtException", (error) => {
  console.error("[server] uncaughtException", sanitizeErrorForLog(error));
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("[server] unhandledRejection", sanitizeErrorForLog(error));
});

app.use(compression());
app.disable("x-powered-by");
app.use((_, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader(
    "Content-Security-Policy",
    "base-uri 'self'; object-src 'none'; frame-ancestors 'self'",
  );
  next();
});

/**
 * @param {import("express").Request} req
 */
function getExpectedOrigin(req) {
  const forwardedProto = req.get("x-forwarded-proto");
  const forwardedHost = req.get("x-forwarded-host");
  const proto = forwardedProto?.split(",")[0]?.trim() || req.protocol;
  const host = forwardedHost?.split(",")[0]?.trim() || req.get("host");
  return host ? `${proto}://${host}` : null;
}

/**
 * @param {string | undefined} value
 * @param {string | null} expectedOrigin
 */
function hasMatchingOrigin(value, expectedOrigin) {
  if (!value || !expectedOrigin) return true;
  try {
    return new URL(value).origin === expectedOrigin;
  } catch {
    return false;
  }
}

/**
 * @param {import("http").IncomingMessage & { originalUrl?: string }} req
 */
function getRawRequestUrl(req) {
  return req.originalUrl || req.url || "/";
}

/**
 * @param {string} rawUrl
 */
function sanitizeLoggedPath(rawUrl) {
  try {
    const pathname = new URL(rawUrl, "http://localhost").pathname || "/";
    return truncateLoggedPath(pathname);
  } catch {
    return "/[invalid-url]";
  }
}

/**
 * @param {string} pathname
 */
function truncateLoggedPath(pathname) {
  const cleanPath = String(pathname || "/").replace(/[\r\n\t]+/g, " ");
  if (cleanPath.length <= MAX_LOGGED_PATH_LENGTH) return cleanPath;
  return `${cleanPath.slice(0, MAX_LOGGED_PATH_LENGTH)}...`;
}

/**
 * @param {import("http").IncomingMessage & { originalUrl?: string }} req
 */
function shouldSuppressAccessLog(req) {
  const method = String(req.method || "").toUpperCase();
  if (method === "HEAD") return true;

  const pathname = sanitizeLoggedPath(getRawRequestUrl(req));
  return (
    pathname.startsWith("/assets/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/ads.txt"
  );
}

/**
 * @param {unknown} error
 */
function sanitizeErrorForLog(error) {
  const source =
    error instanceof Error
      ? `${error.name || "Error"}: ${error.message || "Unexpected error"}`
      : String(error || "Unknown error");

  return source
    .replace(/data:[^\s)]+/gi, "[data-url]")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "[svg]")
    .replace(/[^\s"'<>\\/]+\.(?:png|jpe?g|webp|gif|bmp|tiff?|svg|avif|ico|pdf)\b/gi, "[file]")
    .replace(/[A-Z]:\\[^\s)]+/g, "[path]")
    .replace(/\/(?:[^/\s)]+\/){2,}[^\s)]+/g, "[path]")
    .replace(/[A-Za-z0-9+/_=-]{200,}/g, "[long-token]")
    .replace(/[?#][^\s)]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

app.use((req, res, next) => {
  if (req.method.toUpperCase() !== "POST") {
    next();
    return;
  }

  const expectedOrigin = getExpectedOrigin(req);
  const origin = req.get("origin");
  const referer = req.get("referer");
  const hasBrowserOriginSignal = Boolean(origin || referer);
  const originMatches = hasMatchingOrigin(origin, expectedOrigin);
  const refererMatches = origin ? true : hasMatchingOrigin(referer, expectedOrigin);

  if (!hasBrowserOriginSignal || !originMatches || !refererMatches) {
    res.status(403).type("application/json").send({
      ok: false,
      code: "REQUEST_ORIGIN_BLOCKED",
      error: "This conversion request must come from the same site.",
      message: "This conversion request must come from the same site.",
    });
    return;
  }

  next();
});

if (DEVELOPMENT) {
  console.log("Starting development server");
  const viteDevServer = await import("vite").then((vite) =>
    vite.createServer({
      server: { middlewareMode: true },
    }),
  );
  app.use(viteDevServer.middlewares);
  app.use(async (req, res, next) => {
    try {
      const source = await viteDevServer.ssrLoadModule("./server/app.ts");
      if (typeof source.app?.disable === "function") {
        source.app.disable("x-powered-by");
      }
      return await source.app(req, res, next);
    } catch (error) {
      if (typeof error === "object" && error instanceof Error) {
        viteDevServer.ssrFixStacktrace(error);
      }
      next(error);
    }
  });
} else {
  console.log("Starting production server");
  app.use(accessLogger);
  app.use(
    "/assets",
    express.static("build/client/assets", { immutable: true, maxAge: "1y" }),
  );
  app.use(express.static("build/client", { maxAge: "1h" }));
  const reactRouterApp = await import(BUILD_PATH).then((mod) => mod.app);
  if (typeof reactRouterApp?.disable === "function") {
    reactRouterApp.disable("x-powered-by");
  }
  app.use(reactRouterApp);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
