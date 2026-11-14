import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

const base = new URL(process.env.BASE_URL);
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname));
const playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : "playwright");
const recorder = await readFile("node_modules/posthog-js/dist/lazy-recorder.js", "utf8");
const { version } = JSON.parse(await readFile("node_modules/posthog-js/package.json", "utf8"));
const outside = "OUTSIDE_REPLAY_4AE3F";
const privateMarkers = ["SyntheticPrivateFilenameRW54", "SyntheticPrivateTitleMO37", "syntheticInternalArtWQ28", "SyntheticPrivateErrorJR31"];
const config = {
  sessionRecording: {},
  autocapture_opt_out: false,
  hasFeatureFlags: false,
  featureFlags: {},
  featureFlagPayloads: {},
  supportedCompression: [],
};

function decodeTransport(buffer) {
  assert.ok(buffer?.length);
  const body = buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer).toString() : buffer.toString("utf8");
  const encoded = new URLSearchParams(body).get("data");
  const parsed = JSON.parse(encoded === null ? body : Buffer.from(encoded, "base64").toString("utf8"));
  return Array.isArray(parsed) ? parsed : [parsed];
}

function expandReplay(events) {
  const decode = (value) => JSON.parse(gunzipSync(Buffer.from(value, "latin1")).toString("utf8"));
  return events.map(event => {
    if (event.cv !== "2024-10") return event;
    if (event.type === 2) return { ...event, data: decode(event.data) };
    const data = { ...event.data };
    for (const key of ["texts", "attributes", "removes", "adds"]) {
      if (typeof data[key] === "string") data[key] = decode(data[key]);
    }
    return { ...event, data };
  });
}

for (const engine of (process.env.SPRITE_BROWSERS || "chromium,webkit").split(",")) {
  const browser = await playwright[engine].launch();
  const userAgent = engine === "chromium"
    ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
    : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15";
  const context = await browser.newContext({ userAgent });
  const page = await context.newPage();
  const queue = { autocapture: [], replay: [] };
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "*",
  };
  // Only the test browser uses a non-bot navigator. The actual app's SDK, recorder,
  // privacy defaults, transport and consent settings run unmodified.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "userAgentData", { get: () => undefined });
  });
  await context.route(/^https?:/, async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === base.origin) return route.continue();
    if (!url.hostname.endsWith(".posthog.com")) return route.abort();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === "/static/lazy-recorder.js") {
      return route.fulfill({ contentType: "application/javascript", body: recorder, headers: cors });
    }
    if (/\/config\.js$/.test(url.pathname)) {
      const token = url.pathname.split("/").at(-2);
      const body = "window._POSTHOG_REMOTE_CONFIG ||= {};window._POSTHOG_REMOTE_CONFIG[" +
        JSON.stringify(token) + "]={config:" + JSON.stringify(config) + "};";
      return route.fulfill({ contentType: "application/javascript", body, headers: cors });
    }
    const data = request.postDataBuffer();
    // A request without a body cannot carry private SVG data. The outside
    // controls below still require real posted payloads in both channels.
    if (data?.length && url.pathname === "/e/") queue.autocapture.push(data);
    if (data?.length && url.pathname === "/s/") queue.replay.push(data);
    return route.fulfill({ contentType: "application/json", json: config, headers: cors });
  });

  try {
    await page.goto(new URL("/svg-sprite-generator", base).href, { waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.__PosthogExtensions__?.initSessionRecording), { timeout: 8000 });
    const picker = page.getByLabel("Select SVG icon files or drop them here");
    const fileName = privateMarkers[0] + ".svg";
    await picker.setInputFiles({ name: fileName, mimeType: "image/svg+xml",
      buffer: Buffer.from('<svg viewBox="0 0 24 24"><title>' + privateMarkers[1] + '</title><desc>' +
        privateMarkers[2] + '</desc><rect width="24" height="24" fill="#a32515"/></svg>') });
    await page.getByRole("img", { name: privateMarkers[1] }).waitFor();
    await page.getByRole("button", { name: "Copy sprite markup" }).click();
    if (!(await page.getByLabel("Sprite markup", { exact: true }).isVisible())) {
      await page.getByText("Show sprite markup", { exact: true }).click();
    }
    assert.ok((await page.getByLabel("Sprite markup", { exact: true }).inputValue()).includes(privateMarkers[2]));
    await page.getByRole("button", { name: "Copy HTML snippet" }).click();
    assert.ok((await page.getByLabel("HTML snippet").inputValue()).includes(privateMarkers[1]));

    // Outside positive controls while private content is present in the same document.
    await page.evaluate(outside => {
      const control = document.createElement("button");
      control.id = outside;
      control.textContent = outside;
      document.querySelector("main header").append(control);
      window.__PosthogExtensions__.rrweb.record.takeFullSnapshot();
    }, outside);
    await page.getByRole("button", { name: outside }).click();
    await picker.setInputFiles({ name: privateMarkers[3] + ".svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg>") });
    await page.locator("#sprite-error").waitFor();
    assert.ok((await page.locator("#sprite-error").innerText()).includes(privateMarkers[3]));
    await page.evaluate(() => window.__PosthogExtensions__.rrweb.record.takeFullSnapshot());
    await page.getByRole("button", { name: outside }).click();
    await page.getByRole("button", { name: "Clear selection" }).click();

    const deadline = Date.now() + 12000;
    let captures, replay, controls;
    do {
      captures = queue.autocapture.flatMap(decodeTransport);
      replay = queue.replay.flatMap(decodeTransport).flatMap(message => expandReplay(message.properties.$snapshot_data));
      controls = [
        captures.filter(event => event.event === "$autocapture" && JSON.stringify(event).includes(outside)).length,
        replay.filter(event => event.type === 2 && JSON.stringify(event).includes(outside)).length,
      ];
      if (controls.every(count => count >= 2)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (Date.now() < deadline);

    assert.ok(controls.every(count => count >= 2), "outside clicks and snapshots must be present for both private UI states");
    assert.equal(captures.filter(event => event.event === "$autocapture").length, controls[0], "only outside click controls should autocapture");
    const traffic = JSON.stringify({ captures, replay }).toLowerCase();
    for (const marker of privateMarkers) assert.ok(!traffic.includes(marker.toLowerCase()), "intercepted analytics contained a private marker");
    assert.ok(!traffic.includes("blob:"), "a private preview or download blob URL was recorded");
    console.log(JSON.stringify({engine, posthog: version, analyticsEvents: captures.length, replayEvents: replay.length,
      outsideAutocapture: controls[0], outsideFullSnapshots: controls[1], privateMarkersExcluded: privateMarkers.length, blobUrlsExcluded: true}));
  } finally {
    await context.close();
    await browser.close();
  }
}
