import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const foundationSha = "78dda78994ea90e7b3a839725021bc316463434e";
const base = new URL(process.env.BASE_URL ?? "http://127.0.0.1:5280");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "Use a local production build of the pinned foundation");
const route = "/png-to-svg-converter";
const outputDir = fileURLToPath(new URL("../../../../public/examples/output-inspection/", import.meta.url));
const publicPath = "/examples/output-inspection/";
const evidenceDir = fileURLToPath(new URL("../../../../tmp/phase2/example-capture/", import.meta.url));
const photoUrl = "https://svs.gsfc.nasa.gov/vis/a030000/a030600/a030613/blue_marble_apollo_17_19721207_print.jpg";
const photoAttribution = {
  credit: "Earth Science and Remote Sensing Unit, NASA Johnson Space Center",
  sourcePage: "https://svs.gsfc.nasa.gov/30613/",
  sourceUrl: photoUrl,
  usageGuide: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
  preparation: "Resized to 384 × 384 and saved as a quality-87 JPEG with Sharp.",
};

const cases = [
  {
    id: "simple-logo",
    label: "Two-color logo",
    presetLabel: "Layered color SVG",
    width: 320,
    height: 240,
    art: `<path fill="#21375b" d="M47 160 116 53l33 52-36 55z M124 160l50-78 52 78z"/>
<circle fill="#e27636" cx="232" cy="77" r="24"/>`,
    observations: "The gap between the mountains remains visible, and the output shifts the navy fill toward teal. The visually simple mark still produces many subpaths.",
  },
  {
    id: "flat-illustration",
    label: "Flat-color sailboat",
    presetLabel: "Layered color SVG - More detail",
    width: 320,
    height: 240,
    art: `<rect x="28" y="25" width="264" height="190" rx="20" fill="#e4f3f0"/>
<circle cx="235" cy="75" r="26" fill="#f4bb54"/>
<path fill="#49a9a6" d="M28 165q45-26 91 0t89 0 84 0v30q0 20-20 20H48q-20 0-20-20z"/>
<path fill="#d95642" d="M150 51 76 143h74z M158 72v71h57z"/>
<path fill="#21375b" d="M71 154h152l-16 26H91z M150 143h8v12h-8z"/>`,
    observations: "The sail and hull remain recognizable. Compare the simplified wave boundary, the rounded hull edges, and the color shifts against the source.",
  },
  {
    id: "cut-mark",
    label: "Cut mark with a hole and a detached shape",
    presetLabel: "Lineart - Accurate (default)",
    width: 320,
    height: 240,
    art: `<path fill-rule="evenodd" d="M32 30h160v150H32z M62 60h100v90H62z"/>
<path d="M192 98h26V84h38v36h-38v-17h-26z"/>
<circle cx="278" cy="176" r="8"/>`,
    observations: "The open hole, narrow bridge, and detached disk remain visible. The source bridge is five pixels wide. Review how wide it will be at your finished cut size.",
  },
  {
    id: "transparent-icon",
    label: "Transparent icon",
    presetLabel: "Logo - Clean shapes",
    width: 240,
    height: 240,
    art: `<path fill="#252949" fill-rule="evenodd" d="M48 83a20 20 0 0 1 20-20h24l9-14h38l9 14h24a20 20 0 0 1 20 20v77a20 20 0 0 1-20 20H68a20 20 0 0 1-20-20z M120 89a33 33 0 1 0 0 66 33 33 0 0 0 0-66z"/>
<circle fill="#252949" cx="120" cy="122" r="17"/>`,
    observations: "The clear margins and the transparent ring survive tracing. The single-color preset changes the navy camera fill to black and rounds its corners slightly.",
  },
  {
    id: "fine-lettering",
    label: "Fine line lettering",
    presetLabel: "Lineart - Fine detail",
    width: 320,
    height: 180,
    art: `<path d="M36 105V52h32v5H42v18h21v5H42v25z M87 52h5v53h-5z M114 105V52h5l27 43V52h5v53h-5l-27-42v42z M174 52h32v5h-27v18h22v5h-22v20h27v5h-32z"/>
<path d="M36 117h171v2H36z M36 127h171v1H36z"/>
<path fill="#c8c8c8" d="M36 137h171v1H36z"/>
<circle cx="218" cy="103" r="1.4"/><circle cx="226" cy="103" r="0.6"/><circle cx="234" cy="103" r="0.4"/>`,
    observations: "The letters are constructed from original shapes. The thin rules become uneven, and the faintest line is difficult to see at the original size.",
  },
  {
    id: "blue-marble",
    label: "Apollo 17 Blue Marble photograph",
    presetLabel: "Layered color SVG - Fewer larger layers",
    width: 384,
    height: 384,
    observations: "The trace simplifies clouds and coastline into flat regions. Even with the Fewer larger layers preset, the SVG is substantially larger than the source JPEG.",
  },
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function makeSource(example) {
  const { width, height, art } = example;
  if (art) {
    const original = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${art}</svg>`);
    return { bytes: await sharp(original).png().toBuffer(), extension: "png", mime: "image/png" };
  }

  const response = await fetch(photoUrl, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, "NASA original should be available");
  const original = Buffer.from(await response.arrayBuffer());
  assert.ok(original.length < 1024 * 1024, "Unexpected NASA source size");
  const originalMetadata = await sharp(original).metadata();
  assert.equal(originalMetadata.format, "jpeg");
  assert.equal(originalMetadata.width, 1024);
  assert.equal(originalMetadata.height, 1024);
  const bytes = await sharp(original).resize(width, height).jpeg({ quality: 87 }).toBuffer();
  return {
    bytes,
    extension: "jpg",
    mime: "image/jpeg",
    attribution: { ...photoAttribution, originalSha256: sha256(original) },
  };
}

async function capture(page, example, source, tracedPath) {
  await page.addInitScript(() => {
    const append = FormData.prototype.append;
    window.traceExampleSettings = [];
    FormData.prototype.append = function (name, value, ...rest) {
      append.call(this, name, value, ...rest);
      if (name === "clientRunId" && /^png-to-svg-/.test(value)) {
        window.traceExampleSettings.push(
          Object.fromEntries(
            [...this.entries()].filter(([key, entry]) => key !== "clientRunId" && typeof entry === "string"),
          ),
        );
      }
    };
  });
  await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Show \d+ more presets/ }).click();
  await page.getByRole("button", { name: new RegExp(`^${example.presetLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`) }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByLabel("Click or drag a file", { exact: true }).click(),
  ]);
  await chooser.setFiles({
    name: `${example.id}.${source.extension}`,
    mimeType: source.mime,
    buffer: source.bytes,
  });
  const download = page.locator("[data-output-stamp]").first().getByRole("button", { name: "Download SVG", exact: true });
  await download.waitFor({ timeout: 45000 });
  await download.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(evidenceDir, `${example.id}-result.png`) });
  const [saved] = await Promise.all([page.waitForEvent("download"), download.click()]);
  await saved.saveAs(tracedPath);
  const settings = await page.evaluate(() => window.traceExampleSettings);
  assert.equal(settings.length, 1, `${example.id} should use one submitted trace`);
  assert.ok(settings[0].presetId, "The selected preset should be recorded");
  return settings[0];
}

async function inspect(page, svg) {
  return page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, "image/svg+xml");
    const root = doc.documentElement;
    if (root.localName !== "svg" || doc.querySelector("parsererror")) {
      throw new Error("The downloaded output is not a well-formed SVG");
    }
    const paths = [...root.querySelectorAll("path")];
    return {
      viewBox: root.getAttribute("viewBox"),
      paths: paths.length,
      subpaths: paths.reduce((count, path) => count + (path.getAttribute("d")?.match(/[Mm]/g)?.length ?? 0), 0),
      groups: root.querySelectorAll("g").length,
      images: root.querySelectorAll("image").length,
    };
  }, svg.toString("utf8"));
}

async function validatePreview(preview, example) {
  const { data, info } = await sharp(preview).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, example.width);
  assert.equal(info.height, example.height);
  const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
  if (example.id === "cut-mark") {
    assert.equal(alpha(100, 100), 0, "hole");
    assert.equal(alpha(44, 100), 255, "outer shape");
    assert.equal(alpha(205, 100), 255, "thin bridge");
    assert.equal(alpha(278, 176), 255, "detached disk");
  }
  if (example.id === "transparent-icon") {
    assert.equal(alpha(0, 0), 0, "transparent margin");
    assert.equal(alpha(143, 122), 0, "transparent ring");
    assert.equal(alpha(120, 122), 255, "opaque center");
  }
}

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright"
);
await Promise.all([
  mkdir(outputDir, { recursive: true }),
  mkdir(evidenceDir, { recursive: true }),
]);
const browser = await chromium.launch({
  executablePath: process.env.RASTER_CHROMIUM_EXECUTABLE,
});
const results = [];
try {
  for (const example of cases) {
    const source = await makeSource(example);
    const sourceName = `${example.id}-source.${source.extension}`;
    const tracedName = `${example.id}-traced.svg`;
    const previewName = `${example.id}-preview.png`;
    const tracedPath = join(evidenceDir, tracedName);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.route("**/*", (requestRoute) =>
      new URL(requestRoute.request().url()).origin === base.origin ? requestRoute.continue() : requestRoute.abort(),
    );
    const page = await context.newPage();
    try {
      const activeSettings = await capture(page, example, source, tracedPath);
      const output = await readFile(tracedPath);
      const geometry = await inspect(page, output);
      assert.equal(geometry.viewBox, `0 0 ${example.width} ${example.height}`);
      assert.ok(geometry.paths > 0);
      assert.equal(geometry.images, 0);
      const preview = await sharp(output).png().toBuffer();
      await validatePreview(preview, example);
      const result = {
        id: example.id,
        label: example.label,
        presetId: activeSettings.presetId,
        presetLabel: example.presetLabel,
        width: example.width,
        height: example.height,
        inputBytes: source.bytes.length,
        outputBytes: output.length,
        ...geometry,
        source: publicPath + sourceName,
        traced: publicPath + tracedName,
        preview: publicPath + previewName,
        sourceSha256: sha256(source.bytes),
        outputSha256: sha256(output),
        previewSha256: sha256(preview),
        activeSettings,
        observations: example.observations,
        ...(source.attribution ? { attribution: source.attribution } : {}),
      };
      await Promise.all([
        writeFile(join(outputDir, sourceName), source.bytes),
        writeFile(join(outputDir, tracedName), output),
        writeFile(join(outputDir, previewName), preview),
      ]);
      results.push(result);
      console.log(example.id, result.presetId, result.inputBytes, result.outputBytes, geometry);
    } finally {
      await context.close();
    }
  }
  const manifest = {
    foundationSha,
    route,
    browser: `Chromium ${browser.version()}`,
    previewRenderer: `Sharp ${sharp.versions.sharp}, libvips ${sharp.versions.vips}`,
    examples: results,
  };
  await writeFile(join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
} finally {
  await browser.close();
}
