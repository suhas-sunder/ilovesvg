import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// Run with optional PLAYWRIGHT_MODULE and SPRITE_BROWSERS (default chromium,webkit).
// Set BASE_URL to the locally served app for the UI and actual-download checks.
const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const source = await readFile(new URL("../../../../app/client/lib/converter/svgSprite.ts", import.meta.url), "utf8");
const moduleCode = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

const namespace = 'xmlns="http://www.w3.org/2000/svg"';
const svg = (inner, attrs = 'viewBox="0 0 32 32"') => `<svg ${namespace} ${attrs}>${inner}</svg>`;
const art = '<path d="M0 0h32v32H0Z"/>';
const stops = (a, b) => `<stop offset="0" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/>`;
const localGradient = (id, a, b) => `<linearGradient id="${id}" x2="100%" y2="100%">${stops(a, b)}</linearGradient>`;
const sources = [
  { name: "Cafe.svg", text: `<?xml version="1.0" encoding="UTF-8"?>${svg(
    '<title>Sunrise &amp; sea</title><desc>Blue sky</desc>' +
    `<defs>${localGradient("__proto__", "#ffe066", "#e44d26")}<linearGradient id="constructor" xlink:href="#__proto__"/></defs>` +
    '<g transform="translate(2 -1)" fill="url(\'#constructor\')"><g transform="scale(1) rotate(0 3 4)"><path d="M-15-10h20v20h-20z"/><path fill="#164e63" d="M5-7a5 5 0 0110 0v10h-10z"/></g></g>',
    'xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-16 -12 32 24" role="img"',
  )}` },
  { name: "Café.svg", text: svg(
    `<defs>${localGradient("__proto__", "#77ffff", "#004488")}</defs>` +
    '<rect id="constructor" x="1" y="1" width="36" height="19" rx="3" fill="url(&quot;#__proto__&quot;)"/>' +
    '<circle cx="18" cy="10" r="6" fill="#004488" stroke="white" stroke-width="2" stroke-dasharray="none"/>',
    'width="38px" height="21" fill="#123456" aria-label="Ocean &lt; wave"',
  ) },
  { name: "outlined.svg", text: '<svg viewBox="0,0,32,32"><path d="M2 28 12 4l3 7L24 3l6 25Z" fill="rgb(17 93 114)" stroke="currentColor" stroke-width="2" /></svg>' },
];

const evil = "https://svg-sprite-attacker.invalid/asset";
const dash = (value) => svg(`<path d="M0 0h32" stroke="black" stroke-dasharray="${value}"/>`);
const tinyDashes = svg(
  '<path d="M0 12H24" stroke-width="1" stroke="red" stroke-dasharray="0.000025 0.000025"/>'.repeat(995),
  'viewBox="0 0 24 24"',
);
const rejects = [
  ["malformed XML", `<svg ${namespace} viewBox="0 0 32 32"><g></svg>`, /well-formed/],
  ["HTML root", "<html><svg/></html>", /well-formed/],
  ["wrong root namespace", '<svg xmlns="http://www.w3.org/1999/xhtml" viewBox="0 0 24 24"><path d="M0 0h24"/></svg>', /SVG namespace/],
  ["nested namespace", svg('<g xmlns="urn:foreign"><path d="M0 0h12"/></g>'), /Unsupported element/],
  ["namespace reset", svg('<g xmlns=""><path d="M0 0h12"/></g>'), /Unsupported element/],
  ["unknown namespace declaration", svg(art, 'viewBox="0 0 32 32" xmlns:x="urn:foreign"'), /unsupported XML namespace/],
  ["unexpected nested SVG", svg(svg(art)), /Unsupported element/],
  ["script", svg(`<script href="${evil}">window.untrustedScript = true</script>${art}`), /Unsupported element/],
  ["onload", svg(art, 'viewBox="0 0 32 32" onload="window.untrustedScript = true"'), /Unsupported attribute/],
  ["SMIL", svg(`<circle r="1"><set attributeName="fill" to="url(${evil})"/></circle>`), /Unsupported element/],
  ["foreignObject", svg(`<foreignObject><img xmlns="http://www.w3.org/1999/xhtml" src="${evil}"/></foreignObject>`), /Unsupported element/],
  ["XML stylesheet", `<?xml-stylesheet href="${evil}"?>${svg(art)}`, /XML directives/],
  ["inner processing instruction", svg(`<g><?xml-stylesheet href="${evil}"?>${art}</g>`), /XML directives/],
  ["external DTD", `<!DOCTYPE svg SYSTEM "${evil}">${svg(art)}`, /document types/],
  ["entity", `<!DOCTYPE svg [<!ENTITY steal SYSTEM "${evil}">]>${svg("<title>&steal;</title>" + art)}`, /entities/],
  ["unknown undeclared entity", svg("<title>&steal;</title>" + art), /well-formed/],
  ["CSS stylesheet", svg(`<style>@import url(${evil});</style>${art}`), /Unsupported element/],
  ["inline CSS", svg(`<rect width="32" height="32" style="fill:url(${evil})"/>`), /Unsupported attribute/],
  ["encoded external paint", svg(`<rect width="32" height="32" fill="u&#114;l(${evil})"/>`), /local gradient/],
  ["CSS escaped url", svg(`<rect width="32" height="32" fill="u\\72l(${evil})"/>`), /local gradient/],
  ["CSS comments inside url", svg(`<rect width="32" height="32" fill="url/**/(${evil})"/>`), /local gradient/],
  ["SVG use", svg(`<use href="${evil}#path"/>`), /Unsupported element/],
  ["embedded image", svg('<image href="data:image/png;base64,AA==" width="32" height="32"/>'), /Unsupported element/],
  ["clip path", svg('<defs><clipPath id="clip"><rect width="32" height="32"/></clipPath></defs>' + art), /Unsupported element/],
  ["remote gradient", svg(`<defs><linearGradient id="a" href="${evil}#gradient"/></defs>${art}`), /local #id/],
  ["external XML base", svg(art, `viewBox="0 0 32 32" xml:base="${evil}"`), /unsupported XML namespace/],
  ["duplicate internal ID", svg(`<defs>${localGradient("same", "red", "red")}${localGradient("same", "blue", "blue")}</defs>${art}`), /unique tokens/],
  ["missing paint target", svg('<rect width="32" height="32" fill="url(#absent)"/>'), /local reference is missing/],
  ["wrong paint target", svg('<rect id="a" width="32" height="32" fill="url(#a)"/>'), /wrong element/],
  ["cycle", svg('<defs><linearGradient id="a" href="#b"/><linearGradient id="b" href="#a"/></defs>' + art), /loops/],
  ["self-cycle", svg('<defs><linearGradient id="a" href="#a"/></defs>' + art), /loops/],
  ["wrong gradient inheritance target", svg('<defs><linearGradient id="a" href="#b"/><radialGradient id="b"><stop/></radialGradient></defs>' + art), /wrong element/],
  ["empty gradient", svg('<defs><linearGradient id="a"/></defs>' + art), /no color stops/],
  ["negative viewBox", svg(art, 'viewBox="0 0 -32 32"'), /width and height/],
  ["non-finite viewBox", svg(art, 'viewBox="0 0 1e300 32"'), /supported range/],
  ["incomplete viewBox", svg(art, 'viewBox="0 0 32"'), /four numbers/],
  ["missing viewBox and units", svg(art, 'width="100%" height="24"'), /unsupported unit/],
  ["missing shape", svg("<title>Just a title</title>"), /no supported shapes/],
  ["invalid path command", svg('<path d="M0 0 U12 12"/>'), /invalid syntax/],
  ["non-ASCII command case folding", svg('<path d="M1 1ſ7 7 14 14Z"/>'), /invalid syntax/],
  ["non-finite path", svg('<path d="M0 0 L1e999 12"/>'), /supported range/],
  ["invalid arc flag", svg('<path d="M0 0 A1 2 0 2 1 6 6"/>'), /arc flag/],
  ["invalid dash after repeated whitespace", dash(`${"1  ".repeat(31)}1x`), /Dashed strokes are unsupported/],
  ["tiny dashes renderer denial of service", tinyDashes, /Dashed strokes are unsupported/],
  ["inherited percentage dashes", svg(art, 'viewBox="0 0 32 32" stroke-dasharray="0.0001% 0.0001%"'), /Dashed strokes are unsupported/],
  ["dash offset", svg(`<g stroke-dashoffset="1">${art}</g>`), /Dashed strokes are unsupported/],
  ["explosive transform list", svg(`<g transform="${"scale(100000) ".repeat(8).trim()}">${art}</g>`), /combined SVG transform/],
  ["explosive nested transform", svg('<g transform="scale(8)">'.repeat(8) + art + "</g>".repeat(8)), /combined SVG transform/],
  ["huge composed translation", svg(`<g transform="translate(90000)"><g transform="translate(90000)">${art}</g></g>`), /combined SVG transform/],
  ["singular transform", svg(`<g transform="matrix(1 1 1 1 0 0)">${art}</g>`), /combined SVG transform/],
  ["explosive gradient transform", svg(`<defs><linearGradient gradientTransform="scale(500) scale(500)"><stop/></linearGradient></defs>${art}`), /combined SVG transform/],
  ["excessive nesting", svg("<g>".repeat(26) + art + "</g>".repeat(26)), /too deeply/],
  ["excessive node count", svg(art.repeat(1001)), /too many SVG nodes/],
  ["excessive path commands", svg(`<path d="M0 0${"l1 1".repeat(6001)}"/>`), /too many path segments/],
  ["excessive file bytes", svg(art + `<!--${"é".repeat(65536)}-->`), /exceeds 128 KiB/],
];

async function checkParser(page, parserBase) {
  await page.goto(parserBase);
  const unexpected = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && request.url() !== `${parserBase}module.js`) unexpected.push(request.url());
  });
  await page.route(/^https?:/, (route) => route.request().url() === `${parserBase}module.js` ? route.continue() : route.abort());
  const result = await page.evaluate(async ({ sources, rejectedCases }) => {
    const { buildSvgSprite, spriteUseSnippet } = await import("/module.js");
    const getPixels = async (markup, label, width = 96, height = 96) => {
      const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
      try {
        const image = new Image();
        image.src = url;
        try { await image.decode(); } catch (error) { throw new Error(`${label}: ${error}`); }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, width, height);
        return ctx.getImageData(0, 0, width, height).data;
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    const sprite = buildSvgSprite(sources);
    const comparisons = await Promise.all(sprite.icons.map(async (icon, index) => {
      const [preview, reference] = await Promise.all([
        getPixels(icon.preview, `preview ${index}`),
        // Give the original and the generated preview the same viewport.
        getPixels(sources[index].text.replace(/<svg([^>]*)>/, (_, attrs) => {
          const root = attrs.replace(/\s(?:width|height)="[^"]*"/g, "");
          const namespace = root.includes("xmlns=") ? "" : ' xmlns="http://www.w3.org/2000/svg"';
          const viewBox = root.includes("viewBox=") ? "" : ` viewBox="${icon.viewBox}"`;
          return `<svg${root}${namespace}${viewBox} width="96" height="96">`;
        }), `reference ${index}`),
      ]);
      return {
        alpha: preview.filter((v, i) => i % 4 === 3 && v > 0).length,
        meanChannelDifference: preview.reduce((total, value, i) => total + Math.abs(value - reference[i]), 0) / preview.length,
      };
    }));
    const rejected = rejectedCases.map((input) => {
      try {
        buildSvgSprite([sources[0], { name: "unsafe.svg", text: input }]);
        return null;
      } catch (error) {
        return [error.message, error.fileIndex];
      }
    });
    function refused(input) {
      try {
        buildSvgSprite(input);
        return "";
      } catch (error) { return error.message; }
    }
    return {
      markup: sprite.markup,
      icons: sprite.icons.map(({ id, viewBox, label }) => ({ id, viewBox, label })),
      repeated: buildSvgSprite(sources).markup,
      informative: spriteUseSnippet(sprite.icons[1], false),
      decorative: spriteUseSnippet(sprite.icons[1], true),
      comparisons,
      rejected,
      zero: refused([]),
      count: refused(Array(13).fill(sources[0])),
      batch: refused(Array(5).fill({ name: "big.svg", text: '<svg viewBox="0 0 1 1"><rect width="1" height="1"/><!--' + "a".repeat(115000) + "--></svg>" })),
      nodes: refused(Array(6).fill({ name: "complex.svg", text: '<svg viewBox="0 0 1 1">' + '<rect width="1" height="1"/>'.repeat(750) + '</svg>' })),
      geometry: refused(Array(4).fill({ name: "paths.svg", text: '<svg viewBox="0 0 1 1"><path d="M0 0' + 'l1 1'.repeat(5000) + '"/></svg>' })),
      scriptRan: Boolean(window.untrustedScript),
    };
  }, { sources, rejectedCases: rejects.map(([, input]) => input) });
  assert.deepEqual(unexpected, [], "private source did not initiate any HTTP requests");
  assert.equal(result.scriptRan, false);
  assert.equal(result.markup, result.repeated);
  assert.deepEqual(result.icons.map((icon) => icon.id), ["icon-cafe", "icon-cafe-2", "icon-outlined"]);
  assert.deepEqual(result.icons.map((icon) => icon.viewBox), ["-16 -12 32 24", "0 0 38 21", "0 0 32 32"]);
  assert.equal(result.icons[0].label, "Sunrise & sea");
  assert.match(result.informative, /role="img" aria-label="Ocean &lt; wave"/);
  assert.match(result.informative, /href="#icon-cafe-2"/);
  assert.match(result.decorative, /aria-hidden="true" focusable="false"/);
  assert.doesNotMatch(result.decorative, /aria-label/);
  assert.doesNotMatch(result.markup, /__proto__|constructor|xlink:/);
  assert.equal((result.markup.match(/fill="url\(#ilovesvg-sprite-ref-\d+-\d+\)"/g) || []).length, 2);
  assert.match(result.markup, /href="#ilovesvg-sprite-ref-1-1"/);
  for (const { alpha, meanChannelDifference } of result.comparisons) {
    assert.ok(alpha > 1000, "the actual assembled symbol rendered in image mode");
    assert.ok(meanChannelDifference < 1, `preview channel delta ${meanChannelDifference} against original`);
  }
  for (const [index, [name, , pattern]] of rejects.entries()) {
    assert.ok(result.rejected[index], name);
    assert.match(result.rejected[index][0], pattern, name);
    assert.equal(result.rejected[index][1], 1, name);
  }
  assert.match(result.zero, /1 to 12/);
  assert.match(result.count, /1 to 12/);
  assert.match(result.batch, /512 KiB/);
  assert.match(result.nodes, /too complex together/);
  assert.match(result.geometry, /too complex together/);
  return { comparisons: result.comparisons, rejectedCases: rejects.length + 4, markup: result.markup, informative: result.informative };
}

async function checkInlineUse(browser, parserResult) {
  const page = await browser.newPage();
  try {
    await page.setContent(`<!doctype html><meta charset="UTF-8"><title>Inline sprite test</title><style>body { margin: 0; background: white } svg[role="img"] { width: 96px; height: 96px; display: block }</style>${parserResult.markup}${parserResult.informative}`);
    const bounds = await page.locator("use").evaluate((use) => {
      const box = use.getBBox();
      return [box.x, box.y, box.width, box.height];
    });
    assert.deepEqual(bounds, [1, 1, 36, 19], "download symbol and gradients can render in HTML");
    const image = await page.getByRole("img", { name: "Ocean < wave" }).screenshot();
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const getPixel = (x, y) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
    const gradient = getPixel(19, 32);
    assert.ok(gradient[1] > 90 && gradient[2] > 150 && gradient[0] < 140, `inline gradient pixel: ${gradient}`);
    assert.deepEqual(getPixel(45, 47), [0, 68, 136]);
  } finally {
    await page.close();
  }
}

const filePayload = ({ name, text }) => ({ name, mimeType: "image/svg+xml", buffer: Buffer.from(text) });

async function checkUi(browser, browserName, base) {
  assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "UI checks only run against a local server");
  const context = await browser.newContext({
    viewport: browserName === "webkit" ? { width: 390, height: 844 } : { width: 1440, height: 950 },
    isMobile: browserName === "webkit",
    hasTouch: browserName === "webkit",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const privateRequests = [];
  let armed = false;
  page.on("request", (request) => {
    if (armed && (request.url().includes("svg-sprite-attacker.invalid") || request.method() !== "GET" || (request.postData() || "").includes("private-name"))) {
      privateRequests.push(request.url());
    }
  });
  await context.route(/^https?:/, (route) => {
    const url = new URL(route.request().url());
    return url.origin === base.origin ? route.continue() : route.abort();
  });
  const out = path.resolve(process.env.SPRITE_OUT_DIR || "tmp/svg-sprite-browser");
  await mkdir(out, { recursive: true });
  try {
    const response = await page.goto(new URL("/svg-sprite-generator", base).href, { waitUntil: "networkidle" });
    assert.ok(response.ok());
    const heading = page.getByRole("heading", { name: "SVG Sprite Generator", exact: true });
    await heading.waitFor();
    await page.screenshot({ path: path.join(out, `${browserName}-empty.png`), fullPage: true });
    const picker = page.getByLabel("Select SVG icon files or drop them here");
    const examples = page.getByRole("button", { name: "Try two examples" });
    const clear = page.getByRole("button", { name: "Clear selection" });
    const download = page.getByRole("link", { name: "Download sprite.svg" });
    const snippet = page.getByLabel("HTML snippet");
    const icons = page.locator('section[aria-labelledby="sprite-output"]').getByRole("img");
    await picker.focus();
    await page.keyboard.press("Tab");
    assert.ok(await examples.evaluate((element) => element === document.activeElement));
    await page.keyboard.press("Enter");
    await download.waitFor();
    await page.getByRole("img", { name: "Sunrise" }).waitFor();
    await page.getByRole("img", { name: "Mountains" }).waitFor();
    assert.match(await snippet.inputValue(), /aria-label="Sunrise"/);
    await page.getByLabel("Symbol", { exact: true }).selectOption("icon-mountains");
    await page.getByLabel("Decorative icon").check();
    assert.match(await snippet.inputValue(), /aria-hidden="true"/);
    assert.match(await snippet.inputValue(), /href="#icon-mountains"/);
    await page.getByRole("button", { name: "Copy HTML snippet" }).click();
    await page.getByText(/Snippet (?:copied|selected)/).waitFor();
    await page.getByRole("button", { name: "Copy sprite markup" }).click();
    await page.getByText(/Sprite markup (?:copied|selected)/).waitFor();
    await page.screenshot({ path: path.join(out, `${browserName}-ready.png`), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

    const exportEvent = page.waitForEvent("download");
    await download.click();
    const exported = await exportEvent;
    assert.equal(exported.suggestedFilename(), "sprite.svg");
    const exportedText = await readFile(await exported.path(), "utf8");
    if (!(await page.getByLabel("Sprite markup", { exact: true }).isVisible())) await page.getByText("Show sprite markup", { exact: true }).click();
    assert.equal(await page.getByLabel("Sprite markup", { exact: true }).inputValue(), exportedText);
    await writeFile(path.join(out, `${browserName}-examples.svg`), exportedText);
    const inspection = await page.evaluate((xml) => {
      const doc = new DOMParser().parseFromString(xml, "image/svg+xml");
      const symbols = [...doc.querySelectorAll("symbol")];
      return {
        errors: doc.querySelectorAll("parsererror").length,
        ids: symbols.map((symbol) => symbol.id),
        box: symbols.map((symbol) => symbol.getAttribute("viewBox")),
        refs: symbols.map((symbol) => symbol.querySelector("path").getAttribute("fill")),
      };
    }, exportedText);
    assert.deepEqual(inspection.ids, ["icon-sunrise", "icon-mountains"]);
    assert.deepEqual(inspection.box, ["-16 -16 32 32", "0 0 40 24"]);
    assert.notEqual(inspection.refs[0], inspection.refs[1]);
    assert.equal(inspection.errors, 0);

    await page.getByRole("button", { name: "Remove icon-sunrise" }).click();
    await page.getByText(/1 symbol ready/).waitFor();
    assert.equal(await page.getByRole("img", { name: "Sunrise" }).count(), 0);
    assert.ok(await picker.evaluate((element) => element === document.activeElement));
    await clear.click();
    await download.waitFor({ state: "hidden" });
    assert.ok(await picker.evaluate((element) => element === document.activeElement));

    armed = true;
    await picker.setInputFiles(filePayload({ name: "private-name.svg", text: svg(`<image href="${evil}"/>`) }));
    const error = page.getByText(/File 1 \(private-name\.svg\): Unsupported element/);
    await error.waitFor();
    assert.ok(await error.evaluate((element) => element === document.activeElement && element.closest(".ph-no-capture")));
    assert.equal(await download.count(), 0);
    await page.screenshot({ path: path.join(out, `${browserName}-error.png`), fullPage: true });
    await picker.setInputFiles({ name: "invalid.svg", mimeType: "image/svg+xml", buffer: Buffer.from([0xc3, 0x28]) });
    await page.getByText(/could not be read as UTF-8 SVG/).waitFor();
    await picker.setInputFiles(filePayload({ name: "large.svg", text: "x".repeat(128 * 1024 + 1) }));
    await page.getByText(/exceeds 128 KiB/).waitFor();
    await picker.setInputFiles(sources.map(filePayload));
    await page.getByText(/3 symbols ready/).waitFor();
    await download.waitFor();
    await icons.last().waitFor();
    assert.equal(await icons.count(), 3);
    const fixtureExport = page.waitForEvent("download");
    await download.click();
    const fixtureDownload = await fixtureExport;
    const markup = await readFile(await fixtureDownload.path(), "utf8");
    await writeFile(path.join(out, `${browserName}-fixtures.svg`), markup);
    await page.getByLabel("Symbol", { exact: true }).selectOption("icon-cafe-2");
    const informative = await snippet.inputValue();
    assert.deepEqual(privateRequests, []);
    assert.doesNotMatch(markup, /private-name/);
    return { markup, informative, out };
  } finally {
    await context.close();
  }
}

const parserServer = createServer((request, response) => {
  if (request.url === "/module.js") {
    response.writeHead(200, { "content-type": "text/javascript;charset=utf-8" });
    response.end(moduleCode);
  } else {
    response.writeHead(200, { "content-type": "text/html;charset=utf-8" });
    response.end("<!doctype html><title>SVG sprite parser test</title>");
  }
});
await new Promise((resolve) => parserServer.listen(0, "127.0.0.1", resolve));
try {
  const parserBase = `http://127.0.0.1:${parserServer.address().port}/`;
  for (const browserName of (process.env.SPRITE_BROWSERS || "chromium,webkit").split(",")) {
    const browser = await pw[browserName].launch();
    try {
      const parserPage = await browser.newPage();
      const { comparisons, rejectedCases, markup, informative } = await checkParser(parserPage, parserBase);
      await parserPage.close();
      const base = process.env.BASE_URL;
      const ui = base ? await checkUi(browser, browserName, new URL(base)) : null;
      if (ui) assert.equal(ui.markup, markup, "actual route download matches deterministic parser output");
      await checkInlineUse(browser, ui || { markup, informative });
      console.log(JSON.stringify({ browser: browserName, comparisons, rejectedCases, inlineEmbed: "PASS", routeUi: ui?.out || "skipped (set BASE_URL)" }));
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => parserServer.close(resolve));
}
