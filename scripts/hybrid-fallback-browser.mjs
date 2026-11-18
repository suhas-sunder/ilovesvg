import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
const playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const browserName = process.env.HYBRID_REGRESSION_BROWSER || "chromium";
const outDir = process.env.HYBRID_REGRESSION_BROWSER_DIR || path.join(os.tmpdir(), "ilovesvg-hybrid-regression-browser", browserName);
await fs.mkdir(outDir, { recursive: true });
const fixture = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="white"/><path d="M20 20H100V140H20z" fill="black"/><circle cx="170" cy="80" r="45" fill="#b43010"/></svg>')).png().toBuffer();
function turbo(payload) {
    const values = [];
    function add(value) {
        const index = values.length;
        values.push(null);
        if (Array.isArray(value))
            values[index] = value.map(add);
        else if (value && typeof value === "object")
            values[index] = Object.fromEntries(Object.entries(value).map(([key, item]) => [`_${add(key)}`, add(item)]));
        else
            values[index] = value;
        return index;
    }
    add({ data: payload });
    return JSON.stringify(values) + "\n";
}
const executablePath = process.env[`RASTER_${browserName.toUpperCase()}_EXECUTABLE`];
const browser = await playwright[browserName].launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const report = [];
async function run(width, scenario, routePath = process.env.HYBRID_REGRESSION_ROUTE || "/png-to-svg-converter") {
    const context = await browser.newContext({ viewport: { width, height: 900 }, ...(width === 390 ? { ...(browserName !== "firefox" ? { isMobile: true } : {}), hasTouch: true } : {}) });
    const page = await context.newPage();
    const errors = [];
    let posts = 0, release;
    page.on("pageerror", error => errors.push(error.message));
    // Isolate app workflows from unrelated external ad/analytics frames. This
    // changes test requests only and does not change the protected ad lifecycle.
    await page.route("**/*", route => new URL(route.request().url()).origin === new URL(baseUrl).origin
        ? route.continue() : route.abort());
    await page.addInitScript(() => {
        window.__ILOVESVG_HYBRID_TRACE_DEBUG__ = [];
        window.__ILOVESVG_FORCED_WORKER_FAILURES__ = 0;
        if (new URL(location.href).searchParams.has("force-worker-failure")) {
            const OriginalWorker = window.Worker;
            window.Worker = class extends OriginalWorker {
                constructor(url, options) {
                    if (String(url).includes("vtracer.worker")) {
                        window.__ILOVESVG_FORCED_WORKER_FAILURES__++;
                        throw new Error("Synthetic browser engine initialization failure");
                    }
                    super(url, options);
                }
            };
        }
    });
    await page.route("**/*.data?*", async (route) => {
        if (route.request().method() !== "POST")
            return route.continue();
        posts++;
        if (scenario === "network")
            return route.abort("failed");
        if (scenario === "proxy")
            return route.fulfill({ status: 502, contentType: "text/html", body: "<h1>Synthetic proxy failure</h1>" });
        if (scenario === "busy" || scenario === "permanent") {
            const payload = scenario === "busy"
                ? { error: "Synthetic server overload. Please wait and try again.", code: "BUSY", retryAfterMs: 1000 }
                : { error: "Synthetic unsupported image. Export a PNG or JPEG and try again.", code: "INVALID_FILE" };
            return route.fulfill({ status: scenario === "busy" ? 429 : 415, contentType: "text/x-script; charset=utf-8", headers: { "X-Remix-Response": "yes", "Retry-After": "1" }, body: turbo(payload) });
        }
        if (scenario === "cancel") {
            await new Promise(resolve => { release = resolve; });
            return route.fulfill({ status: 200, contentType: "text/x-script; charset=utf-8", headers: { "X-Remix-Response": "yes" }, body: turbo({ svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M0 0h20v20H0z"/></svg>', width: 20, height: 20, engineUsed: "potrace", layers: [] }) }).catch(() => { });
        }
        return route.continue();
    });
    try {
        await page.goto(`${baseUrl}${routePath}${["cancel", "worker-fallback"].includes(scenario) ? "?force-worker-failure=1" : ""}`);
        await page.waitForFunction(() => Object.keys(document.querySelector('input[type="file"]') || {})
            .some(key => key.startsWith("__reactProps$")));
        // Confirm hydration through an actual existing control before upload.
        await page.getByRole("button", { name: /^Show \d+ more presets/i }).click();
        await page.getByRole("button", { name: "Show fewer presets", exact: true }).waitFor();
        if (["cancel", "worker-fallback"].includes(scenario)) {
            await page.getByRole("button", { name: /^Filled Layers - Separate Colors\./ }).first().click();
        }
        else {
            await page.getByRole("button", { name: "Show fewer presets", exact: true }).click();
        }
        await page.locator('input[type="file"]').first().setInputFiles({ name: "synthetic-fixture.png", mimeType: "image/png", buffer: fixture });
        // Some WebKit automation builds attach in-memory files without a
        // change event. Dispatch only when the original file is still present;
        // the application's onPick clears it synchronously when consumed.
        if (browserName === "webkit") {
            await page.waitForTimeout(200);
            const input = page.locator('input[type="file"]').first();
            if (await input.count() && await input.evaluate(element => element.files?.length > 0))
                await input.dispatchEvent("change");
        }
        if (scenario === "network" || scenario === "proxy") {
            await page.getByRole("link", { name: "Back to the converter", exact: true }).waitFor();
            await page.waitForTimeout(1500);
            assert.equal(posts, 1, "network/proxy failure must not create a request loop");
        }
        else if (scenario === "busy" || scenario === "permanent") {
            await page.getByText(scenario === "busy" ? /Synthetic server overload/ : "Synthetic unsupported image. Export a PNG or JPEG and try again.", { exact: scenario !== "busy" }).first().waitFor();
            await page.waitForTimeout(3000);
            assert.equal(posts, 1, `${scenario}: no duplicate or delayed POST`);
            if (scenario === "busy")
                await page.getByText(/Wait at least 1s, then try converting again./).waitFor();
        }
        else if (scenario === "cancel") {
            await page.waitForFunction(() => window.__ILOVESVG_HYBRID_TRACE_DEBUG__.some(event => event.stage === "server-fallback-submit"));
            await page.getByRole("button", { name: "Cancel", exact: true }).first().click();
            release();
            await page.waitForTimeout(1500);
            assert.equal(await page.locator('[data-job-status="canceled"]').count(), 1);
            assert.equal(await page.locator('[data-engine-used="potrace"]').count(), 0, "late canceled server SVG must not become output");
            assert.equal(posts, 1);
        }
        else {
            await page.locator('[data-engine-used="potrace"]').first().waitFor({ timeout: 60000 });
            await page.waitForFunction(() => Array.from(document.querySelectorAll('[data-engine-used="potrace"] img')).some(image => image.complete && image.naturalWidth > 0));
            const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download SVG/i }).first().click()]);
            assert.match(download.suggestedFilename(), /\.svg$/);
            assert.equal(posts, 1, "supported fallback performs one real server conversion");
            if (scenario === "worker-fallback") {
                const forced = await page.evaluate(() => ({ count: window.__ILOVESVG_FORCED_WORKER_FAILURES__, capable: typeof Worker !== "undefined" && typeof createImageBitmap !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof WebAssembly !== "undefined" }));
                assert.equal(forced.count, forced.capable ? 1 : 0, "verify worker failure injection rather than accidentally selecting a server-first preset");
            }
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        assert.ok(overflow <= 2, `horizontal overflow ${overflow}px`);
        assert.deepEqual(errors, [], "no runtime/hydration errors");
        const screenshot = path.join(outDir, `${width}-${scenario}-${routePath.slice(1)}.png`);
        await page.screenshot({ path: screenshot, fullPage: false });
        const outputCards = await page.locator('[data-engine-used="potrace"]').count();
        if (routePath === "/image-to-svg-outline" && scenario === "success")
            assert.equal(outputCards, 1, "one outline submission creates one history output");
        report.push({ width, scenario, route: routePath, posts, outputCards, overflow, errors, screenshot, ok: true });
        console.log(`${width} ${scenario} ${routePath}: PASS (${posts} POST)`);
    }
    catch (error) {
        const screenshot = path.join(outDir, `${width}-${scenario}-${routePath.slice(1)}-FAILED.png`);
        await page.screenshot({ path: screenshot, fullPage: false });
        report.push({ width, scenario, route: routePath, posts, errors, screenshot, body: (await page.locator("body").innerText()).slice(0, 1800), ok: false, error: error.message });
        console.log(`${width} ${scenario}: FAIL ${error.message}`);
    }
    finally {
        release?.();
        await context.close();
    }
}
try {
    const widths = process.env.HYBRID_REGRESSION_WIDTHS
        ? process.env.HYBRID_REGRESSION_WIDTHS.split(",").map(Number)
        : browserName === "firefox" ? [1280] : [1280, 390];
    const scenarios = process.env.HYBRID_REGRESSION_SCENARIOS?.split(",")
        || ["success", "worker-fallback", "permanent", "busy", "cancel"];
    for (const width of widths) {
        for (const scenario of scenarios)
            await run(width, scenario);
        if (process.env.HYBRID_REGRESSION_INCLUDE_OUTLINE !== "0")
            await run(width, "success", "/image-to-svg-outline");
    }
}
finally {
    await browser.close();
}
await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
assert.equal(report.filter(item => !item.ok).length, 0, `See ${path.join(outDir, "report.json")}`);
