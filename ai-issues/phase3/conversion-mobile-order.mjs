import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const base = new URL(process.env.BASE_URL || "http://127.0.0.1:5303");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname));
const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out = path.resolve(process.env.CONVERSION_OUT || "tmp/phase3/conversion-mobile-order");
await mkdir(out, { recursive: true });
const fixture = path.join(out, "mobile-fixture.png");
await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="100%" height="100%" fill="white"/><path d="M10 95L65 20L143 88L130 98L65 43L25 98Z"/></svg>')).png().toFile(fixture);
const report = [];

for (const browserName of ["chromium", "webkit"]) {
  const browser = await pw[browserName].launch();
  try {
    for (const [route, name, width] of [["/", "home", 320], ["/png-to-svg-converter", "png", 390]]) {
      const context = await browser.newContext({
        ...(browserName === "webkit" ? pw.devices["iPhone 13"] : { isMobile: true, hasTouch: true }),
        viewport: { width, height: 844 },
      });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await context.route("**/*", r => new URL(r.request().url()).origin === base.origin ? r.continue() : r.abort());
        await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
        await page.waitForFunction(() => Object.keys(document.querySelector('input[type="file"]') || {})
          .some(key => key.startsWith("__reactProps$")));
        await page.locator('input[type="file"]').first().setInputFiles(fixture);
        const card = page.locator("[data-output-stamp]").first();
        await card.getByRole("button", { name: "Download SVG", exact: true }).waitFor({ timeout: 25_000 });
        const geometry = await page.evaluate(() => {
          const bounds = selector => {
            const node = document.querySelector(selector);
            const { top, bottom, height } = node.getBoundingClientRect();
            return { top, bottom, height, visible: getComputedStyle(node).display !== "none" && height > 0 };
          };
          return {
            input: bounds('[data-converter-input="true"]'),
            output: bounds("[data-output-stamp]"),
            original: bounds('[data-converter-original="true"]'),
            overflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
        assert.ok(geometry.input.bottom <= geometry.output.top, "input precedes the result");
        if (geometry.original.visible) {
          assert.ok(geometry.output.bottom <= geometry.original.top, "result precedes the original preview");
        } else {
          assert.equal(name, "png", "only PNG can hide its separate original preview at this width");
          await card.getByRole("button", { name: "Settings / Edit" }).press("Enter");
          const focused = page.locator('[data-focused-editor-workspace="true"]');
          const output = await focused.locator("[data-editor-output-preview]").boundingBox();
          const source = await focused.locator("[data-editor-original-preview]").boundingBox();
          assert.ok(output && source && output.y + output.height <= source.y, "focused result precedes original when the separate preview is hidden");
          await page.keyboard.press("Escape");
        }
        assert.ok(geometry.overflow <= 1);
        assert.deepEqual(errors, []);
        await card.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, `${browserName}-${name}-${width}.png`) });
        report.push({ browser: browserName, route, width, geometry });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
