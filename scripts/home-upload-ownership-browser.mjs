import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const base = new URL(process.env.BASE_URL || "http://127.0.0.1:5184");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname));
const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const engine = process.env.OWNERSHIP_BROWSER || "chromium";
const browser = await pw[engine].launch();
const evidence = path.resolve(process.env.OWNERSHIP_OUT || `tmp/phase1-evidence/home-upload-ownership-${engine}`);
await mkdir(evidence, { recursive: true });

const first = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><path d="M20 20H90V100H20Z"/></svg>')).png().toBuffer();
const replacement = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="90" height="70"><circle cx="40" cy="34" r="25"/></svg>')).png().toBuffer();
const tooSmall = await sharp({ create: { width: 1, height: 1, channels: 3, background: "black" } }).png().toBuffer();

const input = page => page.getByRole("group", { name: "Image input", exact: true });
const outputs = page => page.locator("[data-output-stamp]");
const remove = page => page.getByRole("button", { name: "Remove selected file", exact: true }).click();
const manualConvert = page => input(page).getByRole("button", { name: /Convert to SVG/ });
const download = page => outputs(page).first().getByRole("button", { name: "Download SVG", exact: true });
const chooseReplacement = async page => {
  const picker = page.getByLabel("Replace selected image", { exact: true });
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), picker.click()]);
  await chooser.setFiles({ name: "same-name.png", mimeType: "image/png", buffer: replacement });
};
const paste = async (page, bytes, padding = 0) => {
  const handled = await input(page).evaluate((panel, { bytes, padding }) => {
    panel.focus();
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array(bytes), new Uint8Array(padding)], "same-name.png", { type: "image/png" }));
    const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data });
    panel.dispatchEvent(event);
    return event.defaultPrevented;
  }, { bytes: Array.from(bytes), padding });
  assert.equal(handled, true, "Home must receive the scoped paste event");
};
const confirm = page => page.getByRole("button", { name: "Convert pasted image", exact: true }).click();
const hold = (page, kind, id) => page.evaluate(({ kind, id }) => window.ownershipTest.queue[kind].push(id), { kind, id });
const blocked = (page, id) => page.waitForFunction(id => Boolean(window.ownershipTest.release[id]), id);
const release = (page, id, bitmapSize) => page.evaluate(
  ({ id, bitmapSize }) => window.ownershipTest.release[id](bitmapSize), { id, bitmapSize },
);
const settle = page => page.waitForTimeout(1850); // Longer than both upload auto-submit delays.
const assertIdle = async (page, state) => {
  await settle(page);
  assert.equal(await outputs(page).count(), 0, "stale work must not create an output");
  assert.equal(state.posts, 0, "stale work must not POST for conversion");
};

async function runCase(name, run) {
  const requested = process.env.OWNERSHIP_CASES?.split(",");
  if (requested && !requested.includes(name)) return null;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const state = { posts: 0, errors: [] };
  await context.route("**/*", route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  await context.addInitScript(() => {
    const test = window.ownershipTest = { queue: { bitmap: [], digest: [] }, release: {} };
    function intercept(target, method, kind, matches) {
      const original = target[method].bind(target);
      target[method] = (...args) => {
        const id = matches(...args) ? test.queue[kind].shift() : undefined;
        if (!id) return original(...args);
        return new Promise((resolve, reject) => {
          test.release[id] = bitmapSize => {
            delete test.release[id];
            if (kind === "bitmap" && bitmapSize) {
              resolve({ ...bitmapSize, close() {} });
              return;
            }
            void original(...args).then(resolve, reject);
          };
        });
      };
    }
    intercept(window, "createImageBitmap", "bitmap", source => source instanceof File && source.name === "same-name.png");
    intercept(crypto.subtle, "digest", "digest", () => true);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on("request", request => {
    const url = new URL(request.url());
    if (request.method() === "POST" && url.origin === base.origin && url.searchParams.has("index")) state.posts++;
  });
  page.on("pageerror", error => state.errors.push(error.message));
  try {
    await page.goto(base.href, { waitUntil: "networkidle" });
    await input(page).waitFor();
    // A real interaction proves React is ready before dispatching synthetic paste.
    await input(page).getByRole("button", { name: /Show \d+ more presets/ }).click();
    await input(page).getByRole("button", { name: "Show fewer presets", exact: true }).click();
    await run(page, state);
    assert.deepEqual(state.errors, []);
    return { name, passed: true, posts: state.posts };
  } catch (error) {
    return { name, passed: false, posts: state.posts, failure: String(error) };
  } finally {
    await context.close();
  }
}

const cases = [
  ["remove-during-measurement", async (page, state) => {
    await hold(page, "bitmap", "first");
    await paste(page, first);
    await confirm(page);
    await blocked(page, "first");
    await remove(page);
    await release(page, "first");
    await assertIdle(page, state);
  }],
  ["replace-during-measurement", async (page, state) => {
    await hold(page, "bitmap", "first");
    await paste(page, first);
    await confirm(page);
    await blocked(page, "first");
    await hold(page, "bitmap", "replacement");
    await chooseReplacement(page);
    await blocked(page, "replacement");
    await release(page, "first");
    await assertIdle(page, state);
    await release(page, "replacement");
    await download(page).waitFor({ timeout: 20000 });
    assert.equal(await outputs(page).count(), 1);
    await input(page).getByText("90×70", { exact: true }).waitFor();
  }],
  ["navigate-during-measurement", async (page, state) => {
    await hold(page, "bitmap", "first");
    await paste(page, first);
    await confirm(page);
    await blocked(page, "first");
    await page.getByRole("navigation", { name: "Footer", exact: true }).getByRole("link", { name: "How it works", exact: true }).click();
    await page.waitForURL(new URL("/how-it-works", base).href);
    await release(page, "first"); // Same document: route navigation unmounted Home.
    await assertIdle(page, state);
  }],
  ["remove-during-convert-validation", async (page, state) => {
    await hold(page, "bitmap", "upload");
    await paste(page, first);
    await confirm(page);
    await blocked(page, "upload");
    await hold(page, "bitmap", "submit");
    await manualConvert(page).click();
    await blocked(page, "submit");
    await remove(page);
    await release(page, "upload");
    await release(page, "submit");
    await assertIdle(page, state);
  }],
  ["remove-during-preset-validation", async (page, state) => {
    const preset = input(page).getByRole("button", { name: /^Logo - Clean shapes\./ }).first();
    await input(page).getByRole("button", { name: /Show \d+ more presets/ }).click();
    await input(page).getByRole("searchbox", { name: "Search presets", exact: true }).fill("clean shapes");
    await hold(page, "bitmap", "upload");
    await paste(page, first);
    await confirm(page);
    await blocked(page, "upload");
    await hold(page, "bitmap", "submit");
    await preset.click();
    await blocked(page, "submit");
    await remove(page);
    await release(page, "upload");
    await release(page, "submit");
    await assertIdle(page, state);
  }],
  ["replace-during-fingerprinting", async (page, state) => {
    await paste(page, first);
    await confirm(page);
    await input(page).getByText("160×120", { exact: true }).waitFor();
    await hold(page, "digest", "submit");
    await manualConvert(page).click();
    await blocked(page, "submit");
    await chooseReplacement(page);
    await download(page).waitFor({ timeout: 20000 });
    await input(page).getByText("90×70", { exact: true }).waitFor();
    assert.equal(await outputs(page).count(), 1);
    const currentStamp = await outputs(page).first().getAttribute("data-output-stamp");
    const posts = state.posts;
    await release(page, "submit");
    await settle(page);
    assert.equal(await outputs(page).count(), 1, "only the replacement may produce a result");
    assert.equal(await outputs(page).first().getAttribute("data-output-stamp"), currentStamp);
    assert.equal(state.posts, posts);
  }],
  ["replacement-uses-its-own-dimensions", async page => {
    await paste(page, tooSmall);
    await confirm(page);
    await input(page).getByRole("alert").filter({ hasText: "Image is too small" }).waitFor();
    await input(page).getByText("1×1", { exact: true }).waitFor();
    await chooseReplacement(page);
    await input(page).getByText("90×70", { exact: true }).waitFor();
    await download(page).waitFor({ timeout: 5500 });
    assert.equal(await input(page).getByRole("alert").count(), 0);
  }],
  ["dimension-limits", async (page, state) => {
    for (const bitmapSize of [{ width: 8001, height: 20 }, { width: 5500, height: 5500 }]) {
      await hold(page, "bitmap", "oversized");
      await paste(page, first);
      await confirm(page);
      await blocked(page, "oversized");
      await release(page, "oversized", bitmapSize);
      await input(page).getByRole("alert").filter({
        hasText: `Image too large: ${bitmapSize.width}×${bitmapSize.height}`,
      }).waitFor();
      assert.equal(await outputs(page).count(), 0);
      assert.equal(state.posts, 0);
      await remove(page);
    }
  }],
  ["large-paste-requires-manual-convert", async (page, state) => {
    await paste(page, first, 26 * 1024 * 1024);
    await input(page).getByRole("status").filter({ hasText: "then click Convert to SVG" }).waitFor();
    await page.screenshot({ path: path.join(evidence, "large-paste-confirmation.png") });
    await page.getByRole("button", { name: "Use pasted image", exact: true }).click();
    await input(page).getByText("160×120", { exact: true }).waitFor();
    assert.equal(await manualConvert(page).isEnabled(), true);
    await assertIdle(page, state);
  }],
];

try {
  const report = [];
  for (const [name, run] of cases) {
    const result = await runCase(name, run);
    if (!result) continue;
    report.push(result);
    console.log(JSON.stringify(result));
  }
  assert.ok(report.length, "At least one scenario must run.");
  await writeFile(path.join(evidence, "report.json"), JSON.stringify(report, null, 2));
  assert.equal(report.filter(result => !result.passed).length, 0, "Home upload ownership regressions");
} finally {
  await browser.close();
}
