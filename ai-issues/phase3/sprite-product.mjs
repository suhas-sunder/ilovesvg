import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const base = new URL(process.env.BASE_URL);
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname));
const playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : "playwright");
const out = resolve(process.env.SPRITE_OUT_DIR || "tmp/phase3/sprite/acceptance");
await mkdir(out, { recursive: true });
const svg = (body, attributes = 'viewBox="0 0 24 24"') =>
  '<svg xmlns="http://www.w3.org/2000/svg" ' + attributes + ">" + body + "</svg>";
const file = (name, text) => ({ name, mimeType: "image/svg+xml", buffer: Buffer.from(text) });
const rect = '<rect width="24" height="24" fill="#1098ad"/>';
const gradient = (id, kind, color) => '<' + kind + ' id="' + id + '"><stop stop-color="' + color + '"/><stop offset="1" stop-color="#fff"/></' + kind + '>';
const attacker = "https://phase3-attack.invalid/payload";
const outer = "M1 1 H23 V23 H1Z";
const validRing = outer + " M.6e1+.6e1H18.0V1.8e1H6Z";
const invalidPath = [
  ["missing fractional digits before another command", outer + " M6 6 H18 V18. H6Z"],
  ["repeated decimal point", outer + " M6 6 H18 V18 H6..1Z"],
  ["missing fractional digits at end", outer + " M6 6 H18 V18."],
  ["missing fractional digits before exponent", outer + " M6 6 H18 V1.e1 H6Z"],
  ["adjacent fullwidth sign", outer + " M6＋6 H18 V18 H6Z"],
  ["nonbreaking separator", outer + " M6\u00a06 H18 V18 H6Z"],
  ["non-ASCII command", outer + " M6 6ſ8 8 12 12Z"],
];
const ring = (path) => '<path fill="#1f51ff" fill-rule="evenodd" d="' + path + '"/>';
const fixtures = [
  file("Token.svg", svg(
    '<title>Red gradient &amp; inset</title><defs>' + gradient("shadow", "linearGradient", "#d00000") +
    '<linearGradient href="#shadow" id="with-space" x2="100%"/></defs>' +
    '<rect x="-9" y="-3" width="18" height="12" fill="url(#with-space)"/>' +
    '<rect x="-2" y="1" width="4" height="4" fill="#00602a"/>',
    'viewBox="-9 0 18 6" preserveAspectRatio="xMaxYMin meet"',
  )),
  file("Token.svg", svg(
    '<title>Blue &lt;/title&gt;&lt;img src=&quot;' + attacker + '&quot;&gt;</title><defs>' +
    gradient("shadow", "radialGradient", "#0000c0") + '</defs><circle cx="8" cy="8" r="7" fill="url(#shadow)"/>',
    'width="16px" height="16"',
  )),
  file("Token-2.svg", svg('<title>Contrast ring</title>' + ring(validRing))),
  file("🦜.svg", svg('<title>Wide solid</title><rect x="-1" y="-2" width="4" height="2" fill="#bd5c13"/>', 'viewBox="-1 -2 4 2" preserveAspectRatio="none"')),
];

function gradientChain(length) {
  const refs = Array.from({ length: length - 1 }, (_, index) =>
    '<linearGradient id="ref-' + index + '" href="#ref-' + (index + 1) + '"/>');
  return svg('<defs>' + refs.join("") + gradient("ref-" + (length - 1), "linearGradient", "#84004d") +
    '</defs><rect width="24" height="24" fill="url(#ref-0)"/>');
}
const rejected = [
  ...invalidPath.map(([name, path]) => [name, svg(ring(path)), /path or numeric list has invalid syntax/]),
  ["XML version lookalike", '<?xml version="1.1"?>' + svg(rect), /XML directives/],
  ["entity-encoded CSS protocol", svg('<rect width="24" height="24" fill="url(&#100;ata:image/svg+xml,%3Csvg%3E)"/>'), /local gradient/],
  ["escaped newline CSS URL", svg('<rect width="24" height="24" fill="u\\000072l(&quot;' + attacker + '&quot;)"/>'), /local gradient/],
  ["exporter metadata namespace", svg('<desc xml:lang="en">synthetic</desc>' + rect), /unsupported XML namespace/],
  ["duplicate root and gradient ID", svg('<defs>' + gradient("duplicate", "linearGradient", "red") + '</defs>' + rect, 'id="duplicate" viewBox="0 0 24 24"'), /unique tokens/],
  ["both gradient href namespaces", svg('<defs>' + gradient("g", "linearGradient", "red") + '<linearGradient id="ref" href="#g" xlink:href="#g"/></defs>' + rect,
    'viewBox="0 0 24 24" xmlns:xlink="http://www.w3.org/1999/xlink"'), /one local #id/],
  ["cross-file fragment", svg('<rect width="24" height="24" fill="url(#shadow)"/>'), /local reference is missing/],
  ["single unsupported unit", svg('<rect width="24em" height="24"/>'), /unsupported unit/],
  ["near-singular sheared scale", svg('<g transform="matrix(50000,50000,50000,50000.000001,0,0)">' + rect + '</g>'), /combined SVG transform/],
  ["infinite exponent in arc", svg('<path d="M2 2 A 1e999 2 0 0 1 3 3"/>'), /supported range/],
  ["masked hostile subtree", svg('<mask id="temporary"><image href="' + attacker + '"/></mask>' + rect), /Unsupported element/],
  ["inline-partial dash value", svg('<g stroke-dasharray="none/**/">' + rect + '</g>'), /Dashed strokes/],
  ["overlong gradient chain", gradientChain(13), /loops or is too long/],
  ["external entity and misleading comment", '<!-- benign -->\n<!DOCTYPE svg [<!ENTITY % ext SYSTEM "' + attacker + '">%ext;]>' + svg(rect), /document types/],
  ["embedded CDATA HTML", svg('<title><![CDATA[<img src="' + attacker + '">]]></title>' + rect), /CDATA/],
  ["forbidden numeric surrogate", svg('<title>&#xD800;</title>' + rect), /well-formed/],
];

async function pixels(buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, pixel: (x, y) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)] };
}

async function readDownload(page, link) {
  const event = page.waitForEvent("download");
  await link.click();
  const download = await event;
  assert.equal(download.suggestedFilename(), "sprite.svg");
  return readFile(await download.path(), "utf8");
}

let previousDownload;
for (const engine of (process.env.SPRITE_BROWSERS || "chromium,webkit").split(",")) {
  const browser = await playwright[engine].launch();
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 }, hasTouch: engine === "webkit", isMobile: engine === "webkit" });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const remoteUses = [];
  const writes = [];
  const unexpected = [];
  await context.route(/^https?:/, route => {
    const url = new URL(route.request().url());
    if (url.hostname === "phase3-attack.invalid") unexpected.push(url.href);
    return url.origin === base.origin ? route.continue() : route.abort();
  });
  page.on("request", request => {
    if (!/^(GET|HEAD)$/.test(request.method()) && new URL(request.url()).origin === base.origin) writes.push(request.url());
  });
  try {
    const response = await page.goto(new URL("/svg-sprite-generator", base).href, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    const picker = page.getByLabel("Select SVG icon files or drop them here");
    const download = page.getByRole("link", { name: "Download sprite.svg" });
    const checkbox = page.getByLabel("Decorative icon");
    const snippet = page.getByLabel("HTML snippet");
    const symbol = page.getByLabel("Symbol", { exact: true });

    // A ready batch is discarded if a new batch contains any of these malformed inputs.
    await picker.setInputFiles(fixtures[0]);
    await download.waitFor();
    for (const [name, text, error] of rejected) {
      await picker.setInputFiles([fixtures[0], file("phase3-rejected.svg", text)]);
      const message = page.locator("#sprite-error");
      await Promise.race([message.waitFor(), download.waitFor().then(() => assert.fail(name + " unexpectedly exported"))]);
      assert.match(await message.innerText(), /^File 2 \(phase3-rejected\.svg\)/, name);
      assert.match(await message.innerText(), error, name);
      assert.ok(await message.evaluate(node => node === document.activeElement), name);
      assert.equal(await download.count(), 0, name);
    }
    await picker.setInputFiles(file("gradient-depth-boundary.svg", gradientChain(12)));
    await download.waitFor();
    assert.match(await readDownload(page, download), /href="#ilovesvg-sprite-ref-1-12"/);

    await picker.setInputFiles(fixtures);
    await page.getByText(/4 symbols ready/).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll("main li img")].length === 4 &&
      [...document.querySelectorAll("main li img")].every(img => img.complete && img.naturalWidth === 96));
    const markup = await readDownload(page, download);
    if (previousDownload) assert.equal(markup, previousDownload, "the same selection exports identical bytes across engines");
    previousDownload = markup;
    assert.match(markup, /viewBox="-9 0 18 6"/);
    assert.match(markup, /viewBox="0 0 16 16"/);
    assert.match(markup, /href="#ilovesvg-sprite-ref-1-1"/);
    assert.match(markup, /fill="url\(#ilovesvg-sprite-ref-2-1\)"/);
    assert.doesNotMatch(markup, /<(?:image|img|style|script)(?:\s|>)/i);
    assert.match(markup, /&lt;img src=/);
    const markupField = page.getByLabel("Sprite markup", { exact: true });
    const copyMarkup = page.getByRole("button", { name: "Copy sprite markup" });
    await page.evaluate(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {value: () => Promise.reject(new Error("Test denied"))});
    });
    await copyMarkup.focus();
    await page.keyboard.press("Enter");
    await page.getByText(/Sprite markup selected/).waitFor();
    assert.equal(await markupField.inputValue(), markup);
    assert.ok(await markupField.evaluate(node => node === document.activeElement &&
      node.selectionStart === 0 && node.selectionEnd === node.value.length));

    const ids = await symbol.locator("option").evaluateAll(options => options.map(option => option.value));
    assert.deepEqual(ids, ["icon-token", "icon-token-2", "icon-token-2-2", "icon-svg"]);
    const snippets = [];
    for (const id of ids) {
      await symbol.selectOption(id);
      snippets.push(await snippet.inputValue());
    }
    assert.match(snippets[1], /aria-label="Blue &lt;\/title&gt;&lt;img src=&quot;/);
    await symbol.selectOption(ids[2]);
    await checkbox.focus();
    await page.keyboard.press("Space");
    const decorative = await snippet.inputValue();
    assert.match(decorative, /aria-hidden="true"/);
    assert.doesNotMatch(decorative, /aria-label|role=/);
    await page.getByRole("button", { name: "Copy HTML snippet" }).click();
    await page.getByText(/Snippet selected/).waitFor();
    assert.ok(await snippet.evaluate(node => node === document.activeElement &&
      node.selectionStart === 0 && node.selectionEnd === node.value.length));
    await page.locator("main").screenshot({ path: resolve(out, engine + "-390-ready.png") });

    // Put the actual downloaded bytes and actual textarea snippets in one fresh HTML document.
    const embed = await context.newPage();
    embed.on("request", request => { if (/^https?:/.test(request.url())) remoteUses.push(request.url()); });
    const caseLabel = (index, html) => '<div id="case-' + index + '" class="sample">' + html + '</div>';
    const style = '<style>body{margin:0;background:white}.sample>svg{width:96px;height:96px;display:block}</style>';
    const expectedRed = svg(
      '<defs>' + gradient("oracle", "linearGradient", "#d00000") + '</defs>' +
      '<rect x="-9" width="18" height="6" fill="url(#oracle)"/><rect x="-2" y="1" width="4" height="4" fill="#00602a"/>',
      'viewBox="-9 0 18 6" preserveAspectRatio="xMaxYMin meet"',
    );
    const expectedBlue = svg('<defs>' + gradient("oracleblue", "radialGradient", "#0000c0") + '</defs>' +
      '<circle cx="8" cy="8" r="7" fill="url(#oracleblue)"/>', 'viewBox="0 0 16 16"');
    await embed.setContent('<!doctype html><meta charset="utf-8">' + style + markup +
      [...snippets, decorative, snippets[0], expectedRed, expectedBlue].map((html, index) => caseLabel(index, html)).join(""));
    assert.equal(await embed.locator("symbol").count(), 4);
    const allIds = await embed.locator("body > svg [id]").evaluateAll(nodes => nodes.map(node => node.id));
    assert.equal(allIds.length, new Set(allIds).size);
    assert.equal(await embed.getByRole("img", { name: "Contrast ring" }).count(), 1);
    assert.equal(await embed.locator("img, script, image").count(), 0);
    const render = async index => pixels(await embed.locator("#case-" + index + " >svg").screenshot());
    const [red, blue, hole, wide, decoration, repeated, redOracle, blueOracle] = await Promise.all(
      Array.from({ length: 8 }, (_, index) => index).map(render),
    );
    const white = [255, 255, 255];
    assert.deepEqual(red.pixel(48, 16), [0, 96, 42]);
    assert.deepEqual(red.pixel(48, 40), white, "overhanging red rectangle is clipped at the bottom of the viewBox");
    assert.ok(red.pixel(8, 8)[1] < red.pixel(84, 8)[1], "inherited linear gradient progresses left-to-right");
    assert.ok(blue.pixel(48, 48)[0] < blue.pixel(80, 48)[0], "radial gradient retains the dark blue center");
    assert.deepEqual(hole.pixel(48, 48), white, "valid compact decimal and exponent path retains the hole");
    assert.deepEqual(hole.pixel(12, 48), [31, 81, 255]);
    assert.deepEqual(wide.pixel(48, 80), [189, 92, 19], "preserveAspectRatio=none fills the nonsquare output");
    assert.deepEqual(hole.data, decoration.data);
    const meanDelta = (actual, expected) => actual.reduce((sum, value, index) => sum + Math.abs(value - expected[index]), 0) / actual.length;
    const differences = [meanDelta(red.data, redOracle.data), meanDelta(blue.data, blueOracle.data)];
    const repeatedDifference = meanDelta(red.data, repeated.data);
    assert.ok(differences.every(delta => delta < 1) && repeatedDifference < 0.25, JSON.stringify({differences, repeatedDifference}));
    await embed.close();

    await page.getByRole("button", { name: "Remove icon-token-2", exact: true }).click();
    await page.getByText(/3 symbols ready/).waitFor();
    assert.equal(await page.getByRole("img", { name: /^Blue/ }).count(), 0);
    assert.ok(await picker.evaluate(node => node === document.activeElement));
    await page.getByRole("button", { name: "Clear selection" }).click();
    assert.ok(await picker.evaluate(node => node === document.activeElement));
    assert.equal(await download.count(), 0);
    await picker.setInputFiles(fixtures);
    await page.getByText(/4 symbols ready/).waitFor();
    assert.equal(await readDownload(page, download), markup);
    assert.equal(await checkbox.isChecked(), false);
    assert.deepEqual(unexpected, []);
    assert.deepEqual(remoteUses, []);
    assert.deepEqual(writes, []);
    console.log(JSON.stringify({ engine, browser: browser.version(), rejected: rejected.length, validChainLength: 12,
      symbols: ids, downloadedBytes: Buffer.byteLength(markup), sha256: createHash("sha256").update(markup).digest("hex"),
      gradientMeanChannelDeltas: differences, repeatedDifference,
      clippedPixel: red.pixel(48, 40), ringCenter: hole.pixel(48, 48), clipboardFallback: "PASS", deterministic: true, remoteUses: 0 }));
  } finally {
    await context.close();
    await browser.close();
  }
}
