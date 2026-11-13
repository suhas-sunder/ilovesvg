import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const base = new URL(getSmokeBaseUrl());
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname), "Use a local build");
const playwright = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
  : "playwright");
const browserName = process.env.FULLSCREEN_BROWSER || "chromium";
assert.ok(["chromium", "webkit"].includes(browserName));
const output = path.resolve(process.env.FULLSCREEN_OUT || `tmp/fullscreen-focus-${browserName}`);
await mkdir(output, { recursive: true });

const browser = await playwright[browserName].launch();
const panels = '[data-converter-input="true"], [data-converter-original="true"]';
const previewName = "Preview full screen";
const dialogName = "Full-screen output preview";

async function fixture(name, shape) {
  const filename = path.join(output, `${name}.png`);
  await writeFile(filename, await sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120">${shape}</svg>`,
  )).png().toBuffer());
  return filename;
}

async function choose(page, input, file) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), input.click()]);
  await chooser.setFiles(file);
}

async function waitForFocus(locator) {
  const element = await locator.elementHandle();
  assert.ok(element, "Focus target exists");
  try {
    await locator.page().waitForFunction(node => node === document.activeElement, element);
  } finally {
    await element.dispose();
  }
}

try {
  const firstFile = await fixture("rectangle", '<path d="M20 20H90V100H20Z"/>');
  const secondFile = await fixture("circle", '<circle cx="80" cy="60" r="38"/>');
  for (const { route, name, width } of [
    { route: "/", name: "home", width: 320 },
    { route: "/png-to-svg-converter", name: "png", width: 390 },
  ]) {
    const context = await browser.newContext({
      ...(browserName === "webkit" ? playwright.devices["iPhone 13"] : {}),
      viewport: { width, height: 844 },
      reducedMotion: "reduce",
    });
    try {
      await context.route("**/*", request => new URL(request.request().url()).origin === base.origin
        ? request.continue()
        : request.abort());
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
      await page.waitForFunction(() => Object.keys(document.querySelector('input[type="file"]') || {})
        .some(key => key.startsWith("__reactProps$")));

      const cards = page.locator("[data-output-stamp]");
      const edit = page.getByRole("button", { name: "Settings / Edit" }).first();
      await choose(page, page.getByLabel("Click or drag a file", { exact: true }).first(), firstFile);
      await edit.waitFor({ timeout: 60000 });
      const firstStamp = await cards.first().getAttribute("data-output-stamp");
      await choose(page, page.getByLabel("Replace selected image", { exact: true }), secondFile);
      const latestCard = page.locator(`[data-output-stamp]:not([data-output-stamp="${firstStamp}"])`).first();
      const latestEdit = latestCard.getByRole("button", { name: "Settings / Edit" });
      await latestEdit.waitFor({ timeout: 60000 });
      await latestEdit.press("Enter");
      const done = page.getByRole("button", { name: "Done editing", exact: true });
      await done.waitFor();

      const hiddenPanels = await page.locator(panels).evaluateAll(elements => elements.map(panel => {
        const focusable = [panel, ...panel.querySelectorAll('button:enabled, input:enabled, select:enabled, textarea:enabled, a[href], [tabindex]')];
        const escaped = focusable.some(element => {
          element.focus({ preventScroll: true });
          return panel.contains(document.activeElement);
        });
        return { visibility: getComputedStyle(panel).visibility, escaped };
      }));
      assert.deepEqual(hiddenPanels, [
        { visibility: "hidden", escaped: false },
        { visibility: "hidden", escaped: false },
      ], `${name}: neither hidden panel nor its descendants can gain focus`);

      const trigger = page.locator('[data-focused-editor-workspace="true"]')
        .getByRole("button", { name: previewName, exact: true });
      const beforeOverflow = await page.evaluate(() => document.body.style.overflow);
      await trigger.press("Enter");
      const dialog = page.getByRole("dialog", { name: dialogName, exact: true });
      await waitForFocus(dialog);
      assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
      const image = dialog.locator("img");
      const label = await image.getAttribute("alt");
      const initialSource = await image.getAttribute("src");
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(previous => document.querySelector('[aria-label="Full-screen output preview"] img')
        ?.getAttribute("alt") !== previous, label);
      assert.notEqual(await image.getAttribute("src"), initialSource, "ArrowRight shows the other output");
      await page.keyboard.press("ArrowLeft");
      await page.waitForFunction(previous => document.querySelector('[aria-label="Full-screen output preview"] img')
        ?.getAttribute("alt") === previous, label);
      assert.equal(await image.getAttribute("alt"), label);
      assert.equal(await image.getAttribute("src"), initialSource);

      for (const [key, button] of [
        ["Shift+Tab", "Close full-screen preview"], ["Tab", "Previous output"],
        ["Tab", "Next output"], ["Tab", "Close full-screen preview"],
        ["Tab", "Previous output"], ["Shift+Tab", "Close full-screen preview"],
      ]) {
        await page.keyboard.press(key);
        await waitForFocus(dialog.getByRole("button", { name: button, exact: true }));
      }
      const close = dialog.getByRole("button", { name: "Close full-screen preview", exact: true });
      const bounds = await close.boundingBox();
      assert.ok(bounds?.width >= 44 && bounds.height >= 44);
      await page.screenshot({ path: path.join(output, `${name}-${width}.png`), animations: "disabled" });

      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(await done.isVisible(), true, "First Escape only closes fullscreen");
      await waitForFocus(trigger);
      assert.equal(await page.evaluate(() => document.body.style.overflow), beforeOverflow);

      await trigger.click();
      await close.click();
      await waitForFocus(trigger);
      await page.keyboard.press("Escape");
      await done.waitFor({ state: "hidden" });
      await waitForFocus(latestEdit);
      assert.deepEqual(await page.locator(panels).evaluateAll(elements => elements
        .map(element => getComputedStyle(element).visibility)), ["visible", "visible"]);
      assert.deepEqual(errors, []);
      console.log(`${browserName} ${name} ${width}px: nested fullscreen focus, arrows, Tab, and Escape passed`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
