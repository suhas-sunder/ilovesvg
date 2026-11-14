import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const base = new URL(process.env.BASE_URL || "http://127.0.0.1:5303");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname));
const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out = path.resolve(process.env.CONVERSION_OUT || "tmp/phase3/conversion-navigation");
await mkdir(out, { recursive: true });
const fixture = path.join(out, "navigation-fixture.png");
await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="100%" height="100%" fill="white"/><path d="M20 20H100V140H20z"/><circle cx="170" cy="80" r="45" fill="#b43010"/></svg>')).png().toFile(fixture);
const rows = [];

async function run(browser, browserName, route, stage) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  let posts = 0, releaseRequest;
  let markFallbackHeld;
  const fallbackHeld = new Promise(resolve => { markFallbackHeld = resolve; });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(stage => {
    window.__ILOVESVG_HYBRID_TRACE_DEBUG__ = [];
    const NativeWorker = window.Worker;
    const state = window.traceNavigationProbe = {
      constructed: 0, terminated: 0, fail: null, shim: typeof window.OffscreenCanvas === "undefined",
    };
    if (state.shim) window.OffscreenCanvas = class ProbeCanvasCapability {};
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        if (!String(args[0]).includes("vtracer.worker")) return;
        state.constructed++;
        this.postMessage = () => {
          state.fail = () => this.dispatchEvent(new ErrorEvent("error", { message: "Injected browser trace failure" }));
          if (stage === "fallback") queueMicrotask(state.fail);
        };
      }
      terminate() {
        state.terminated++;
        return super.terminate();
      }
    };
  }, stage);
  await context.route("**/*", async route => {
    const req = route.request();
    if (new URL(req.url()).origin !== base.origin) return route.abort();
    if (req.method() !== "POST") return route.continue();
    posts++;
    if (stage === "fallback") await new Promise(resolve => {
      releaseRequest = resolve;
      markFallbackHeld();
    });
    return route.abort().catch(() => {});
  });
  try {
    await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^Show \d+ more presets/ }).click();
    await page.getByRole("button", { name: /^Filled Layers - Separate Colors\./ }).first().click();
    await page.locator('input[type="file"]').first().setInputFiles(fixture);
    await page.waitForFunction(() => window.traceNavigationProbe.fail !== null);
    if (stage === "fallback") {
      const watchdog = AbortSignal.timeout(6000);
      await Promise.race([fallbackHeld, new Promise((_, reject) => watchdog.addEventListener("abort", () =>
        reject(new Error("No fallback request reached the local interception boundary.")), { once: true }))]);
      assert.equal(posts, 1, "fault injection reached one fallback before route exit");
    }
    await page.getByRole("navigation", { name: "Footer", exact: true }).getByRole("link", { name: "How it works", exact: true }).click();
    await page.waitForURL(new URL("/how-it-works", base).href);
    await page.locator('[data-converter-input="true"]').waitFor({ state: "detached" });
    await page.waitForFunction(() => window.traceNavigationProbe.terminated >= 1);
    await page.evaluate(() => window.traceNavigationProbe.fail());
    releaseRequest?.();
    await page.waitForTimeout(850);
    assert.equal(await page.locator("[data-output-stamp]").count(), 0);
    assert.equal(posts, stage === "fallback" ? 1 : 0);
    assert.deepEqual(errors, []);
    const shim = await page.evaluate(() => window.traceNavigationProbe.shim);
    return { browser: browserName, route, stage, posts, shim, passed: true };
  } catch (error) {
    const worker = await page.evaluate(() => ({
      started: window.traceNavigationProbe.constructed,
      terminated: window.traceNavigationProbe.terminated,
      held: window.traceNavigationProbe.fail !== null,
      debug: window.__ILOVESVG_HYBRID_TRACE_DEBUG__.map(({ stage, reason }) => ({ stage, reason })),
    }));
    return { browser: browserName, route, stage, posts, errors, worker, failure: error.message, passed: false };
  } finally {
    releaseRequest?.();
    await context.close();
  }
}

for (const browserName of (process.env.CONVERSION_BROWSERS || "chromium,webkit").split(",")) {
  const browser = await pw[browserName].launch();
  try {
    for (const route of ["/", "/png-to-svg-converter"]) {
      for (const stage of ["worker", "fallback"]) {
        const row = await run(browser, browserName, route, stage);
        rows.push(row);
        console.log(JSON.stringify(row));
      }
    }
  } finally {
    await browser.close();
  }
}
await writeFile(path.join(out, "report.json"), JSON.stringify(rows, null, 2) + "\n");
assert.deepEqual(rows.filter(row => !row.passed), []);
