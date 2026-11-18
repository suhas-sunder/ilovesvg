import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const occupied = createServer();
occupied.listen(0, "0.0.0.0");
await once(occupied, "listening");
try {
  const port = occupied.address().port;
  const child = spawnSync(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production", PORT: String(port) },
    encoding: "utf8",
    timeout: 15_000,
    windowsHide: true,
  });
  assert.ifError(child.error);
  assert.equal(child.status, 1, "a failed production bind must exit nonzero");
  assert.match(child.stderr, /listen failed.*EADDRINUSE/);
  assert.doesNotMatch(child.stdout, /Server is running/);
  console.log("PASS occupied port fails startup with no false readiness message.");
} finally {
  await new Promise((resolve, reject) => occupied.close(error => error ? reject(error) : resolve()));
}
