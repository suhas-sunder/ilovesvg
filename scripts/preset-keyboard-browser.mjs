import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const base = new URL(getSmokeBaseUrl());
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname));
const { PLAYWRIGHT_MODULE, PRESET_BROWSER, PRESET_BROWSER_OUT } = process.env;
const playwright = await import(PLAYWRIGHT_MODULE ? pathToFileURL(PLAYWRIGHT_MODULE).href : "playwright");
const browserName = PRESET_BROWSER || "chromium";
const browser = await playwright[browserName].launch({
  executablePath: process.env[`RASTER_${browserName.toUpperCase()}_EXECUTABLE`] || undefined,
});
const out = path.resolve(PRESET_BROWSER_OUT || "tmp/preset-keyboard-browser");
await mkdir(out, { recursive: true });

async function assertFocus(locator) {
  assert.equal(await locator.evaluate((element) => document.activeElement === element), true);
}

try {
  for (const { route, width, name } of [
    { route: "/", width: 1280, name: "home-desktop" },
    { route: "/png-to-svg-converter", width: 390, name: "png-narrow" },
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    let posts = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).origin === base.origin) posts++;
    });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.origin === base.origin ? route.continue() : route.abort();
    });
    await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
    const show = page.getByRole("button", { name: /^Show \d+ more presets$/ });
    await page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(
      (button) => /^Show \d+ more presets$/.test(button.textContent.trim()) &&
        Object.keys(button).some((key) => key.startsWith("__reactProps$")),
    ));
    const initialPreset = await page.locator('button[aria-pressed="true"][aria-label]').first().getAttribute("aria-label");
    await show.click();
    const all = page.getByRole("tab", { name: "All presets" });
    const pinned = page.getByRole("tab", { name: "Pinned presets" });
    const search = page.getByRole("searchbox", { name: "Search presets" });
    await all.waitFor();
    await assertFocus(all);
    await all.press("ArrowRight");
    assert.equal(await all.getAttribute("aria-selected"), "false", `${name}: ArrowRight selects Pinned presets`);
    await assertFocus(pinned);
    assert.equal(await pinned.getAttribute("aria-selected"), "true");
    assert.equal(await all.getAttribute("tabindex"), "-1");
    const panel = page.getByRole("tabpanel", { name: "Pinned presets" });
    assert.equal(await panel.getAttribute("id"), await pinned.getAttribute("aria-controls"));
    await page.screenshot({ path: path.join(out, `${name}-arrow-right.png`), animations: "disabled" });
    await pinned.press("Tab");
    await assertFocus(search);

    await pinned.press("Home");
    await assertFocus(all);
    await all.press("End");
    await assertFocus(pinned);
    await pinned.press("ArrowLeft");
    await assertFocus(all);

    await search.fill("no-preset-should-match-3928");
    await page.getByRole("button", { name: "Clear preset search" }).press("Space");
    await assertFocus(search);
    assert.equal(await search.inputValue(), "");

    const speed = page.getByRole("combobox", { name: "Filter presets by speed" });
    await search.press("Tab");
    await assertFocus(speed);
    assert.equal(await speed.evaluate((element) => {
      const style = getComputedStyle(element);
      return element.matches(":focus-visible") && style.outlineStyle !== "none" &&
        parseFloat(style.outlineWidth) >= 2;
    }), true);
    await page.screenshot({ path: path.join(out, `${name}-speed-focus.png`) });
    await speed.selectOption("slow-speed");
    await page.getByRole("button", { name: "Clear filters" }).first().press("Space");
    await assertFocus(search);
    assert.equal(await speed.inputValue(), "all");

    const pin = page.getByRole("button", { name: "Pin preset", exact: true }).first();
    const description = await pin.getAttribute("aria-describedby");
    assert.ok(description, "Pin button names its preset in the description");
    assert.equal(await pin.evaluate((button) => {
      const label = document.getElementById(button.getAttribute("aria-describedby"));
      return Boolean(label?.textContent.trim() && button.parentElement.contains(label));
    }), true);
    await pin.press("Space");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("ilovesvg:pinned-presets:v1")).length), 1);
    await all.press("ArrowRight");
    const unpin = page.getByRole("button", { name: "Unpin preset", exact: true });
    await unpin.press("Space");
    await assertFocus(search);
    await page.getByText("No pinned presets yet.").waitFor();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("ilovesvg:pinned-presets:v1"))), []);

    await page.getByRole("button", { name: "Show fewer presets" }).press("Space");
    await assertFocus(show);
    assert.equal(await page.locator('button[aria-pressed="true"][aria-label]').first().getAttribute("aria-label"), initialPreset);
    assert.equal(posts, 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.close();
    console.log(`${browserName} ${name} preset keyboard controls passed`);
  }
} finally {
  await browser.close();
}
