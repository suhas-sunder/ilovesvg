import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : "playwright");

const base = new URL(process.env.BASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname));
const engine = process.argv[2] || "chromium";
const browser = await ({ chromium, webkit })[engine].launch();
const context = await browser.newContext({ acceptDownloads: true, viewport: engine === "webkit" ? { width: 390, height: 844 } : { width: 1365, height: 900 }, isMobile: engine === "webkit", hasTouch: engine === "webkit" });
const page = await context.newPage();
const privateMarker = "PRIVATE_PROBE_B77FD2ED";
const actualMarker = "validicon-39de";
const privateRequests = [];
const appWrites = [];
page.on("request", request => {
  const url = new URL(request.url());
  if (!["https:", "http:"].includes(url.protocol)) return;
  const data = request.postData() || "";
  if ([request.url(), data].some(value => value.toLowerCase().includes(privateMarker.toLowerCase()) || value.includes(actualMarker))) privateRequests.push(request.url());
  if (url.origin === base.origin && request.method() !== "GET" && request.method() !== "HEAD") appWrites.push(request.url());
});
await context.route(/^https?:/, route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
await page.addInitScript(({ privateMarker }) => {
  const reads = [];
  const created = [];
  const revoked = [];
  window.reviewProbe = { reads, created, revoked };
  const { arrayBuffer } = File.prototype;
  const { createObjectURL, revokeObjectURL } = URL;
  URL.createObjectURL = function(blob) {
    const url = createObjectURL.call(URL, blob);
    if (blob.type.startsWith("image/svg+xml")) created.push(url);
    return url;
  };
  URL.revokeObjectURL = function(url) { revoked.push(url); return revokeObjectURL.call(URL, url); };
  File.prototype.arrayBuffer = function () {
    const name = this.name;
    reads.push(name);
    if (name.startsWith(privateMarker)) return new Promise((resolve, reject) => {
      window.reviewProbe.release = () => arrayBuffer.call(this).then(resolve, reject);
    });
    return arrayBuffer.call(this);
  };
  Object.defineProperty(navigator.clipboard, "writeText", {
    value: () => new Promise(resolve => { window.reviewProbe.finishCopy = resolve; }),
  });
}, { privateMarker });
const payload = (name, contents) => ({
  name,
  mimeType: "image/svg+xml",
  buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${contents}</svg>`),
});
const validContents = '<title>Valid gradient</title><defs><linearGradient id="g"><stop stop-color="#123456"/><stop offset="1" stop-color="#abc"/></linearGradient></defs><rect width="24" height="24" fill="url(#g)"/>';
const valid = payload(actualMarker + ".svg", validContents);
const stale = payload(privateMarker + ".svg", '<title>' + privateMarker + '</title><rect width="24" height="24"/>');
const secondStale = payload("unread-stale.svg", '<rect width="24" height="24"/>');
const external = payload(privateMarker.toLowerCase() + "-bad.svg", '<image href="https://sprite-private.invalid/' + privateMarker + '"/>');

const goto = async () => {
  const response = await page.goto(new URL("/svg-sprite-generator", base).href, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  await page.getByRole("heading", { name: "SVG Sprite Generator", exact: true }).waitFor();
};
const picker = page.getByLabel("Select SVG icon files or drop them here");
const download = page.getByRole("link", { name: "Download sprite.svg" });
const chooserPanel = page.locator("#sprite-input").locator("..");
const outputPanel = page.locator("#sprite-output").locator("..");
const clear = page.getByRole("button", { name: "Clear selection" });
const assertBalancedUrls = async (active) => {
  await page.waitForFunction((active) => {
    const {created, revoked} = window.reviewProbe;
    return created.filter(url => !revoked.includes(url)).length === active;
  }, active, { timeout: 2000 });
  const result = await page.evaluate(() => window.reviewProbe.created.map(url => window.reviewProbe.revoked.filter(candidate => candidate === url).length));
  assert.ok(result.every(count => count <= 1));
};
try {
  await goto();
  await picker.setInputFiles([stale, secondStale]);
  await page.getByText("Reading SVG files…").waitFor();
  assert.equal(await download.count(), 0);
  await clear.click();
  await page.evaluate(() => window.reviewProbe.release());
  await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(() => window.reviewProbe.reads), [stale.name]);
  assert.equal(await download.count(), 0);
  await assertBalancedUrls(0);

  await picker.setInputFiles([stale, secondStale]);
  await page.getByText("Reading SVG files…").waitFor();
  await picker.setInputFiles(valid);
  await download.waitFor();
  await page.getByRole("img", { name: "Valid gradient" }).waitFor();
  await page.evaluate(() => window.reviewProbe.release());
  await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(() => window.reviewProbe.reads), [stale.name, stale.name, valid.name]);
  assert.match(await page.getByLabel("HTML snippet").inputValue(), /#icon-validicon-39de/);
  assert.ok(await outputPanel.evaluate(el => el.closest(".ph-no-capture") && [...el.querySelectorAll("img,textarea,a,option")].every(child => child.closest(".ph-no-capture"))));
  assert.ok(await chooserPanel.evaluate(el => el.closest(".ph-no-capture")));
  await assertBalancedUrls(2);
  await page.getByRole("button", { name: "Copy HTML snippet" }).click();
  await page.waitForFunction(() => Boolean(window.reviewProbe.finishCopy));
  await page.getByRole("button", { name: "Try two examples" }).click();
  await page.getByRole("img", { name: "Sunrise" }).waitFor();
  await page.evaluate(() => window.reviewProbe.finishCopy());
  assert.equal(await page.getByText("Snippet copied.", { exact: true }).count(), 0);
  await assertBalancedUrls(3);
  await clear.click();
  await assertBalancedUrls(0);
  assert.equal(await download.count(), 0);

  // Synthetic drop uses the actual DragEvent/FileList; native chooser is tested above.
  await picker.evaluate((input, { name, xml }) => {
    const drop = input.parentElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([xml], name, {type:"image/svg+xml"}));
    assertDropPrevented(drop, dataTransfer);
    function assertDropPrevented(target, dataTransfer) {
      for (const type of ["dragover", "drop"]) {
        const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer });
        target.dispatchEvent(event);
        if (!event.defaultPrevented) throw new Error(type + " fell through");
      }
    }
  }, { name: valid.name, xml: valid.buffer.toString() });
  await download.waitFor();
  await assertBalancedUrls(2);

  await picker.setInputFiles(external);
  await page.locator("#sprite-error").waitFor();
  assert.equal(await download.count(), 0);
  assert.ok(await page.locator("#sprite-error").evaluate(el => el.closest(".ph-no-capture") && el === document.activeElement));
  await assertBalancedUrls(0);
  await picker.setInputFiles(valid);
  await download.waitFor();
  await assertBalancedUrls(2);
  await page.getByRole("link", { name: "SVG viewer", exact: true }).click();
  await page.waitForURL("**/svg-preview-viewer");
  await picker.waitFor({ state: "detached" });
  await assertBalancedUrls(0);

  await goto();
  await picker.setInputFiles([stale, secondStale]);
  await page.getByText("Reading SVG files…").waitFor();
  await picker.evaluate(input => {
    const observer = new MutationObserver(() => {
      if (input.isConnected) return;
      observer.disconnect();
      window.reviewProbe.release();
      window.reviewProbe.releasedAfterDetach = true;
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole("link", { name: "SVG viewer", exact: true }).click();
  await page.waitForURL("**/svg-preview-viewer");
  await picker.waitFor({ state: "detached" });
  await page.waitForFunction(() => window.reviewProbe.releasedAfterDetach);
  await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(() => window.reviewProbe.reads), [stale.name]);
  await assertBalancedUrls(0);

  assert.deepEqual(privateRequests, []);
  assert.deepEqual(appWrites, []);
  console.log(JSON.stringify({ engine, race: "PASS", objectUrls: "PASS", dragDrop: "PASS", navigation: "PASS", httpPayloadMarker: "PASS" }));
} finally {
  await context.close();
  await browser.close();
}
