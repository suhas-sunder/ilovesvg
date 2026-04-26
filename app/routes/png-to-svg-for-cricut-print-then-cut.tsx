import * as React from "react";
import type { Route } from "./+types/png-to-svg-for-cricut-print-then-cut";
import {
  json,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { useFetcher, type ActionFunctionArgs } from "react-router";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import { StickerMuleAffiliateCard } from "~/client/components/ads/StickerMuleAffiliateCard";

const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "PNG to SVG for Cricut Print Then Cut | Free Cut Outline Maker";
  const description =
    "Convert PNG and JPG artwork into a Cricut Print Then Cut SVG with the original printable image plus a smooth cut outline. Tune offset, background handling, threshold, and preview settings.";
  const canonical =
    "https://www.ilovesvg.com/png-to-svg-for-cricut-print-then-cut";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    {
      name: "keywords",
      content:
        "png to svg for cricut print then cut, cricut print then cut svg, png to cut outline cricut, sticker cut outline maker, cricut sticker svg, print then cut outline, png to svg with cut line",
    },
    { name: "robots", content: "index,follow" },

    { rel: "canonical", href: canonical },

    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
    { property: "og:site_name", content: "iLoveSVG" },

    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.VALUE_FROM_EXPRESS };
}

/* ========================
   Limits & constants
======================== */
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_MP = 30;
const MAX_SIDE = 8000;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 700;
const LIVE_MED_MS = 2200;

const MAX_PRINT_SIDE = 2600;
const MAX_TRACE_SIDE = 1600;
const DEFAULT_CUT_COLOR = "#ff007a";
const DEFAULT_BG = "#ffffff";

/* ========================
   Concurrency gate
======================== */
type ReleaseFn = () => void;
type Gate = {
  acquireOrQueue: () => Promise<ReleaseFn>;
  running: number;
  queued: number;
};

async function getGate(): Promise<Gate> {
  const g = globalThis as any;
  if (g.__iheartsvg_print_then_cut_gate) {
    return g.__iheartsvg_print_then_cut_gate as Gate;
  }

  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  let cpuCount = 1;
  try {
    const os = req("os") as typeof import("os");
    cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 1;
  } catch {}

  const MAX = Math.max(1, Math.min(2, cpuCount));
  const QUEUE_MAX = 6;
  const EST_JOB_MS = 5000;

  class SimpleGate implements Gate {
    max: number;
    queueMax: number;
    running = 0;
    queue: Array<(r: ReleaseFn) => void> = [];

    constructor(max: number, queueMax: number) {
      this.max = max;
      this.queueMax = queueMax;
    }

    get queued() {
      return this.queue.length;
    }

    private mkRelease(): ReleaseFn {
      let released = false;
      return () => {
        if (released) return;
        released = true;
        this.running = Math.max(0, this.running - 1);
        const next = this.queue.shift();
        if (next) {
          this.running++;
          next(this.mkRelease());
        }
      };
    }

    estimateRetryMs() {
      const waves = Math.ceil((this.queued + 1) / this.max);
      return Math.min(20000, Math.max(1500, waves * EST_JOB_MS));
    }

    acquireOrQueue(): Promise<ReleaseFn> {
      return new Promise((resolve, reject) => {
        if (this.running < this.max) {
          this.running++;
          resolve(this.mkRelease());
          return;
        }
        if (this.queue.length >= this.queueMax) {
          const err: any = new Error("Server busy");
          err.code = "BUSY";
          err.retryAfterMs = this.estimateRetryMs();
          reject(err);
          return;
        }
        this.queue.push((rel) => resolve(rel));
      });
    }
  }

  g.__iheartsvg_print_then_cut_gate = new SimpleGate(MAX, QUEUE_MAX);
  return g.__iheartsvg_print_then_cut_gate as Gate;
}

/* ========================
   Server action: printable image + traced cut outline
======================== */
type CutSource =
  | "auto"
  | "transparent"
  | "light-background"
  | "dark-artwork"
  | "edge";
type BackgroundMode = "transparent" | "white";

type PrintCutOptions = {
  cutSource: CutSource;
  backgroundMode: BackgroundMode;
  threshold: number;
  backgroundTolerance: number;
  alphaThreshold: number;
  outlinePadding: number;
  cutLineColor: string;
  cutLineWidth: number;
  turdSize: number;
  optTolerance: number;
  smoothMask: boolean;
  showCutLine: boolean;
};

type BuildResult = {
  svg: string;
  width: number;
  height: number;
  cutSourceUsed: CutSource;
  printableBytes: number;
};

export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method.toUpperCase() !== "POST") {
      return json(
        { error: "Method not allowed" },
        { status: 405, headers: { Allow: "POST" } },
      );
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data")) {
      return json(
        { error: "Unsupported content type. Use multipart/form-data." },
        { status: 415 },
      );
    }

    const contentLength = Number(request.headers.get("content-length") || "0");
    const MAX_OVERHEAD = 5 * 1024 * 1024;
    if (contentLength && contentLength > MAX_UPLOAD_BYTES + MAX_OVERHEAD) {
      return json(
        {
          error:
            "Upload too large for Print Then Cut conversion. Please resize and try again.",
        },
        { status: 413 },
      );
    }

    const uploadHandler = createMemoryUploadHandler({
      maxPartSize: MAX_UPLOAD_BYTES,
    });
    const form = await parseMultipartFormData(request, uploadHandler);

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return json({ error: "No file uploaded." }, { status: 400 });
    }

    const webFile = file as File;
    if (!ALLOWED_MIME.has(webFile.type)) {
      return json(
        { error: "Only PNG or JPEG images are allowed." },
        { status: 415 },
      );
    }
    if ((webFile.size || 0) > MAX_UPLOAD_BYTES) {
      return json(
        {
          error: `File too large. Max ${Math.round(
            MAX_UPLOAD_BYTES / (1024 * 1024),
          )} MB per image.`,
        },
        { status: 413 },
      );
    }

    const gate = await getGate();
    let release: ReleaseFn | null = null;

    try {
      release = await gate.acquireOrQueue();
    } catch (e: any) {
      const retryAfterMs = Math.max(1500, Number(e?.retryAfterMs) || 2500);
      return json(
        {
          error:
            "Server is busy creating Print Then Cut SVG files. Retrying automatically.",
          retryAfterMs,
          code: "BUSY",
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        },
      );
    }

    try {
      const ab = await webFile.arrayBuffer();
      // @ts-ignore Buffer exists in Remix node runtime
      const input: Buffer = Buffer.from(ab);

      const options: PrintCutOptions = {
        cutSource: normalizeCutSource(String(form.get("cutSource") ?? "auto")),
        backgroundMode: normalizeBackgroundMode(
          String(form.get("backgroundMode") ?? "transparent"),
        ),
        threshold: clampInt(Number(form.get("threshold") ?? 245), 0, 255),
        backgroundTolerance: clampInt(
          Number(form.get("backgroundTolerance") ?? 24),
          0,
          100,
        ),
        alphaThreshold: clampInt(
          Number(form.get("alphaThreshold") ?? 8),
          0,
          255,
        ),
        outlinePadding: clampInt(
          Number(form.get("outlinePadding") ?? 12),
          0,
          48,
        ),
        cutLineColor: safeHexColor(
          String(form.get("cutLineColor") ?? DEFAULT_CUT_COLOR),
          DEFAULT_CUT_COLOR,
        ),
        cutLineWidth: clampNumber(
          Number(form.get("cutLineWidth") ?? 2),
          0.25,
          12,
        ),
        turdSize: clampInt(Number(form.get("turdSize") ?? 6), 0, 40),
        optTolerance: clampNumber(
          Number(form.get("optTolerance") ?? 0.55),
          0.05,
          1.5,
        ),
        smoothMask:
          String(form.get("smoothMask") ?? "true").toLowerCase() === "true",
        showCutLine:
          String(form.get("showCutLine") ?? "true").toLowerCase() === "true",
      };

      const result = await buildPrintThenCutSvg(input, options);

      return json({
        svg: result.svg,
        width: result.width,
        height: result.height,
        cutSourceUsed: result.cutSourceUsed,
        printableBytes: result.printableBytes,
        gate: { running: gate.running, queued: gate.queued },
      });
    } finally {
      try {
        release?.();
      } catch {}
    }
  } catch (err: any) {
    return json(
      {
        error: err?.message || "Server error during Print Then Cut conversion.",
      },
      { status: 500 },
    );
  }
}

async function buildPrintThenCutSvg(
  input: Buffer,
  options: PrintCutOptions,
): Promise<BuildResult> {
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  const sharp = req("sharp") as typeof import("sharp");

  try {
    (sharp as any).concurrency?.(1);
    (sharp as any).cache?.({ files: 0, memory: 48 });
  } catch {}

  const meta = await sharp(input).rotate().metadata();
  const inputW = meta.width ?? 0;
  const inputH = meta.height ?? 0;
  if (!inputW || !inputH) {
    throw new Error("Could not read image dimensions. Try a different file.");
  }
  const mp = (inputW * inputH) / 1_000_000;
  if (inputW > MAX_SIDE || inputH > MAX_SIDE || mp > MAX_MP) {
    throw new Error(
      `Image too large: ${inputW}×${inputH} (~${mp.toFixed(
        1,
      )} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
    );
  }

  const printable = sharp(input)
    .rotate()
    .resize({
      width: MAX_PRINT_SIDE,
      height: MAX_PRINT_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png();

  const printableMeta = await printable.clone().metadata();
  const width = printableMeta.width ?? inputW;
  const height = printableMeta.height ?? inputH;
  const printablePng = await printable.toBuffer();

  const cutSourceUsed =
    options.cutSource === "auto"
      ? meta.hasAlpha
        ? "transparent"
        : "light-background"
      : options.cutSource;

  const traceScale = Math.min(1, MAX_TRACE_SIDE / Math.max(width, height));
  const traceW = Math.max(1, Math.round(width * traceScale));
  const traceH = Math.max(1, Math.round(height * traceScale));

  const tracePng = await sharp(printablePng)
    .resize({ width: traceW, height: traceH, fit: "fill" })
    .png()
    .toBuffer();

  let mask = await createCutMask(tracePng, {
    ...options,
    cutSource: cutSourceUsed,
  });

  if (options.smoothMask) {
    mask = await smoothBinaryMask(mask, traceW, traceH, sharp);
  }

  const paddingForTrace = Math.round(options.outlinePadding * traceScale);
  if (paddingForTrace > 0) {
    mask = await expandMask(mask, traceW, traceH, paddingForTrace, sharp);
  }

  const maskPng = await sharp(mask, {
    raw: { width: traceW, height: traceH, channels: 1 },
  })
    .png()
    .toBuffer();

  const potrace = await import("potrace");
  const traceFn: any = (potrace as any).trace;
  const PotraceClass: any = (potrace as any).Potrace;

  const rawSvg: string = await new Promise((resolve, reject) => {
    const opts: any = {
      color: "#000000",
      threshold: 128,
      turdSize: options.turdSize,
      optTolerance: options.optTolerance,
      turnPolicy: "majority",
      invert: false,
      blackOnWhite: true,
    };

    if (typeof traceFn === "function") {
      traceFn(maskPng, opts, (err: any, out: string) =>
        err ? reject(err) : resolve(out),
      );
    } else if (PotraceClass) {
      const p = new PotraceClass(opts);
      p.loadImage(maskPng, (err: any) => {
        if (err) return reject(err);
        p.setParameters(opts);
        p.getSVG((err2: any, out: string) =>
          err2 ? reject(err2) : resolve(out),
        );
      });
    } else {
      reject(new Error("potrace API not found"));
    }
  });

  const cutPaths = extractPathTags(rawSvg)
    .map((path) =>
      scaleAndStyleCutPath(path, width / traceW, height / traceH, options),
    )
    .join("\n    ");

  const imageHref = `data:image/png;base64,${printablePng.toString("base64")}`;
  const backgroundRect =
    options.backgroundMode === "white"
      ? `  <rect x="0" y="0" width="${width}" height="${height}" fill="${DEFAULT_BG}"/>\n`
      : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" role="img" aria-label="Cricut Print Then Cut SVG">
${backgroundRect}  <g id="printable-image" data-mode="print">
    <image href="${imageHref}" xlink:href="${imageHref}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none"/>
  </g>
  <g id="cut-outline" data-mode="cut" data-source="${escapeAttr(cutSourceUsed)}" data-offset-px="${options.outlinePadding}">
    ${options.showCutLine ? cutPaths : cutPaths.replace(/stroke-opacity="1"/g, 'stroke-opacity="0"')}
  </g>
</svg>`;

  return {
    svg,
    width,
    height,
    cutSourceUsed,
    printableBytes: printablePng.length,
  };
}

async function createCutMask(
  inputPng: Buffer,
  options: PrintCutOptions,
): Promise<Buffer> {
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  const sharp = req("sharp") as typeof import("sharp");

  const { data, info } = await sharp(inputPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width | 0;
  const H = info.height | 0;
  const out = Buffer.alloc(W * H, 255);
  const src = data as Buffer;

  if (options.cutSource === "transparent") {
    for (let i = 0, p = 0; i < src.length; i += 4, p++) {
      const a = src[i + 3];
      out[p] = a > options.alphaThreshold ? 0 : 255;
    }
    if (!isFlatOrEmptyMask(out)) return out;
  }

  if (options.cutSource === "dark-artwork") {
    for (let i = 0, p = 0; i < src.length; i += 4, p++) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      const a = src[i + 3] / 255;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
      out[p] = lum <= options.threshold ? 0 : 255;
    }
    return out;
  }

  if (options.cutSource === "edge") {
    return createEdgeMask(src, W, H, options);
  }

  // light-background default: non-white-ish pixels become the printable object.
  const tol = options.backgroundTolerance;
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    const a = src[i + 3];
    if (a <= options.alphaThreshold) {
      out[p] = 255;
      continue;
    }
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const distFromWhite = Math.max(255 - r, 255 - g, 255 - b);
    out[p] = distFromWhite >= tol ? 0 : 255;
  }

  if (isFlatOrEmptyMask(out)) {
    for (let i = 0, p = 0; i < src.length; i += 4, p++) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      out[p] = lum <= options.threshold ? 0 : 255;
    }
  }

  return out;
}

function createEdgeMask(
  src: Buffer,
  W: number,
  H: number,
  options: PrintCutOptions,
): Buffer {
  const gray = Buffer.alloc(W * H, 255);
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    const a = src[i + 3] / 255;
    const lum =
      (0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]) * a +
      255 * (1 - a);
    gray[p] = Math.max(0, Math.min(255, Math.round(lum)));
  }

  const out = Buffer.alloc(W * H, 255);
  const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const edgeThreshold = Math.max(8, Math.min(120, 255 - options.threshold));

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      let gx = 0;
      let gy = 0;
      let n = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const v = gray[(y + j) * W + (x + i)];
          gx += v * kx[n];
          gy += v * ky[n];
          n++;
        }
      }
      const mag = Math.sqrt(gx * gx + gy * gy);
      out[y * W + x] = mag >= edgeThreshold ? 0 : 255;
    }
  }
  return out;
}

async function smoothBinaryMask(
  mask: Buffer,
  width: number,
  height: number,
  sharp: any,
): Promise<Buffer> {
  try {
    return await sharp(mask, { raw: { width, height, channels: 1 } })
      .median(3)
      .threshold(128)
      .raw()
      .toBuffer();
  } catch {
    return mask;
  }
}

async function expandMask(
  mask: Buffer,
  width: number,
  height: number,
  radius: number,
  sharp: any,
): Promise<Buffer> {
  try {
    const inverted = await sharp(mask, { raw: { width, height, channels: 1 } })
      .negate()
      .dilate(Math.max(1, radius))
      .negate()
      .threshold(128)
      .raw()
      .toBuffer();
    return inverted as Buffer;
  } catch {
    return expandMaskFallback(mask, width, height, radius);
  }
}

function expandMaskFallback(
  mask: Buffer,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(1, Math.min(18, radius));
  const out = Buffer.from(mask);
  const rr = r * r;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] !== 0) continue;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > rr) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          out[yy * width + xx] = 0;
        }
      }
    }
  }
  return out;
}

function extractPathTags(svg: string) {
  return svg.match(/<path\b[^>]*>/gi) ?? [];
}

function scaleAndStyleCutPath(
  path: string,
  scaleX: number,
  scaleY: number,
  options: PrintCutOptions,
) {
  const transform =
    Math.abs(scaleX - 1) < 0.0001 && Math.abs(scaleY - 1) < 0.0001
      ? ""
      : ` transform="scale(${round(scaleX, 6)} ${round(scaleY, 6)})"`;

  const attrs = path
    .replace(/^<path\b/i, "")
    .replace(/>$/i, "")
    .replace(/\sfill\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\sstroke\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\sstroke-width\s*=\s*["'][^"']*["']/gi, "")
    .trim();

  return `<path ${attrs}${transform} fill="none" stroke="${options.cutLineColor}" stroke-width="${options.cutLineWidth}" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="1" vector-effect="non-scaling-stroke"/>`;
}

function isFlatOrEmptyMask(mask: Buffer) {
  let black = 0;
  const step = Math.max(1, Math.floor(mask.length / 20000));
  for (let i = 0; i < mask.length; i += step) {
    if (mask[i] < 128) black++;
  }
  const sampled = Math.ceil(mask.length / step);
  const ratio = black / Math.max(1, sampled);
  return ratio < 0.001 || ratio > 0.995;
}

function normalizeCutSource(value: string): CutSource {
  if (
    value === "auto" ||
    value === "transparent" ||
    value === "light-background" ||
    value === "dark-artwork" ||
    value === "edge"
  ) {
    return value;
  }
  return "auto";
}

function normalizeBackgroundMode(value: string): BackgroundMode {
  return value === "white" ? "white" : "transparent";
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function safeHexColor(value: string, fallback: string) {
  const v = value.trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function round(value: number, places: number) {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

/* ========================
   UI types and presets
======================== */
type Settings = {
  cutSource: CutSource;
  backgroundMode: BackgroundMode;
  threshold: number;
  backgroundTolerance: number;
  alphaThreshold: number;
  outlinePadding: number;
  cutLineColor: string;
  cutLineWidth: number;
  turdSize: number;
  optTolerance: number;
  smoothMask: boolean;
  showCutLine: boolean;
};

type Preset = {
  id: string;
  label: string;
  settings: Partial<Settings>;
};

const DEFAULTS: Settings = {
  cutSource: "auto",
  backgroundMode: "transparent",
  threshold: 245,
  backgroundTolerance: 24,
  alphaThreshold: 8,
  outlinePadding: 12,
  cutLineColor: DEFAULT_CUT_COLOR,
  cutLineWidth: 2,
  turdSize: 6,
  optTolerance: 0.55,
  smoothMask: true,
  showCutLine: true,
};

const PRESETS: Preset[] = [
  {
    id: "sticker-default",
    label: "Sticker  -  Clean Offset (default)",
    settings: {
      cutSource: "auto",
      backgroundMode: "transparent",
      threshold: 245,
      backgroundTolerance: 24,
      outlinePadding: 12,
      cutLineColor: DEFAULT_CUT_COLOR,
      cutLineWidth: 2,
      turdSize: 6,
      optTolerance: 0.55,
      smoothMask: true,
      showCutLine: true,
    },
  },
  {
    id: "transparent-png",
    label: "Transparent PNG  -  Best Cut Edge",
    settings: {
      cutSource: "transparent",
      backgroundMode: "transparent",
      alphaThreshold: 6,
      outlinePadding: 10,
      turdSize: 5,
      optTolerance: 0.5,
      smoothMask: true,
    },
  },
  {
    id: "white-background",
    label: "White Background  -  Remove Edge",
    settings: {
      cutSource: "light-background",
      backgroundMode: "transparent",
      backgroundTolerance: 20,
      threshold: 248,
      outlinePadding: 12,
      turdSize: 7,
      optTolerance: 0.6,
      smoothMask: true,
    },
  },
  {
    id: "thick-sticker-border",
    label: "Sticker  -  Larger Border",
    settings: {
      cutSource: "auto",
      outlinePadding: 22,
      cutLineWidth: 2.5,
      turdSize: 8,
      optTolerance: 0.65,
      smoothMask: true,
    },
  },
  {
    id: "tight-cut",
    label: "Print Then Cut  -  Tight Edge",
    settings: {
      cutSource: "auto",
      outlinePadding: 3,
      cutLineWidth: 1.25,
      turdSize: 4,
      optTolerance: 0.42,
      smoothMask: true,
    },
  },
  {
    id: "dark-artwork",
    label: "Dark Artwork  -  Threshold Cut",
    settings: {
      cutSource: "dark-artwork",
      threshold: 210,
      outlinePadding: 10,
      turdSize: 5,
      optTolerance: 0.5,
      smoothMask: true,
    },
  },
  {
    id: "edge-outline",
    label: "Photo / Art  -  Edge Outline",
    settings: {
      cutSource: "edge",
      threshold: 230,
      outlinePadding: 8,
      turdSize: 8,
      optTolerance: 0.7,
      smoothMask: true,
    },
  },
  {
    id: "white-page-preview",
    label: "White Page Preview",
    settings: {
      cutSource: "auto",
      backgroundMode: "white",
      outlinePadding: 12,
      cutLineColor: "#0b2dff",
      cutLineWidth: 2,
      showCutLine: true,
    },
  },
];

type ServerResult = {
  svg?: string;
  error?: string;
  width?: number;
  height?: number;
  cutSourceUsed?: CutSource;
  printableBytes?: number;
  retryAfterMs?: number;
  code?: string;
  gate?: { running: number; queued: number };
};

type HistoryItem = {
  svg: string;
  width: number;
  height: number;
  cutSourceUsed?: CutSource;
  printableBytes?: number;
  stamp: number;
};

type AutoMode = "fast" | "medium" | "off";

function getAutoMode(bytes?: number | null): AutoMode {
  if (bytes == null) return "off";
  if (bytes <= LIVE_FAST_MAX) return "fast";
  if (bytes <= LIVE_MED_MAX) return "medium";
  return "off";
}

function autoModeHint(mode: AutoMode): string {
  if (mode === "medium") {
    return "Live preview is throttled for 10-25 MB Print Then Cut files.";
  }
  return "";
}

function autoModeDetail(mode: AutoMode): string {
  if (mode === "medium") {
    return "Large sticker artwork updates less often to keep the converter stable.";
  }
  return "";
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<ServerResult>();
  const [file, setFile] = React.useState<File | null>(null);
  const [originalFileSize, setOriginalFileSize] = React.useState<number | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] =
    React.useState<string>("sticker-default");
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [dims, setDims] = React.useState<{
    w: number;
    h: number;
    mp: number;
  } | null>(null);
  const [hydrated, setHydrated] = React.useState(false);
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [autoMode, setAutoMode] = React.useState<AutoMode>("off");
  const [toast, setToast] = React.useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressLiveRef = React.useRef(false);
  const busy = fetcher.state !== "idle";

  React.useEffect(() => setHydrated(true), []);

  React.useEffect(() => {
    if (fetcher.data?.svg) {
      const item: HistoryItem = {
        svg: fetcher.data.svg,
        width: fetcher.data.width ?? 0,
        height: fetcher.data.height ?? 0,
        cutSourceUsed: fetcher.data.cutSourceUsed,
        printableBytes: fetcher.data.printableBytes,
        stamp: Date.now(),
      };
      setHistory((prev) => [item, ...prev].slice(0, 10));
      setInfo(null);
    }
  }, [fetcher.data?.svg, fetcher.data?.width, fetcher.data?.height]);

  React.useEffect(() => {
    if (!fetcher.data?.error) return;

    if (fetcher.data.code === "BUSY" && file) {
      const retryAfterMs = Math.max(1500, fetcher.data.retryAfterMs ?? 2500);
      setInfo(
        "Server is busy. Retrying Print Then Cut conversion automatically...",
      );
      const t = setTimeout(() => submitConvert(file, settings), retryAfterMs);
      return () => clearTimeout(t);
    }

    setErr(fetcher.data.error);
  }, [fetcher.data?.error, fetcher.data?.code, fetcher.data?.retryAfterMs]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  React.useEffect(() => {
    if (suppressLiveRef.current) return;
    if (!file) return;

    const mode = autoMode;
    if (mode === "off") return;

    const delay = mode === "fast" ? LIVE_FAST_MS : LIVE_MED_MS;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      submitConvert(file, settings);
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, settings, activePreset, autoMode]);

  async function measureAndSet(f: File) {
    try {
      const { w, h } = await getImageSize(f);
      const mp = (w * h) / 1_000_000;
      setDims({ w, h, mp });
    } catch {
      setDims(null);
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    await handleNewFile(f);
    e.currentTarget.value = "";
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    await handleNewFile(f);
  }

  async function handleNewFile(f: File) {
    if (!ALLOWED_MIME.has(f.type)) {
      setErr("Please choose a PNG or JPEG.");
      return;
    }

    suppressLiveRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);

    setSettings(DEFAULTS);
    setActivePreset("sticker-default");
    setHistory([]);
    setErr(null);
    setInfo(null);
    setDims(null);
    setOriginalFileSize(f.size);

    let chosen = f;

    if (chosen.size > LIVE_MED_MAX) {
      try {
        setInfo("Large file detected. Compressing locally before preview...");
        chosen = await compressToTarget25MB(chosen);
        setInfo(
          `Compressed for preview: ${prettyBytes(f.size)} → ${prettyBytes(
            chosen.size,
          )}.`,
        );
      } catch (e: any) {
        suppressLiveRef.current = false;
        setErr(
          e?.message ||
            "This image is too large for live preview. Resize it and try again.",
        );
        return;
      }
    }

    setFile(chosen);
    setAutoMode(getAutoMode(chosen.size));
    const url = URL.createObjectURL(chosen);
    setPreviewUrl(url);
    await measureAndSet(chosen);

    suppressLiveRef.current = false;
    setTimeout(() => submitConvert(chosen, DEFAULTS), 0);
  }

  async function submitConvert(nextFile = file, nextSettings = settings) {
    if (!nextFile) {
      setErr("Choose an image first.");
      return;
    }

    try {
      await validateBeforeSubmit(nextFile);
    } catch (e: any) {
      setErr(e?.message || "Image is too large.");
      return;
    }

    const fd = new FormData();
    fd.append("file", nextFile);
    fd.append("cutSource", nextSettings.cutSource);
    fd.append("backgroundMode", nextSettings.backgroundMode);
    fd.append("threshold", String(nextSettings.threshold));
    fd.append("backgroundTolerance", String(nextSettings.backgroundTolerance));
    fd.append("alphaThreshold", String(nextSettings.alphaThreshold));
    fd.append("outlinePadding", String(nextSettings.outlinePadding));
    fd.append("cutLineColor", nextSettings.cutLineColor);
    fd.append("cutLineWidth", String(nextSettings.cutLineWidth));
    fd.append("turdSize", String(nextSettings.turdSize));
    fd.append("optTolerance", String(nextSettings.optTolerance));
    fd.append("smoothMask", String(nextSettings.smoothMask));
    fd.append("showCutLine", String(nextSettings.showCutLine));
    setErr(null);

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action: `${window.location.pathname}?index`,
    });
  }

  const buttonDisabled = isServer || !hydrated || busy || !file;

  function applyPreset(preset: Preset) {
    setActivePreset(preset.id);
    setSettings((s) => ({
      ...DEFAULTS,
      cutLineColor: s.cutLineColor,
      ...preset.settings,
    }));
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  function handleCopySvg(svg: string) {
    navigator.clipboard.writeText(svg).then(() => showToast("SVG copied"));
  }

  return (
    <>
      <main className="bg-slate-50 text-slate-900">
        <div className="max-w-[1180px] mx-auto px-4">
          <div className="hidden lg:block py-6">
            <AdSenseDelayed
              slot="2090332782"
              delayMs={1500}
              minHeight={90}
              maxHeight={120}
              format="horizontal"
              fullWidth={true}
              className="mx-auto w-full max-w-[970px]"
            />
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start sm:pt-6 lg:pt-0 lg:pb-8">
            <div className="bg-white sm:border sm:border-slate-200 rounded-xl p-4 sm:shadow-sm overflow-hidden min-w-0">
              <h1 className="inline-flex text-center w-full justify-center mb-2 text-sky-950 items-center gap-2 text-xl sm:text-3xl font-extrabold leading-none m-0">
                PNG to SVG for Cricut Print Then Cut
              </h1>
              <p className="mb-3 text-center text-sm text-slate-600">
                Preserve the printable image colors and add a traced SVG cut
                outline for Cricut Print Then Cut style projects.
              </p>

              <PresetPicker
                presets={PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />

              <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-slate-700">
                <strong className="text-sky-950">What this creates:</strong> one
                SVG with the original artwork embedded as a printable image and
                a separate vector cut outline. It is not a layered vinyl
                converter.
              </div>

              <div className="mt-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="mb-2 w-full inline-flex items-center justify-between px-3 py-1.5 rounded-md border border-slate-200 bg-sky-50 text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                  aria-expanded={showAdvanced}
                  aria-controls="advanced-settings"
                >
                  <span className="inline-flex items-center gap-2">
                    Print Then Cut settings
                  </span>

                  <svg
                    className={[
                      "h-4 w-4 text-slate-500 transition-transform",
                      showAdvanced ? "rotate-180" : "rotate-0",
                    ].join(" ")}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {showAdvanced && (
                  <div
                    id="advanced-settings"
                    className="flex flex-col gap-2 min-w-0"
                  >
                    <Field label="Cut outline source">
                      <select
                        value={settings.cutSource}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            cutSource: e.target.value as CutSource,
                          }))
                        }
                        className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <option value="auto">Auto detect</option>
                        <option value="transparent">
                          Transparent PNG alpha
                        </option>
                        <option value="light-background">
                          Remove white/light background
                        </option>
                        <option value="dark-artwork">Trace dark artwork</option>
                        <option value="edge">Photo/art edge outline</option>
                      </select>
                    </Field>

                    <Field label="Preview background">
                      <select
                        value={settings.backgroundMode}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            backgroundMode: e.target.value as BackgroundMode,
                          }))
                        }
                        className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <option value="transparent">
                          Transparent SVG background
                        </option>
                        <option value="white">White page preview</option>
                      </select>
                    </Field>

                    <Field label={`Cut offset (${settings.outlinePadding}px)`}>
                      <input
                        type="range"
                        min={0}
                        max={48}
                        step={1}
                        value={settings.outlinePadding}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            outlinePadding: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#0b2dff]"
                      />
                    </Field>

                    <Field
                      label={`Background tolerance (${settings.backgroundTolerance})`}
                    >
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={settings.backgroundTolerance}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            backgroundTolerance: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label={`Dark threshold (${settings.threshold})`}>
                      <input
                        type="range"
                        min={0}
                        max={255}
                        step={1}
                        value={settings.threshold}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            threshold: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#0b2dff]"
                      />
                    </Field>

                    <Field
                      label={`Alpha threshold (${settings.alphaThreshold})`}
                    >
                      <input
                        type="range"
                        min={0}
                        max={255}
                        step={1}
                        value={settings.alphaThreshold}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            alphaThreshold: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Cut line color">
                      <input
                        type="color"
                        value={settings.cutLineColor}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            cutLineColor: e.target.value,
                          }))
                        }
                        className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer"
                      />
                    </Field>

                    <Field label="Cut line width">
                      <Num
                        value={settings.cutLineWidth}
                        min={0.25}
                        max={12}
                        step={0.25}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, cutLineWidth: v }))
                        }
                      />
                    </Field>

                    <Field label="Speck cleanup">
                      <Num
                        value={settings.turdSize}
                        min={0}
                        max={40}
                        step={1}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, turdSize: v }))
                        }
                      />
                    </Field>

                    <Field label="Curve smoothness">
                      <Num
                        value={settings.optTolerance}
                        min={0.05}
                        max={1.5}
                        step={0.05}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, optTolerance: v }))
                        }
                      />
                    </Field>

                    <Field label="Smooth mask">
                      <input
                        type="checkbox"
                        checked={settings.smoothMask}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            smoothMask: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                      />
                    </Field>

                    <Field label="Show cut line">
                      <input
                        type="checkbox"
                        checked={settings.showCutLine}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            showCutLine: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                      />
                    </Field>
                  </div>
                )}
              </div>

              {!file ? (
                <DragArea
                  onPick={onPick}
                  onDrop={onDrop}
                  MAX_UPLOAD_BYTES={MAX_UPLOAD_BYTES}
                  MAX_MP={MAX_MP}
                  MAX_SIDE={MAX_SIDE}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#f7faff] border border-[#dae6ff] text-slate-900 mt-0">
                    <div className="flex items-center min-w-0 gap-2">
                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt=""
                          className="w-[22px] h-[22px] rounded-md object-cover mr-1"
                        />
                      )}
                      <span title={file?.name || ""} className="truncate">
                        {file?.name} • {prettyBytes(file?.size || 0)}
                        {originalFileSize &&
                          originalFileSize > file.size &&
                          ` (shrunk from ${prettyBytes(originalFileSize)})`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setFile(null);
                        setPreviewUrl(null);
                        setAutoMode("off");
                        setDims(null);
                        setErr(null);
                        setInfo(null);
                        setOriginalFileSize(null);
                      }}
                      className="px-2 py-1 rounded-md border border-[#d6e4ff] bg-[#eff4ff] cursor-pointer hover:bg-[#e5eeff]"
                    >
                      ×
                    </button>
                  </div>
                  {dims && (
                    <div className="mt-2 text-[13px] text-slate-700">
                      Detected size:{" "}
                      <b>
                        {dims.w}×{dims.h}
                      </b>{" "}
                      (~{dims.mp.toFixed(1)} MP)
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => submitConvert(file, settings)}
                  disabled={buttonDisabled}
                  suppressHydrationWarning
                  className={[
                    "flex items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors",
                    "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0] cursor-pointer",
                    "disabled:opacity-70 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  <Icons
                    name="convert"
                    size={18}
                    className="mr-1"
                    title="Convert"
                  />
                  {busy ? "Creating SVG…" : "Create Print Then Cut SVG"}
                </button>

                {file && autoMode !== "fast" && (
                  <span className="text-[13px] text-slate-600">
                    {autoModeHint(autoMode)} {autoModeDetail(autoMode)}
                  </span>
                )}

                {err && <span className="text-red-700 text-sm">{err}</span>}
                {!err && info && (
                  <span className="text-[13px] text-slate-600">{info}</span>
                )}
              </div>

              {previewUrl && (
                <div className="hidden md:flex flex-col mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <p className="text-slate-700 ml-2 mt-1">
                    Original printable image preview:
                  </p>
                  <img
                    src={previewUrl}
                    alt="Input"
                    className="w-full h-auto block"
                  />
                </div>
              )}
            </div>

            <div className="bg-slate-600 border border-slate-200 rounded-xl p-4 h-full max-h-[124.25em] overflow-auto shadow-sm min-w-0">
              {busy && (
                <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
              )}
              {history.length > 0 ? (
                <div className="grid gap-3">
                  {history.map((item) => (
                    <div
                      key={item.stamp}
                      className="rounded-xl border border-slate-200 bg-white p-2"
                    >
                      <div className="flex gap-3 items-center flex-wrap justify-between">
                        <span className="text-[13px] text-slate-700">
                          {item.width > 0 && item.height > 0
                            ? `${item.width} × ${item.height} px`
                            : "size unknown"}
                          {item.cutSourceUsed
                            ? ` • cut source: ${labelCutSource(item.cutSourceUsed)}`
                            : ""}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap my-2">
                        <button
                          type="button"
                          onClick={() =>
                            downloadSvg(item.svg, "cricut-print-then-cut.svg")
                          }
                          className="flex justify-center items-center px-3 py-2 rounded-lg font-semibold border bg-sky-500 hover:bg-sky-600 text-white border-sky-600 cursor-pointer"
                        >
                          <Icons
                            name="download"
                            size={16}
                            className="inline-block mr-1"
                          />
                          Download SVG
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopySvg(item.svg)}
                          className="flex justify-center items-center px-3 py-2 rounded-lg font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                        >
                          <Icons
                            name="copy"
                            size={16}
                            className="inline-block mr-1"
                          />
                          Copy SVG
                        </button>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white min-h-[240px] flex items-center justify-center p-2">
                        <img
                          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.svg)}`}
                          alt="Print Then Cut SVG result"
                          className="max-w-full h-auto"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="justify-center items-center flex text-white m-0 font-semibold">
                  {!busy && (
                    <Icons
                      name="success"
                      size={20}
                      className="inline-block mr-1"
                    />
                  )}
                  {busy
                    ? "Creating SVG…"
                    : "Print Then Cut SVG previews appear here..."}
                </p>
              )}
            </div>
          </section>
        </div>

        {toast && (
          <div className="fixed right-4 bottom-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[1000]">
            {toast}
          </div>
        )}
      </main>

      <StickerMuleAffiliateCard />

      <div className="block lg:hidden py-6">
        <AdSenseDelayed
          slot="6632213024"
          delayMs={1500}
          minHeight={90}
          maxHeight={100}
          format="horizontal"
          fullWidth={true}
          className="mx-auto w-full max-w-[360px]"
        />
      </div>
      <SeoSections />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ========================
   Client helpers
======================== */
async function getImageSize(file: File): Promise<{ w: number; h: number }> {
  if ("createImageBitmap" in window) {
    const bmp = await createImageBitmap(file);
    return { w: bmp.width, h: bmp.height };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function validateBeforeSubmit(file: File) {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Only PNG or JPEG images are allowed.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File too large. Max 30 MB per image.");
  }
  const { w, h } = await getImageSize(file);
  if (!w || !h) throw new Error("Could not read image dimensions.");
  const mp = (w * h) / 1_000_000;
  if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
    throw new Error(
      `Image too large: ${w}×${h} (~${mp.toFixed(1)} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
    );
  }
}

async function compressToTarget25MB(file: File): Promise<File> {
  const TARGET = LIVE_MED_MAX;
  if (file.size <= TARGET) return file;
  if (!file.type.startsWith("image/")) {
    throw new Error("Unsupported file type for compression.");
  }

  const img =
    "createImageBitmap" in window
      ? await createImageBitmap(file)
      : await loadImageElement(file);

  let w = img.width;
  let h = img.height;

  const encode = async (quality: number): Promise<Blob> => {
    const canvas =
      "OffscreenCanvas" in window
        ? new OffscreenCanvas(w, h)
        : (document.createElement("canvas") as HTMLCanvasElement);
    if (!(canvas as any).getContext) throw new Error("Canvas unsupported.");
    (canvas as any).width = w;
    (canvas as any).height = h;
    const ctx = (canvas as any).getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unsupported.");
    ctx.drawImage(img as any, 0, 0, w, h);

    const mime = "image/jpeg";
    const blob: Blob = await new Promise((res, rej) => {
      if ("convertToBlob" in (canvas as any)) {
        (canvas as any)
          .convertToBlob({ type: mime, quality })
          .then(res)
          .catch(rej);
      } else {
        (canvas as HTMLCanvasElement).toBlob(
          (b) => (b ? res(b) : rej(new Error("toBlob failed"))),
          mime,
          quality,
        );
      }
    });
    return blob;
  };

  for (const q of [0.9, 0.8, 0.7, 0.6, 0.5]) {
    const b = await encode(q);
    if (b.size <= TARGET) {
      return new File([b], renameToJpeg(file.name), { type: "image/jpeg" });
    }
  }

  let scale = 0.9;
  while (w > 64 && h > 64) {
    w = Math.max(64, Math.floor(w * scale));
    h = Math.max(64, Math.floor(h * scale));
    const b = await encode(0.75);
    if (b.size <= TARGET) {
      return new File([b], renameToJpeg(file.name), { type: "image/jpeg" });
    }
    scale = Math.max(0.5, scale - 0.07);
  }

  throw new Error(
    "This image cannot be reduced below 25 MB without excessive degradation.",
  );
}

function renameToJpeg(name: string) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.jpg`;
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadSvg(svg: string, filename: string) {
  const b = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(u);
}

function labelCutSource(source: CutSource) {
  if (source === "transparent") return "transparent alpha";
  if (source === "light-background") return "light background";
  if (source === "dark-artwork") return "dark artwork";
  if (source === "edge") return "edge outline";
  return "auto";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 bg-[#fafcff] border border-[#edf2fb] rounded-lg px-3 py-2 min-w-0">
      <span className="min-w-[180px] text-[13px] text-slate-700 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">{children}</div>
    </label>
  );
}

function Num({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-[110px] px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
    />
  );
}

function prettyBytes(bytes: number) {
  const u = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${u[i]}`;
}

function PresetPicker({
  presets,
  activePreset,
  applyPreset,
}: {
  presets: Preset[];
  activePreset: string;
  applyPreset: (preset: Preset) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {presets.map((preset) => {
        const active = preset.id === activePreset;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset)}
            className={[
              "px-3 py-2 rounded-lg border text-left text-sm font-semibold transition-colors cursor-pointer",
              active
                ? "bg-sky-950 text-white border-sky-950 hover:bg-sky-900"
                : "bg-white text-slate-800 border-slate-200 hover:bg-sky-50 hover:border-sky-200",
            ].join(" ")}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}

function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-8 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-gradient-to-b from-sky-50 to-white p-6 md:p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-sky-700 uppercase">
                Cricut Print Then Cut SVG maker
              </p>
              <h2 className="text-sky-950 text-2xl md:text-3xl font-bold leading-tight">
                Create printable SVG artwork with a separate cut outline
              </h2>
              <p className="text-slate-600">
                This page is for Cricut-style Print Then Cut prep: keep the
                original PNG or JPG artwork as the printable image, then
                generate a vector outline around it. That is different from a
                single-color cut file and different from a layered vinyl SVG.
              </p>
              <p className="text-slate-600">
                Use it for sticker sheets, planner stickers, labels, small
                business packaging, classroom cutouts, party printables, and
                craft artwork where the colors should remain printable.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { k: "Preserve colors", v: "Embeds the printable image" },
                  { k: "Cut outline", v: "Adds a traced SVG path" },
                  { k: "Offset control", v: "Tight edge or sticker border" },
                  { k: "Cricut-focused", v: "Built for craft prep" },
                ].map((x) => (
                  <div
                    key={x.k}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="text-sm font-semibold text-sky-950">
                      {x.k}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">{x.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </header>

          {typeof document !== "undefined" && (
            <div className="block py-6">
              <AdSenseDelayed
                slot="7336722354"
                delayMs={2500}
                afterInteraction={true}
                className="my-3"
                format="rectangle"
                fullWidth={false}
                minHeight={250}
                maxHeight={300}
                placeholderLabel="Sponsored"
              />
            </div>
          )}

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sky-950 text-lg font-bold">
              Best for Print Then Cut and sticker-style projects
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This converter is best when you want the artwork to stay
              full-color but still need a vector cut path around the design. For
              plain vinyl decals, use a single-color Cricut SVG converter. For
              separate vinyl colors, use a layered SVG converter.
            </p>
          </section>

          <section className="mt-8">
            <h3 className="text-sky-950 text-lg font-bold">Best uses</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Sticker artwork",
                "Planner stickers",
                "Product labels",
                "Party printables",
                "Classroom cutouts",
                "Small business packaging",
                "White-border stickers",
                "Transparent PNG designs",
              ].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                >
                  {t}
                </span>
              ))}
            </div>
          </section>

          <section
            itemScope
            itemType="https://schema.org/HowTo"
            className="mt-12"
          >
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <h3 itemProp="name" className="text-sky-950 text-lg font-bold">
                How to make a Print Then Cut SVG
              </h3>
              <span className="text-xs text-slate-500">
                Upload → choose outline source → set offset → export SVG
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload a PNG or JPG",
                  body: "Transparent PNGs usually produce the cleanest cut outline. JPG files with white backgrounds can work with the light background setting.",
                },
                {
                  title: "Choose the right preset",
                  body: "Start with Clean Offset for stickers, Transparent PNG for artwork that already has transparency, or White Background for images on a white page.",
                },
                {
                  title: "Adjust the cut offset",
                  body: "Use a small offset for tight cuts and a larger offset for a white sticker-style border.",
                },
                {
                  title: "Tune cleanup and smoothing",
                  body: "Increase speck cleanup if the outline has dust or small islands. Increase curve smoothness if the cut path is too jagged.",
                },
                {
                  title: "Download and inspect in Design Space",
                  body: "The SVG contains a printable image and a cut outline group. Always verify the final operation/layer behavior before printing expensive sticker paper.",
                },
              ].map((s, i) => (
                <li
                  key={s.title}
                  itemScope
                  itemType="https://schema.org/HowToStep"
                  itemProp="step"
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex gap-3">
                    <div className="shrink-0 h-8 w-8 rounded-full bg-sky-950 text-white text-sm font-bold grid place-items-center">
                      {i + 1}
                    </div>
                    <div>
                      <div
                        itemProp="name"
                        className="font-semibold text-sky-950"
                      >
                        {s.title}
                      </div>
                      <div
                        itemProp="itemListElement"
                        className="mt-1 text-sm text-slate-600"
                      >
                        {s.body}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12">
            <h3 className="text-sky-950 text-lg font-bold">
              Settings explained
            </h3>
            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Cut outline source",
                  body: "Auto uses transparency when available. Use light background for artwork on white, dark artwork for silhouette-like images, and edge outline for photos or drawings.",
                },
                {
                  title: "Cut offset",
                  body: "Expands the detected printable area before tracing. Higher values create a larger sticker border.",
                },
                {
                  title: "Background tolerance",
                  body: "Controls how aggressively near-white pixels are treated as background for JPGs or flattened artwork.",
                },
                {
                  title: "Dark threshold",
                  body: "Controls which pixels count as artwork when tracing dark designs or edge-based images.",
                },
                {
                  title: "Speck cleanup",
                  body: "Removes tiny cut islands that can make sticker outlines messy or hard to manage.",
                },
                {
                  title: "Curve smoothness",
                  body: "Higher values simplify the outline. Lower values preserve more detail but can create more nodes.",
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold text-sky-950">
                    {c.title}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{c.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h3 className="text-sky-950 text-lg font-bold">
              Important limitations
            </h3>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              <p>
                This tool creates a practical SVG package for Print Then Cut
                style prep. It embeds a raster PNG inside the SVG to preserve
                color, then adds a vector outline. It does not magically turn a
                complex photo into fully editable vector color artwork.
              </p>
              <p className="mt-2">
                Cricut Design Space may still require you to confirm operations,
                flatten/attach layers, or adjust sizing after import. Always
                test the SVG before using premium vinyl, printable sticker
                paper, or commercial packaging materials.
              </p>
            </div>
          </section>

          <section className="mt-12">
            <h3 className="text-sky-950 text-lg font-bold">FAQ</h3>
            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "Does this preserve the original colors?",
                  a: "Yes. The printable artwork is embedded as a PNG inside the SVG, so the visual colors are preserved for printing. The cut line is a separate vector path.",
                },
                {
                  q: "Is this the same as a layered SVG?",
                  a: "No. This is for Print Then Cut style files. A layered SVG separates colors into vector layers for vinyl or HTV.",
                },
                {
                  q: "Why does my cut outline include the background?",
                  a: "Use Transparent PNG when your image has transparency. For JPGs or flattened PNGs, use Light Background and increase or decrease background tolerance until the white area is ignored.",
                },
                {
                  q: "Should I use a transparent PNG?",
                  a: "Yes, when possible. Transparent PNGs usually create cleaner sticker and Print Then Cut outlines than JPGs on white backgrounds.",
                },
                {
                  q: "Is this affiliated with Cricut?",
                  a: "No. iLoveSVG is an independent SVG utility site and is not affiliated with Cricut.",
                },
              ].map((item) => (
                <div
                  key={item.q}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold text-sky-950">
                    {item.q}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
