import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe = await readFile(process.env.AXE_SCRIPT, "utf8");
const base = new URL(process.env.BASE_URL || "http://127.0.0.1:5182");
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname));
const out = path.resolve(process.env.AXE_OUT || "tmp/phase1-evidence/axe-candidate");
await mkdir(out, { recursive: true });
const browser = await pw.chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.route("**/*", r => new URL(r.request().url()).origin === base.origin ? r.continue() : r.abort());
const report = [];
async function scan(page, state) {
  await page.addScriptTag({ content: axe });
  const result = await page.evaluate(async () => {
    const data = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
    return { version: data.testEngine.version, violations: data.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, html: n.html, failure: n.failureSummary })) })), incomplete: data.incomplete.map(v => v.id) };
  });
  report.push({ route: new URL(page.url()).pathname, state, ...result });
}
try {
  for (const route of ["/", "/png-to-svg-converter", "/svg-to-png-converter", "/svg-cleaner", "/how-it-works"]) {
    const page = await context.newPage();
    await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
    await scan(page, "empty");
    if (route === "/") {
      await page.getByRole("button", { name: "Open menu", exact: true }).click();
      await scan(page, "mobile-navigation");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /Show \d+ more presets/ }).click();
      await scan(page, "expanded-presets");
      await page.getByRole("button", { name: "Show fewer presets" }).click();
      const input = page.locator('input[type="file"]').first();
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), input.click()]);
      await chooser.setFiles(path.resolve("tmp/phase1-evidence/input.png"));
      await page.locator('[data-output-stamp]').first().getByRole("button", { name: "Download SVG", exact: true }).waitFor({ timeout: 60000 });
      await scan(page, "result");
    }
    await page.close();
  }
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.map(r => ({ route: r.route, state: r.state, violations: r.violations.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length })) })), null, 2));
} finally { await context.close(); await browser.close(); }
