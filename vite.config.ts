// vite.config.ts
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ isSsrBuild }) => ({
  build: {
    rollupOptions: isSsrBuild
      ? {
          input: "./server/app.ts",
        }
      : undefined,
  },
  worker: {
    format: "es",
  },
  plugins: [
    tracingServerFallbackResolver(),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
  ssr: {
    noExternal: ["posthog-js", "posthog-js/react"],
  },
}));

function tracingServerFallbackResolver() {
  return {
    name: "ilovesvg-tracing-server-fallback-resolver",
    enforce: "pre" as const,
    resolveId(source: string, _importer: string | undefined, options: { ssr?: boolean }) {
      if (source !== "~/shared/tracing/serverFallback") {
        return null;
      }

      return path.resolve(
        projectRoot,
        options.ssr
          ? "app/shared/tracing/serverFallback.server.ts"
          : "app/shared/tracing/serverFallback.client.ts",
      );
    },
  };
}
