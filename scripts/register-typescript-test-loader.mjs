// Test-only bridge for Node 20, which cannot execute application TypeScript.
// Production remains the React Router build; no runtime loader is installed.
import { register } from "node:module";
register("./typescript-test-loader.mjs", import.meta.url);
