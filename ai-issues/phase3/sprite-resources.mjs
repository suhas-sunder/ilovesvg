import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const fixtures = {
  "dense-batch": ["render", 6400],
  "near-limit-arcs": ["render", 350],
  "thin-reflected-paint": ["render", 9216],
  "node-batch-over-limit": ["reject", /complex together/],
  "geometry-batch-over-limit": ["reject", /complex together/],
  "per-file-at-limit": ["render", 9216],
  "per-file-over-limit": ["reject", /exceeds 128 KiB/],
  "full-batch-at-limit": ["render", 9216],
  "full-batch-over-limit": ["reject", /512 KiB in total/],
  "node-file-at-limit": ["render", 9216],
  "node-file-over-limit": ["reject", /too many SVG nodes/],
  "huge-nested-transforms": ["reject", /combined SVG transform/],
  "long-malformed-dashes": ["reject", /Dashed strokes/],
};
const timeout = 12000;
const [, , engine, fixtureName] = process.argv;

if (!fixtureName) {
  for (const browser of (process.env.SPRITE_BROWSERS || "chromium,webkit").split(",")) {
    for (const test of Object.keys(fixtures)) {
      const child = spawnSync(process.execPath, [import.meta.filename, browser, test], {
        timeout, killSignal: "SIGKILL", encoding: "utf8",
      });
      assert.ifError(child.error);
      assert.equal(child.status, 0, browser + " " + test + " " + child.stderr);
      process.stdout.write(child.stdout);
    }
  }
} else {
  const playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : "playwright");
  const source = await readFile(new URL("../../app/client/lib/converter/svgSprite.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  const server = createServer((request, response) => {
    const isModule = request.url === "/module.js";
    response.writeHead(200, { "content-type": isModule ? "text/javascript;charset=utf-8" : "text/html;charset=utf-8" });
    response.end(isModule ? outputText : "<!doctype html><title>Sprite resource probe</title>");
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const browser = await playwright[engine].launch();
  try {
    const page = await browser.newPage();
    await page.route(/^https?:/, route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin);
    const result = await page.evaluate(async fixtureName => {
      const { buildSvgSprite } = await import("/module.js");
      const wrap = inner => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' + inner + '</svg>';
      const rect = '<rect width="32" height="32"/>';
      const filledStar = () => {
        const d = Array.from({ length: 5000 }, (_, i) => {
          const angle = 2 * Math.PI * ((i * 1739) % 5000) / 5000;
          return (i ? "L" : "M") + (16 + 15 * Math.cos(angle)).toFixed(3) + " " + (16 + 15 * Math.sin(angle)).toFixed(3);
        }).join("") + "Z";
        return '<path d="' + d + '" fill-rule="evenodd"/>';
      };
      const denseArcs = '<path d="M1 16' + "a15 15 0 1 1 30 0a15 15 0 1 1 -30 0".repeat(2850) +
        '" stroke="#a12329" stroke-width="0.01" stroke-miterlimit="100000" fill="none"/>';
      const reflected = '<defs><radialGradient id="g" spreadMethod="reflect" cx="0.5000001" cy="0.5000001" fx="0.5" fy="0.5" r="0.00000001">' +
        '<stop stop-color="red"/><stop offset="1" stop-color="blue"/></radialGradient></defs>' +
        '<rect width="32" height="32" fill="url(#g)"/>'.repeat(990);
      const padded = bytes => {
        const overhead = wrap(rect + "<!---->").length;
        // Two-byte UTF-8 scalars exercise byte counts independently of JS string length.
        const pad = bytes - overhead;
        return wrap(rect + "<!--" + "é".repeat(Math.floor(pad / 2)) + "a".repeat(pad % 2) + "-->");
      };
      const cases = {
        "dense-batch": () => Array(3).fill(wrap(filledStar())),
        "near-limit-arcs": () => [wrap(denseArcs)],
        "thin-reflected-paint": () => [wrap(reflected)],
        "node-batch-over-limit": () => Array(5).fill(wrap(rect.repeat(850))),
        "geometry-batch-over-limit": () => Array(4).fill(wrap(filledStar())),
        "per-file-at-limit": () => [padded(128 * 1024)],
        "per-file-over-limit": () => [padded(128 * 1024 + 1)],
        "full-batch-at-limit": () => Array(4).fill(padded(128 * 1024)),
        "full-batch-over-limit": () => [...Array(4).fill(padded(128 * 1024)), wrap(rect)],
        "node-file-at-limit": () => [wrap(rect.repeat(999))],
        "node-file-over-limit": () => [wrap(rect.repeat(1000))],
        "huge-nested-transforms": () => [wrap('<g transform="translate(25000)"> '.repeat(5) + rect + '</g>'.repeat(5))],
        "long-malformed-dashes": () => [wrap('<path d="M0 0h32" stroke="black" stroke-dasharray="' + "1  ".repeat(110) + "1x" + '"/>')],
      };
      const sources = cases[fixtureName]().map((text, index) => ({ name: "resource-probe-" + index + ".svg", text }));
      const started = performance.now();
      let sprite;
      try {
        sprite = buildSvgSprite(sources);
      } catch (error) {
        return { error: error.message, parseMs: Math.round(performance.now() - started), fileIndex: error.fileIndex };
      }
      const renderStart = performance.now();
      const urls = sprite.icons.map(icon => URL.createObjectURL(new Blob([icon.preview], { type: "image/svg+xml" })));
      try {
        const alpha = await Promise.all(urls.map(async url => {
          const image = new Image();
          image.src = url;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = 96;
          canvas.height = 96;
          const painter = canvas.getContext("2d");
          painter.drawImage(image, 0, 0);
          const pixels = painter.getImageData(0, 0, 96, 96).data;
          return pixels.filter((value, i) => i % 4 === 3 && value > 0).length;
        }));
        return { parseMs: Math.round(renderStart - started), renderMs: Math.round(performance.now() - renderStart), alpha };
      } finally {
        for (const url of urls) URL.revokeObjectURL(url);
      }
    }, fixtureName);
    const [expectation, value] = fixtures[fixtureName];
    if (expectation === "reject") assert.match(result.error, value);
    else assert.ok(result.alpha?.every(alpha => alpha >= value), JSON.stringify(result));
    console.log(JSON.stringify({ engine, fixture: fixtureName, watchdogMs: timeout, ...result }));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
