// vite.config.ts
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ isSsrBuild }) => ({
  resolve: {
    alias: [
      {
        find: /^~\/shared\/tracing\/serverFallback$/,
        replacement: path.resolve(
          projectRoot,
          isSsrBuild
            ? "app/shared/tracing/serverFallback.server.ts"
            : "app/shared/tracing/serverFallback.client.ts",
        ),
      },
    ],
  },
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
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  ssr: {
    noExternal: ["posthog-js", "posthog-js/react"],
  },
}));
