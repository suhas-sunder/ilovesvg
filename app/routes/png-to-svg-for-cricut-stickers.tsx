import * as React from "react";
import type { Route } from "./+types/png-to-svg-for-cricut-stickers";
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
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";

const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "PNG to SVG for Cricut Stickers | Free Sticker Cut Outline Tool";
  const description =
    "Create a Cricut sticker SVG from PNG or JPG artwork. Preserve printable colors, add a smooth cut outline, and export a sticker-ready SVG for Print Then Cut prep.";
  const canonical = "https://www.ilovesvg.com/png-to-svg-for-cricut-stickers";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    {
      name: "keywords",
      content:
        "png to svg for cricut stickers, cricut sticker svg, sticker cut outline svg, png to sticker svg, print then cut sticker svg, cricut sticker outline, sticker border svg",
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
   Limits & types
======================== */
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_MP = 30;
const MAX_SIDE = 8000;
const MAX_TRACE_SIDE = 2200;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 500;
const LIVE_MED_MS = 1800;

const DEFAULT_BG = "#ffffff";
const DEFAULT_CUT_COLOR = "#0ea5e9";

type ReleaseFn = () => void;
type Gate = {
  acquireOrQueue: () => Promise<ReleaseFn>;
  running: number;
  queued: number;
};

async function getGate(): Promise<Gate> {
  const g = globalThis as any;
  if (g.__iheartsvg_sticker_gate) return g.__iheartsvg_sticker_gate as Gate;

  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  let cpuCount = 1;
  try {
    const os = req("os") as typeof import("os");
    cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 1;
  } catch {}

  const MAX = Math.max(1, Math.min(2, cpuCount));
  const QUEUE_MAX = 8;
  const EST_JOB_MS = 3500;

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
      return Math.min(15000, Math.max(1000, waves * EST_JOB_MS));
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

  g.__iheartsvg_sticker_gate = new SimpleGate(MAX, QUEUE_MAX);
  return g.__iheartsvg_sticker_gate as Gate;
}

/* ========================
   Action: sticker SVG with embedded printable image + vector cut outline
======================== */
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

    const {
      HEAVY_BACKEND_RATE_LIMITS,
      checkBackendConversionRateLimit,
      createRateLimitedResponse,
      validateSameOrigin,
      validateMultipartFileCount,
      validateUploadedFileBasics,
      validateFileSignature,
    } = await import("~/utils/backendSecurity.server");

    const originError = validateSameOrigin(request);
    if (originError) return originError;

    const rateLimit = checkBackendConversionRateLimit(
      request,
      "png-to-svg-for-cricut-stickers",
      "raster-trace",
      HEAVY_BACKEND_RATE_LIMITS
    );
    if (!rateLimit.allowed) return createRateLimitedResponse(rateLimit);

    const contentLength = Number(request.headers.get("content-length") || "0");
    const MAX_OVERHEAD = 5 * 1024 * 1024;
    if (contentLength && contentLength > MAX_UPLOAD_BYTES + MAX_OVERHEAD) {
      return json(
        {
          error:
            "Upload too large for sticker conversion. Please resize and try again.",
        },
        { status: 413 },
      );
    }

    const uploadHandler = createMemoryUploadHandler({
      maxPartSize: MAX_UPLOAD_BYTES,
    });
    const form = await parseMultipartFormData(request, uploadHandler);

    const fileCountError = validateMultipartFileCount(form);
    if (fileCountError) return fileCountError;

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return json({ error: "No file uploaded." }, { status: 400 });
    }

    const webFile = file as File;
    const uploadError = validateUploadedFileBasics(webFile, {
      allowedMimeTypes: ALLOWED_MIME,
      maxBytes: MAX_UPLOAD_BYTES,
      label: "supported image",
    });
    if (uploadError) return uploadError;
    if (!ALLOWED_MIME.has(webFile.type)) {
      return json(
        { error: "Only PNG or JPEG images are allowed." },
        { status: 415 },
      );
    }
    if ((webFile.size || 0) > MAX_UPLOAD_BYTES) {
      return json(
        {
          error: `File too large. Max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB per image.`,
        },
        { status: 413 },
      );
    }

    const gate = await getGate();
    let release: ReleaseFn | null = null;

    try {
      release = await gate.acquireOrQueue();
    } catch (e: any) {
      const retryAfterMs = Math.max(1000, Number(e?.retryAfterMs) || 1500);
      return json(
        {
          error:
            "Server is busy creating other sticker SVG files. Retrying automatically.",
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
      const signatureError = validateFileSignature(input, webFile, ALLOWED_MIME);
      if (signatureError) return signatureError;

      const opts: StickerOptions = {
        cutSource: String(
          form.get("cutSource") ?? "transparent-alpha",
        ) as CutSource,
        backgroundTolerance: clampInt(
          Number(form.get("backgroundTolerance") ?? 18),
          0,
          90,
        ),
        alphaThreshold: clampInt(
          Number(form.get("alphaThreshold") ?? 25),
          0,
          255,
        ),
        offsetPx: clampInt(Number(form.get("offsetPx") ?? 18), 0, 60),
        cutLineColor: sanitizeColor(
          String(form.get("cutLineColor") ?? DEFAULT_CUT_COLOR),
          DEFAULT_CUT_COLOR,
        ),
        cutLineWidth: clampNumber(
          Number(form.get("cutLineWidth") ?? 2),
          0.25,
          16,
        ),
        turdSize: clampInt(Number(form.get("turdSize") ?? 4), 0, 25),
        optTolerance: clampNumber(
          Number(form.get("optTolerance") ?? 0.4),
          0.05,
          1.2,
        ),
        smoothMask:
          String(form.get("smoothMask") ?? "true").toLowerCase() === "true",
        showCutLine:
          String(form.get("showCutLine") ?? "true").toLowerCase() === "true",
        transparent:
          String(form.get("transparent") ?? "true").toLowerCase() === "true",
        bgColor: sanitizeColor(
          String(form.get("bgColor") ?? DEFAULT_BG),
          DEFAULT_BG,
        ),
      };

      const result = await buildStickerSvg(input, opts);
      return json({
        svg: result.svg,
        width: result.width,
        height: result.height,
        cutSource: opts.cutSource,
        gate: { running: gate.running, queued: gate.queued },
      });
    } finally {
      try {
        release?.();
      } catch {}
    }
  } catch (err: any) {
    return json(
      { error: err?.message || "Server error during sticker SVG conversion." },
      { status: 500 },
    );
  }
}

type CutSource = "transparent-alpha" | "remove-white-page" | "edge-outline";

type StickerOptions = {
  cutSource: CutSource;
  backgroundTolerance: number;
  alphaThreshold: number;
  offsetPx: number;
  cutLineColor: string;
  cutLineWidth: number;
  turdSize: number;
  optTolerance: number;
  smoothMask: boolean;
  showCutLine: boolean;
  transparent: boolean;
  bgColor: string;
};

async function buildStickerSvg(
  input: Buffer,
  opts: StickerOptions,
): Promise<{ svg: string; width: number; height: number }> {
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  const sharp = req("sharp") as typeof import("sharp");

  try {
    (sharp as any).concurrency?.(1);
    (sharp as any).cache?.({ files: 0, memory: 48 });
  } catch {}

  const { neutralizeTransparencyCheckerboard } = await import(
    "../utils/imagePreprocess.server"
  );
  const sourceInput = await neutralizeTransparencyCheckerboard(input);

  const meta = await sharp(sourceInput).metadata();
  const originalW = meta.width ?? 0;
  const originalH = meta.height ?? 0;
  if (!originalW || !originalH) {
    throw new Error("Could not read image dimensions. Try a different file.");
  }

  const mp = (originalW * originalH) / 1_000_000;
  if (originalW > MAX_SIDE || originalH > MAX_SIDE || mp > MAX_MP) {
    throw new Error(
      `Image too large: ${originalW}×${originalH} (~${mp.toFixed(1)} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
    );
  }

  const base = sharp(sourceInput)
    .rotate()
    .resize({
      width: MAX_TRACE_SIDE,
      height: MAX_TRACE_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha();

  const { data, info } = await base.raw().toBuffer({ resolveWithObject: true });
  const width = info.width | 0;
  const height = info.height | 0;
  const channels = info.channels | 0;
  if (width <= 0 || height <= 0 || channels < 4) {
    throw new Error("Could not prepare sticker image pixels.");
  }

  const rawChannels = channels as 1 | 2 | 3 | 4;

  const printablePng = await sharp(data, {
    raw: { width, height, channels: rawChannels },
  })
    .png()
    .toBuffer();
  const printableB64 = printablePng.toString("base64");

  const mask = buildVisibleMask(data as Buffer, width, height, channels, opts);
  const blackCount = countBlack(mask);
  if (blackCount < 20) {
    throw new Error(
      "Could not find enough visible artwork to create a sticker cut outline.",
    );
  }

  const maskPng = await maskToPng(mask, width, height, opts);
  const cutPaths = await traceCutPaths(maskPng, opts);
  if (!cutPaths.trim()) {
    throw new Error(
      "No sticker cut outline was created. Try a larger offset or a different cut source.",
    );
  }

  const background = opts.transparent
    ? ""
    : `<rect x="0" y="0" width="${width}" height="${height}" fill="${escapeXmlAttr(opts.bgColor)}"/>`;

  const cutGroup = opts.showCutLine
    ? `<g id="sticker-cut-outline" data-role="cut-outline">${cutPaths}</g>`
    : `<g id="sticker-cut-outline" data-role="cut-outline" opacity="0">${cutPaths}</g>`;

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sticker SVG for Cricut">`,
    `<title>Sticker SVG for Cricut</title>`,
    `<desc>Printable image with a separate vector sticker cut outline.</desc>`,
    background,
    `<image id="printable-artwork" x="0" y="0" width="${width}" height="${height}" href="data:image/png;base64,${printableB64}" xlink:href="data:image/png;base64,${printableB64}" preserveAspectRatio="none"/>`,
    cutGroup,
    `</svg>`,
  ].join("");

  return { svg, width, height };
}

function buildVisibleMask(
  pixels: Buffer,
  width: number,
  height: number,
  channels: number,
  opts: StickerOptions,
): Buffer {
  const total = width * height;
  const mask = Buffer.alloc(total, 255);

  for (let i = 0; i < total; i++) {
    const off = i * channels;
    const r = pixels[off];
    const g = pixels[off + 1];
    const b = pixels[off + 2];
    const a = pixels[off + 3];

    let visible = false;
    if (opts.cutSource === "transparent-alpha") {
      visible = a >= opts.alphaThreshold;
      if (
        visible &&
        isNearWhite(r, g, b, Math.min(opts.backgroundTolerance, 8)) &&
        a >= 250
      ) {
        // Keep transparent PNG behavior, but avoid tracing huge blank white pages in accidental exports.
        visible = false;
      }
    } else if (opts.cutSource === "remove-white-page") {
      visible =
        a >= opts.alphaThreshold &&
        !isNearWhite(r, g, b, opts.backgroundTolerance);
    } else {
      visible =
        a >= opts.alphaThreshold &&
        !isNearWhite(r, g, b, opts.backgroundTolerance + 8);
    }

    if (visible) mask[i] = 0;
  }

  return mask;
}

async function maskToPng(
  mask: Buffer,
  width: number,
  height: number,
  opts: StickerOptions,
): Promise<Buffer> {
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  const sharp = req("sharp") as typeof import("sharp");

  let image = sharp(mask, { raw: { width, height, channels: 1 } });

  // Expand black artwork by offset: invert to white artwork, dilate, invert back for Potrace.
  if (opts.offsetPx > 0) {
    try {
      image = image.negate().dilate(opts.offsetPx).negate();
    } catch {
      // Older sharp builds may not expose dilate. Fallback keeps a valid cut path without offset.
      image = sharp(mask, { raw: { width, height, channels: 1 } });
    }
  }

  if (opts.smoothMask) {
    try {
      image = image.median(1);
    } catch {}
  }

  return await image.png().toBuffer();
}

async function traceCutPaths(
  maskPng: Buffer,
  opts: StickerOptions,
): Promise<string> {
  const potrace = await import("potrace");
  const traceFn: any = (potrace as any).trace;
  const PotraceClass: any = (potrace as any).Potrace;
  const traceOpts: any = {
    color: "#000000",
    threshold: 128,
    turdSize: opts.turdSize,
    optTolerance: opts.optTolerance,
    turnPolicy: "majority",
    invert: false,
    blackOnWhite: true,
  };

  const svgRaw: string = await new Promise((resolve, reject) => {
    if (typeof traceFn === "function") {
      traceFn(maskPng, traceOpts, (err: any, out: string) =>
        err ? reject(err) : resolve(out),
      );
    } else if (PotraceClass) {
      const p = new PotraceClass(traceOpts);
      p.loadImage(maskPng, (err: any) => {
        if (err) return reject(err);
        p.setParameters(traceOpts);
        p.getSVG((err2: any, out: string) =>
          err2 ? reject(err2) : resolve(out),
        );
      });
    } else {
      reject(new Error("potrace API not found"));
    }
  });

  const paths: string[] = [];
  for (const match of svgRaw.matchAll(/<path\b[^>]*>/gi)) {
    const tag = match[0];
    const d = getAttr(tag, "d");
    if (!d) continue;
    paths.push(
      `<path d="${escapeXmlAttr(d)}" fill="none" stroke="${escapeXmlAttr(opts.cutLineColor)}" stroke-width="${opts.cutLineWidth}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`,
    );
  }
  return paths.join("");
}

function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i");
  const m = tag.match(re);
  return m ? m[2] : null;
}

function isNearWhite(
  r: number,
  g: number,
  b: number,
  tolerance: number,
): boolean {
  const t = clampInt(tolerance, 0, 120);
  return r >= 255 - t && g >= 255 - t && b >= 255 - t;
}

function countBlack(mask: Buffer): number {
  let count = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] < 128) count++;
  return count;
}

function sanitizeColor(input: string, fallback: string): string {
  const s = String(input || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampNumber(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function escapeXmlAttr(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ========================
   UI
======================== */
type Settings = {
  cutSource: CutSource;
  backgroundTolerance: number;
  alphaThreshold: number;
  offsetPx: number;
  cutLineColor: string;
  cutLineWidth: number;
  turdSize: number;
  optTolerance: number;
  smoothMask: boolean;
  showCutLine: boolean;
  transparent: boolean;
  bgColor: string;
};

type Preset = {
  id: string;
  label: string;
  description: string;
  settings: Partial<Settings>;
};

const DEFAULTS: Settings = {
  cutSource: "transparent-alpha",
  backgroundTolerance: 18,
  alphaThreshold: 25,
  offsetPx: 18,
  cutLineColor: DEFAULT_CUT_COLOR,
  cutLineWidth: 2,
  turdSize: 4,
  optTolerance: 0.4,
  smoothMask: true,
  showCutLine: true,
  transparent: true,
  bgColor: DEFAULT_BG,
};

const PRESETS: Preset[] = [
  {
    id: "white-border",
    label: "Sticker - White Border (default)",
    description:
      "Best first choice for transparent PNG sticker art with a comfortable cut border.",
    settings: {
      cutSource: "transparent-alpha",
      backgroundTolerance: 18,
      alphaThreshold: 25,
      offsetPx: 18,
      cutLineColor: "#ffffff",
      cutLineWidth: 3,
      turdSize: 4,
      optTolerance: 0.42,
      smoothMask: true,
      showCutLine: true,
      transparent: true,
    },
  },
  {
    id: "kiss-cut-tight",
    label: "Kiss Cut - Tight Edge",
    description:
      "Smaller offset for closer sticker cuts around transparent artwork.",
    settings: {
      cutSource: "transparent-alpha",
      backgroundTolerance: 12,
      alphaThreshold: 35,
      offsetPx: 8,
      cutLineColor: DEFAULT_CUT_COLOR,
      cutLineWidth: 2,
      turdSize: 3,
      optTolerance: 0.34,
      smoothMask: true,
      showCutLine: true,
      transparent: true,
    },
  },
  {
    id: "die-cut-bold",
    label: "Die Cut - Bold Border",
    description:
      "Larger border for die-cut style stickers and easier trimming.",
    settings: {
      cutSource: "transparent-alpha",
      backgroundTolerance: 18,
      alphaThreshold: 25,
      offsetPx: 30,
      cutLineColor: "#ffffff",
      cutLineWidth: 4,
      turdSize: 5,
      optTolerance: 0.5,
      smoothMask: true,
      showCutLine: true,
      transparent: true,
    },
  },
  {
    id: "remove-white-page",
    label: "White Background - Remove Page",
    description:
      "Use this when the artwork is on a white JPG/PNG page and the page should not become the cut shape.",
    settings: {
      cutSource: "remove-white-page",
      backgroundTolerance: 28,
      alphaThreshold: 20,
      offsetPx: 18,
      cutLineColor: DEFAULT_CUT_COLOR,
      cutLineWidth: 2,
      turdSize: 5,
      optTolerance: 0.45,
      smoothMask: true,
      showCutLine: true,
      transparent: true,
    },
  },
  {
    id: "printable-vinyl-smooth",
    label: "Printable Vinyl - Smooth Border",
    description:
      "Smoother outline for printable vinyl decals and product labels.",
    settings: {
      cutSource: "remove-white-page",
      backgroundTolerance: 24,
      alphaThreshold: 25,
      offsetPx: 20,
      cutLineColor: DEFAULT_CUT_COLOR,
      cutLineWidth: 2,
      turdSize: 6,
      optTolerance: 0.55,
      smoothMask: true,
      showCutLine: true,
      transparent: true,
    },
  },
  {
    id: "edge-outline",
    label: "Photo / Drawing - Soft Outline",
    description:
      "Uses visible non-white artwork to create a broader sticker outline from drawings or photo-style art.",
    settings: {
      cutSource: "edge-outline",
      backgroundTolerance: 34,
      alphaThreshold: 20,
      offsetPx: 24,
      cutLineColor: DEFAULT_CUT_COLOR,
      cutLineWidth: 2,
      turdSize: 6,
      optTolerance: 0.55,
      smoothMask: true,
      showCutLine: true,
      transparent: true,
    },
  },
  {
    id: "dark-artwork",
    label: "Dark Artwork - Bright Edge",
    description:
      "Uses a light visible cut line so dark sticker art is easier to inspect before export.",
    settings: {
      cutSource: "transparent-alpha",
      backgroundTolerance: 18,
      alphaThreshold: 25,
      offsetPx: 18,
      cutLineColor: "#ffffff",
      cutLineWidth: 3,
      turdSize: 4,
      optTolerance: 0.42,
      smoothMask: true,
      showCutLine: true,
      transparent: false,
      bgColor: "#0b1020",
    },
  },
  {
    id: "white-page-preview",
    label: "White Page Preview",
    description:
      "Adds a white preview background while keeping the printable image and cut outline intact.",
    settings: {
      cutSource: "transparent-alpha",
      backgroundTolerance: 18,
      alphaThreshold: 25,
      offsetPx: 18,
      cutLineColor: DEFAULT_CUT_COLOR,
      cutLineWidth: 2,
      turdSize: 4,
      optTolerance: 0.4,
      smoothMask: true,
      showCutLine: true,
      transparent: false,
      bgColor: "#ffffff",
    },
  },
];

type ServerResult = {
  svg?: string;
  error?: string;
  width?: number;
  height?: number;
  retryAfterMs?: number;
  code?: string;
  cutSource?: CutSource;
  gate?: { running: number; queued: number };
};

type HistoryItem = {
  svg: string;
  width: number;
  height: number;
  stamp: number;
  cutSource: string;
};

type AutoMode = "fast" | "medium" | "off";
function getAutoMode(bytes?: number | null): AutoMode {
  if (bytes == null) return "off";
  if (bytes <= LIVE_FAST_MAX) return "fast";
  if (bytes <= LIVE_MED_MAX) return "medium";
  return "off";
}
function autoModeHint(mode: AutoMode): string {
  if (mode === "medium")
    return "Live preview is throttled for 10-25 MB sticker files.";
  return "";
}
function autoModeDetail(mode: AutoMode): string {
  if (mode === "medium")
    return "Sticker SVG creation embeds the printable image and traces a cut outline.";
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
    React.useState<string>("white-border");
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
        stamp: Date.now(),
        cutSource: fetcher.data.cutSource ?? settings.cutSource,
      };
      setHistory((prev) => [item, ...prev].slice(0, 8));
      setInfo(null);
    }
  }, [
    fetcher.data?.svg,
    fetcher.data?.width,
    fetcher.data?.height,
    fetcher.data?.cutSource,
  ]);

  React.useEffect(() => {
    if (!fetcher.data?.error) return;
    if (fetcher.data.code === "BUSY" && file) {
      const retryAfterMs = Math.max(1000, fetcher.data.retryAfterMs ?? 1500);
      setInfo("Server is busy. Retrying sticker conversion automatically...");
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
    if (autoMode === "off") return;

    const delay = autoMode === "fast" ? LIVE_FAST_MS : LIVE_MED_MS;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => submitConvert(file, settings),
      delay,
    );

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, autoMode]);

  async function measureAndSet(f: File) {
    try {
      const { w, h } = await getImageSize(f);
      setDims({ w, h, mp: (w * h) / 1_000_000 });
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
    setActivePreset("white-border");
    setHistory([]);
    setErr(null);
    setInfo(null);
    setDims(null);
    setOriginalFileSize(f.size);

    let chosen = f;
    if (chosen.size > LIVE_MED_MAX) {
      try {
        setInfo(
          "Large file detected. Compressing locally before sticker preview...",
        );
        chosen = await compressToTarget25MB(chosen);
        setInfo(
          `Compressed for preview: ${prettyBytes(f.size)} → ${prettyBytes(chosen.size)}.`,
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
    void submitConvert(chosen, DEFAULTS);
  }

  async function submitConvert(
    fileOverride?: File | null,
    settingsOverride?: Settings,
  ) {
    const targetFile = fileOverride ?? file;
    const targetSettings = settingsOverride ?? settings;

    if (!targetFile) {
      setErr("Choose an image first.");
      return;
    }

    try {
      await validateBeforeSubmit(targetFile);
    } catch (e: any) {
      setErr(e?.message || "Image is too large.");
      return;
    }

    const fd = new FormData();
    fd.append("file", targetFile);
    fd.append("cutSource", targetSettings.cutSource);
    fd.append(
      "backgroundTolerance",
      String(targetSettings.backgroundTolerance),
    );
    fd.append("alphaThreshold", String(targetSettings.alphaThreshold));
    fd.append("offsetPx", String(targetSettings.offsetPx));
    fd.append("cutLineColor", targetSettings.cutLineColor);
    fd.append("cutLineWidth", String(targetSettings.cutLineWidth));
    fd.append("turdSize", String(targetSettings.turdSize));
    fd.append("optTolerance", String(targetSettings.optTolerance));
    fd.append("smoothMask", String(targetSettings.smoothMask));
    fd.append("showCutLine", String(targetSettings.showCutLine));
    fd.append("transparent", String(targetSettings.transparent));
    fd.append("bgColor", targetSettings.bgColor);
    setErr(null);

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action: `${window.location.pathname}?index`,
    });
  }

  const buttonDisabled = isServer || !hydrated || busy || !file;

  function applyPreset(preset: Preset) {
    const nextSettings = {
      ...DEFAULTS,
      transparent: settings.transparent,
      bgColor: settings.bgColor,
      ...preset.settings,
    } as Settings;

    setActivePreset(preset.id);
    setSettings(nextSettings);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (file && autoMode !== "off") {
      void submitConvert(file, nextSettings);
    }
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
                PNG to SVG for Cricut Stickers
              </h1>
              <p className="mb-3 text-sm text-slate-600 text-center">
                Preserve printable sticker colors and add a separate SVG cut
                outline for Cricut sticker projects.
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
                    Sticker settings
                  </span>
                  <ChevronDownIcon open={showAdvanced} />
                </button>

                {showAdvanced && (
                  <div
                    id="advanced-settings"
                    className="flex flex-col gap-2 min-w-0"
                  >
                    <Field label="Cut source">
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
                        <option value="transparent-alpha">
                          Transparent alpha
                        </option>
                        <option value="remove-white-page">
                          Remove white page
                        </option>
                        <option value="edge-outline">
                          Visible artwork outline
                        </option>
                      </select>
                    </Field>

                    <Field
                      label={`Sticker border offset (${settings.offsetPx}px)`}
                    >
                      <input
                        type="range"
                        min={0}
                        max={60}
                        step={1}
                        value={settings.offsetPx}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            offsetPx: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#0b2dff]"
                      />
                    </Field>

                    <Field
                      label={`White background tolerance (${settings.backgroundTolerance})`}
                    >
                      <input
                        type="range"
                        min={0}
                        max={90}
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

                    <Field label="Alpha threshold">
                      <Num
                        value={settings.alphaThreshold}
                        min={0}
                        max={255}
                        step={1}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, alphaThreshold: v }))
                        }
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
                        max={16}
                        step={0.25}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, cutLineWidth: v }))
                        }
                      />
                    </Field>

                    <Field label="Turd size">
                      <Num
                        value={settings.turdSize}
                        min={0}
                        max={25}
                        step={1}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, turdSize: v }))
                        }
                      />
                    </Field>

                    <Field label="Curve tolerance">
                      <Num
                        value={settings.optTolerance}
                        min={0.05}
                        max={1.2}
                        step={0.05}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, optTolerance: v }))
                        }
                      />
                    </Field>

                    <Field label="Smooth cut mask">
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

                    <Field label="Background">
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={settings.transparent}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              transparent: e.target.checked,
                            }))
                          }
                          title="Transparent background"
                          className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700">
                          Transparent
                        </span>
                        <input
                          type="color"
                          value={settings.bgColor}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              bgColor: e.target.value,
                            }))
                          }
                          aria-disabled={settings.transparent}
                          className={[
                            "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer",
                            settings.transparent
                              ? "opacity-50 pointer-events-none"
                              : "",
                          ].join(" ")}
                          title={
                            settings.transparent
                              ? "Uncheck to pick a background color"
                              : "Pick background color"
                          }
                        />
                      </div>
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
                  {busy ? "Creating sticker SVG…" : "Create sticker SVG"}
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
                    className="w-full h-auto block transparent-checkerboard"
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
                            : "size unknown"}{" "}
                          • cut source: {formatCutSource(item.cutSource)}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap my-2">
                        <button
                          type="button"
                          onClick={() => {
                            const b = new Blob([item.svg], {
                              type: "image/svg+xml;charset=utf-8",
                            });
                            const u = URL.createObjectURL(b);
                            const a = document.createElement("a");
                            a.href = u;
                            a.download = "cricut-sticker.svg";
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(u);
                          }}
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

                      <div className="rounded-xl border border-slate-200 bg-white transparent-checkerboard min-h-[240px] flex items-center justify-center p-2">
                        <SvgObjectPreview
                          svg={item.svg}
                          title="Sticker SVG result"
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
                    ? "Creating sticker SVG…"
                    : "Sticker SVG previews appear here...  "}
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
      <div className="block border-t border-slate-200 bg-white py-6 lg:hidden">
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
      <ContextualAffiliateCard />
      <SeoSections />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

function SvgObjectPreview({ svg, title }: { svg: string; title: string }) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [svg]);

  if (!url) {
    return <span className="text-sm text-slate-500">Preparing preview…</span>;
  }

  return (
    <object
      data={url}
      type="image/svg+xml"
      aria-label={title}
      className="max-w-full w-full h-auto min-h-[240px]"
    />
  );
}

function formatCutSource(source: string) {
  if (source === "transparent-alpha") return "transparent alpha";
  if (source === "remove-white-page") return "white page removal";
  if (source === "edge-outline") return "visible artwork outline";
  return source;
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
  if (!ALLOWED_MIME.has(file.type))
    throw new Error("Only PNG or JPEG images are allowed.");
  if (file.size > MAX_UPLOAD_BYTES)
    throw new Error("File too large. Max 30 MB per image.");
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
  if (!file.type.startsWith("image/"))
    throw new Error("Unsupported file type for compression.");

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

    return await new Promise((res, rej) => {
      if ("convertToBlob" in (canvas as any)) {
        (canvas as any)
          .convertToBlob({ type: "image/jpeg", quality })
          .then(res)
          .catch(rej);
      } else {
        (canvas as HTMLCanvasElement).toBlob(
          (b) => (b ? res(b) : rej(new Error("toBlob failed"))),
          "image/jpeg",
          quality,
        );
      }
    });
  };

  for (const q of [0.9, 0.8, 0.7, 0.6, 0.5]) {
    const b = await encode(q);
    if (b.size <= TARGET)
      return new File([b], renameToJpeg(file.name), { type: "image/jpeg" });
  }

  let scale = 0.9;
  while (w > 64 && h > 64) {
    w = Math.max(64, Math.floor(w * scale));
    h = Math.max(64, Math.floor(h * scale));
    const b = await encode(0.75);
    if (b.size <= TARGET)
      return new File([b], renameToJpeg(file.name), { type: "image/jpeg" });
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

export function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={[
        "h-4 w-4 text-slate-500 transition-transform",
        open ? "rotate-180" : "rotate-0",
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
  );
}

export function PresetPicker({
  presets,
  activePreset,
  applyPreset,
}: {
  presets: Preset[];
  activePreset: string | null;
  applyPreset: (p: Preset) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const DEFAULT_VISIBLE = 2;
  const visiblePresets = expanded ? presets : presets.slice(0, DEFAULT_VISIBLE);
  const showToggle = presets.length > DEFAULT_VISIBLE;

  return (
    <div className="mb-2 mt-[.67rem] min-w-0">
      <div className="grid sm:grid-cols-2 gap-2">
        {visiblePresets.map((p) => {
          const isActive = activePreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              aria-pressed={isActive}
              title={p.description}
              className={[
                "text-left px-3 py-2 rounded-lg border text-sm font-semibold transition-colors cursor-pointer",
                isActive
                  ? "bg-sky-200 border-sky-300 text-sky-950"
                  : "bg-white border-slate-200 text-slate-900 hover:bg-slate-50",
              ].join(" ")}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full inline-flex items-center justify-between rounded-md border border-slate-200 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 cursor-pointer"
          aria-expanded={expanded}
        >
          <span>
            {expanded
              ? "Show fewer presets"
              : `Show ${presets.length - DEFAULT_VISIBLE} more presets`}
          </span>
          <ChevronDownIcon open={expanded} />
        </button>
      )}
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
                PNG/JPG to Cricut sticker SVG
              </p>
              <h2 className="text-sky-950 text-2xl md:text-3xl font-bold leading-tight">
                Create printable sticker SVGs with a separate cut outline
              </h2>
              <p className="text-slate-600">
                This page is built for sticker workflows. It keeps the printable
                artwork as an embedded image and creates a vector cut outline
                that can be inspected before using Cricut sticker paper,
                printable vinyl, labels, or planner sticker sheets.
              </p>
              <p className="text-slate-600">
                Use transparent PNG artwork when possible. For JPGs or PNGs on a
                white page, use the white background removal preset and adjust
                tolerance until the page is ignored and only the artwork becomes
                the cut shape.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { k: "Printable art", v: "Original colors stay visible" },
                  { k: "Cut outline", v: "Separate vector border" },
                  { k: "Sticker presets", v: "Kiss cut, die cut, white page" },
                  {
                    k: "Cricut-focused",
                    v: "Sticker paper and printable vinyl",
                  },
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
          <ExampleSvgConversion />
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
            />
          </div>

          <section className="mt-8">
            <h3 className="text-sky-950 text-lg font-bold">
              Best sticker uses
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Printable stickers",
                "Sticker sheets",
                "Kiss cut stickers",
                "Die cut borders",
                "Printable vinyl",
                "Product labels",
                "Planner stickers",
                "Classroom stickers",
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
                How to convert PNG to SVG for Cricut stickers
              </h3>
              <span className="text-xs text-slate-500">
                Upload → choose sticker preset → adjust border → download SVG
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload a PNG or JPG sticker design",
                  body: "Transparent PNG artwork usually works best. JPG artwork can work too when the background is close to white and easy to separate.",
                },
                {
                  title: "Choose a sticker preset",
                  body: "White Border is the safest first choice. Use Kiss Cut for a tighter edge or Die Cut for a larger border.",
                },
                {
                  title: "Adjust the cut outline",
                  body: "Use border offset, white background tolerance, and smoothing to control how the vector cut path wraps around the printable artwork.",
                },
                {
                  title: "Download the SVG",
                  body: "The export contains the printable image and a separate vector cut outline. Inspect it in Cricut Design Space before printing or cutting paid materials.",
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
              Sticker settings explained
            </h3>
            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Cut source",
                  body: "Transparent alpha traces the visible PNG area. Remove white page ignores a near-white background. Visible artwork outline is useful for drawings and photo-style sticker art.",
                },
                {
                  title: "Sticker border offset",
                  body: "Controls how far the cut outline expands around the artwork. Larger values create a bolder die-cut style border.",
                },
                {
                  title: "White background tolerance",
                  body: "Higher values ignore more off-white background pixels. Use this when a JPG or PNG has a white page behind the artwork.",
                },
                {
                  title: "Cut line color and width",
                  body: "These only help you inspect the outline. You can hide, recolor, or edit the cut line after export.",
                },
                {
                  title: "Turd size and curve tolerance",
                  body: "These clean the traced cut outline. Higher values usually remove tiny bumps and make the border smoother.",
                },
                {
                  title: "Transparent background",
                  body: "Keep this on for most exports. Turn it off only when you want a preview background inside the SVG.",
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

          <section className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="text-sky-950 text-lg font-bold">
              Important Cricut expectation
            </h3>
            <p className="mt-2 text-sm text-slate-700">
              This is a sticker-prep SVG, not a layered vinyl SVG and not a pure
              vector recreation of every color. The printable artwork is
              embedded as an image, while the cut outline is vector. That
              matches sticker and Print Then Cut prep better than forcing
              full-color artwork into hundreds of vector paths.
            </p>
          </section>

          <section
            className="mt-12"
            itemScope
            itemType="https://schema.org/FAQPage"
          >
            <h3 className="text-sky-950 text-lg font-bold">
              Frequently asked questions
            </h3>
            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "Why is the artwork embedded instead of fully vectorized?",
                  a: "Sticker workflows usually need printable color artwork plus a clean cut border. Embedding the artwork preserves the printed appearance better than simplifying it into vector color layers.",
                },
                {
                  q: "Can I use this for Cricut Print Then Cut?",
                  a: "Use it as prep and always inspect the final file in Cricut Design Space. The SVG includes printable artwork and a visible vector cut outline.",
                },
                {
                  q: "What if my JPG has a white background?",
                  a: "Use the White Background - Remove Page preset and raise the white background tolerance until the page is ignored.",
                },
                {
                  q: "Is this the same as the layered SVG converter?",
                  a: "No. The layered SVG converter separates artwork into color vector groups. This sticker page preserves the image and adds a cut outline.",
                },
                {
                  q: "Is this affiliated with Cricut?",
                  a: "No. iLoveSVG is independent and is not affiliated with Cricut. Cricut is mentioned only to describe common craft file workflows.",
                },
              ].map((item) => (
                <article
                  key={item.q}
                  itemScope
                  itemType="https://schema.org/Question"
                  itemProp="mainEntity"
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h4
                    itemProp="name"
                    className="m-0 font-semibold text-sky-950"
                  >
                    {item.q}
                  </h4>
                  <p
                    itemScope
                    itemType="https://schema.org/Answer"
                    itemProp="acceptedAnswer"
                    className="mt-2 text-sm text-slate-600"
                  >
                    <span itemProp="text">{item.a}</span>
                  </p>
                </article>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
