import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CURRENT_MAIN_REF = process.env.AUDIT_BASE_REF || "origin/main";
export const CURRENT_MAIN_SHA = execFileSync("git", ["rev-parse", "--verify", `${CURRENT_MAIN_REF}^{commit}`], {
  cwd: ROOT, encoding: "utf8",
}).trim();
export const CURRENT_CONTRACT_FILES = new Set([
  "app/client/components/navigation/OtherToolsLinks.tsx",
  "app/data/routeManifest.ts",
]);
const normalize = source => source.replace(/\r\n/g, "\n");

export function assertServerStartupPreserved(current, historical) {
  if (normalize(current) === normalize(historical)) return;
  // This exact revision adds production error handling and failed-bind handling.
  // Keep the historical gate for every other startup change.
  const reviewed = execFileSync("git", ["show", "88e1942c12e8b968d7b7d393d778bf3cc3f91d30:server.js"], {
    cwd: ROOT, encoding: "utf8",
  });
  assert.equal(normalize(current), normalize(reviewed), "server.js differs from historical and reviewed startup contracts");
}

function literal(node) {
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) return literal(node.expression);
  if (ts.isStringLiteralLike(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
    assert.ok(ts.isPropertyAssignment(property), "Manifest contract requires literal properties");
    return [property.name.text, literal(property.initializer)];
  }));
  throw new Error(`Unsupported manifest contract literal: ${ts.SyntaxKind[node.kind]}`);
}

export function routeManifestContract(source) {
  const ast = ts.createSourceFile("routeManifest.ts", source, ts.ScriptTarget.Latest, true);
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(ast) === "ROUTE_MANIFEST") return literal(declaration.initializer);
    }
  }
  throw new Error("ROUTE_MANIFEST literal was not found");
}

export function assertRouteAndNavigationContracts(manifestSource, navigationSource) {
  const entries = routeManifestContract(manifestSource);
  const byPath = new Map(entries.map(entry => [entry.path, entry]));
  assert.equal(byPath.size, entries.length, "Manifest must have unique paths");
  for (const entry of entries) {
    assert.match(entry.path, /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/, `Invalid route path ${entry.path}`);
    assert.ok(byPath.has(entry.canonicalPath), `${entry.path} canonical target does not exist`);
    if (entry.indexable) {
      assert.equal(entry.canonicalPath, entry.path, `${entry.path} indexable canonical must be self-referential`);
      assert.ok(!entry.redirectTo, `${entry.path} redirect cannot be indexable`);
    }
    if (entry.redirectTo) {
      const target = byPath.get(entry.redirectTo);
      assert.ok(target && !target.redirectTo, `${entry.path} must redirect directly to a real destination`);
      assert.equal(entry.indexable, false, `${entry.path} redirect must be noindex`);
      assert.equal(entry.sitemap, "exclude", `${entry.path} redirect must be excluded from sitemap`);
    }
  }
  const navigation = ts.createSourceFile("OtherToolsLinks.tsx", navigationSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const links = [];
  function visit(node) {
    if (ts.isPropertyAssignment(node) && ["href", "to"].includes(node.name.text) &&
        ts.isStringLiteralLike(node.initializer) && node.initializer.text.startsWith("/")) links.push(node.initializer.text);
    ts.forEachChild(node, visit);
  }
  visit(navigation);
  assert.ok(links.length > 20, "All Tools must retain a meaningful public link inventory");
  for (const link of links) assert.ok(byPath.get(link)?.publicRoute, `Navigation references unregistered/non-public route ${link}`);
  return { routes: entries.length, navigationLinks: links.length };
}

export function assertCurrentMainPreserved(relativePath) {
  assert.ok(CURRENT_CONTRACT_FILES.has(relativePath), `Unexpected current-main contract file ${relativePath}`);
  const current = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  const baseline = execFileSync("git", ["show", `${CURRENT_MAIN_SHA}:${relativePath}`], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(normalize(current), normalize(baseline), `${relativePath} differs from explicit release base ${CURRENT_MAIN_SHA}; review the change instead of resetting a historical hash`);
  return assertRouteAndNavigationContracts(
    fs.readFileSync(path.join(ROOT, "app/data/routeManifest.ts"), "utf8"),
    fs.readFileSync(path.join(ROOT, "app/client/components/navigation/OtherToolsLinks.tsx"), "utf8"),
  );
}
