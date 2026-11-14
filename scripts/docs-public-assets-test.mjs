import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "ilovesvg-docs-assets-"));
const fixture = path.join(temporaryDirectory, "fixture");
const outside = path.join(temporaryDirectory, "outside-public");
const docsFile = "app/routes/how-it-works.exporting-and-downloads.tsx";
const auditFile = "scripts/docs-audit.mjs";

try {
  const appFiles = execFileSync("git", ["ls-files", "app/routes/how-it-works*.tsx"], {
    cwd: root,
    encoding: "utf8",
  }).trim().split(/\r?\n/);
  for (const file of [
    auditFile,
    ...appFiles,
    "app/routes.ts",
    "app/routes/sitemap.tsx",
    "app/client/components/navigation/SiteFooter.tsx",
    "app/client/components/docs/HowItWorksDocs.tsx",
    "app/client/lib/docs/howItWorksContent.ts",
    "app/client/lib/converter/presetIntensity.ts",
  ]) {
    await mkdir(path.dirname(path.join(fixture, file)), { recursive: true });
    await cp(path.join(root, file), path.join(fixture, file));
  }

  await cp(path.join(root, "public"), path.join(fixture, "public"), { recursive: true });
  await mkdir(path.join(fixture, "public", "test-downloads"));
  await writeFile(path.join(fixture, "public", "test-downloads", "manifest.json"), "{}\n");
  await mkdir(outside);
  await writeFile(path.join(outside, "private.json"), "{}\n");
  await symlink(outside, path.join(fixture, "public", "linked"), process.platform === "win32" ? "junction" : "dir");

  const docsSource = await readFile(path.join(fixture, docsFile), "utf8");
  for (const [url, expectedStatus] of [
    ["/how-it-works/troubleshooting", 0],
    ["/test-downloads/manifest.json#details", 0],
    ["/test-downloads/missing.json", 1],
    ["/test-downloads/", 1],
    ["/../app/routes.ts", 1],
    ["/linked/private.json", 1],
  ]) {
    await writeFile(path.join(fixture, docsFile), `${docsSource}\n// href="${url}"\n`);
    const result = spawnSync(process.execPath, [auditFile], { cwd: fixture, encoding: "utf8" });
    assert.equal(result.status, expectedStatus, `${url}\n${result.stdout}\n${result.stderr}`);
    if (expectedStatus === 1) {
      assert.match(result.stderr, /links to missing route or public asset/);
    }
  }
  console.log("Docs audit accepted registered routes and files inside public, and rejected missing files, directories and escaping links.");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
