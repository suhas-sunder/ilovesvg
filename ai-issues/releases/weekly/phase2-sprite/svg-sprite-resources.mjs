import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import ts from "typescript";

const cases = {
  "tiny-dashes": ["reject", /Dashed strokes/],
  "nested-transforms": ["reject", /combined SVG transform/],
  "reflected-gradient": ["paint", 9000],
  "shared-dense-gradient": ["paint", 9000],
  "many-solid-curves": ["paint", 900],
};
if (!process.env.SPRITE_STRESS_CASE) {
  for (const engine of (process.env.SPRITE_BROWSERS || "chromium,webkit").split(",")) {
    for (const name of Object.keys(cases)) {
      const child = spawnSync(process.execPath, [import.meta.filename], {
        env: { ...process.env, SPRITE_STRESS_ENGINE: engine, SPRITE_STRESS_CASE: name },
        stdio: "inherit",
        timeout: 10000,
        killSignal: "SIGKILL",
      });
      assert.ifError(child.error);
      assert.equal(child.status, 0, `${engine} ${name}`);
    }
  }
} else {
  const engine = process.env.SPRITE_STRESS_ENGINE;
  const name = process.env.SPRITE_STRESS_CASE;
  const playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : "playwright");
  const source = await readFile(new URL("../../../../app/client/lib/converter/svgSprite.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  const server = createServer((request, response) => {
    if (request.url === "/module.js") {
      response.writeHead(200, { "content-type": "text/javascript;charset=utf-8" });
      response.end(outputText);
    } else {
      response.writeHead(200, { "content-type": "text/html;charset=utf-8" });
      response.end("<!doctype html><title>SVG sprite resource test</title>");
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await playwright[engine].launch();
  try {
    const page = await browser.newPage();
    await page.route(/^https?:/, route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await page.goto(base);
    const result = await page.evaluate(async name => {
      const { buildSvgSprite } = await import("/module.js");
      const wrap = inner => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 24 24">${inner}</svg>`;
      const rect = '<rect x="-12" y="-12" width="24" height="24" fill="url(#g)"/>';
      const gradient = (attributes, stops) => `<defs><linearGradient id="g" ${attributes}>${stops}</linearGradient></defs>`;
      const inputs = {
        "tiny-dashes": '<path d="M-12 0H12" stroke-width="1" stroke="red" stroke-dasharray="0.000025 0.000025"/>'.repeat(995),
        "nested-transforms": '<g transform="scale(10)">'.repeat(20) + '<rect width="6" height="6"/>' + '</g>'.repeat(20),
        "reflected-gradient": gradient('spreadMethod="reflect" x2="0.0000001%"', '<stop stop-color="red"/><stop offset="1" stop-color="blue"/>') + rect.repeat(995),
        "shared-dense-gradient": gradient("", Array.from({ length: 490 }, (_, i) => `<stop offset="${i/489}" stop-color="${i % 2 ? "red" : "blue"}"/>`).join("")) + rect.repeat(505),
        "many-solid-curves": '<path d="M0 0' + 'C24 24 -24 24 0 0C-24 -24 24 -24 0 0'.repeat(2800) + '" stroke="red" stroke-width="1" fill="none"/>',
      };
      let output;
      const start = performance.now();
      try {
        output = buildSvgSprite([{ name: "resource-test.svg", text: wrap(inputs[name]) }]);
      } catch (error) {
        return { error: error.message, parseMs: Math.round(performance.now() - start) };
      }
      const parseMs = Math.round(performance.now() - start);
      const renderStart = performance.now();
      const img = new Image();
      const url = URL.createObjectURL(new Blob([output.icons[0].preview], { type: "image/svg+xml" }));
      try {
        img.src = url;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 96;
        canvas.height = 96;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const pixels = ctx.getImageData(0, 0, 96, 96).data;
        return {
          parseMs,
          previewMs: Math.round(performance.now() - renderStart),
          alpha: pixels.filter((value, i) => i % 4 === 3 && value > 0).length,
        };
      } finally {
        URL.revokeObjectURL(url);
      }
    }, name);
    const [kind, expected] = cases[name];
    if (kind === "reject") assert.match(result.error, expected);
    else assert.ok(result.alpha >= expected, JSON.stringify(result));
    console.log(JSON.stringify({ engine, name, ...result }));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
