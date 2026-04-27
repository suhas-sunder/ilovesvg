import * as React from "react";
import type { Route } from "./+types/png-to-layered-svg-for-cricut";
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
  const title = "PNG to Layered SVG for Cricut | Free Color Layer Converter";
  const description =
    "Convert PNG and JPG artwork into layered color SVG files for Cricut vinyl, HTV, decals, labels, and craft projects. Choose color layers, merge similar colors, and export grouped SVG paths.";
  const canonical = "https://www.ilovesvg.com/png-to-layered-svg-for-cricut";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    {
      name: "keywords",
      content:
        "png to layered svg for cricut, layered svg for cricut, png to svg layers, cricut layered svg converter, convert png to layered svg, vinyl layer svg, htv layer svg, cricut color layers",
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
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 600;
const LIVE_MED_MS = 2200;

const MAX_TRACE_SIDE = 1800;
const DEFAULT_BG = "#ffffff";

type ReleaseFn = () => void;
type Gate = {
  acquireOrQueue: () => Promise<ReleaseFn>;
  running: number;
  queued: number;
};

async function getGate(): Promise<Gate> {
  const g = globalThis as any;
  if (g.__iheartsvg_layer_gate) return g.__iheartsvg_layer_gate as Gate;

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

  g.__iheartsvg_layer_gate = new SimpleGate(MAX, QUEUE_MAX);
  return g.__iheartsvg_layer_gate as Gate;
}

/* ========================
   Action: multi-color layered SVG
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

    const contentLength = Number(request.headers.get("content-length") || "0");
    const MAX_OVERHEAD = 5 * 1024 * 1024;
    if (contentLength && contentLength > MAX_UPLOAD_BYTES + MAX_OVERHEAD) {
      return json(
        {
          error:
            "Upload too large for layered conversion. Please resize and try again.",
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
      const retryAfterMs = Math.max(1500, Number(e?.retryAfterMs) || 2500);
      return json(
        {
          error:
            "Server is busy building layered SVG files. Retrying automatically.",
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

      const options: LayerOptions = {
        colorCount: clampInt(Number(form.get("colorCount") ?? 6), 2, 12),
        mergeDistance: clampInt(Number(form.get("mergeDistance") ?? 34), 8, 90),
        minAreaPercent: clampNumber(
          Number(form.get("minAreaPercent") ?? 0.22),
          0.02,
          5,
        ),
        turdSize: clampInt(Number(form.get("turdSize") ?? 3), 0, 20),
        optTolerance: clampNumber(
          Number(form.get("optTolerance") ?? 0.34),
          0.05,
          1.2,
        ),
        posterize: String(form.get("posterize") ?? "medium") as PosterizeMode,
        smoothMasks:
          String(form.get("smoothMasks") ?? "true").toLowerCase() === "true",
        includeBackground:
          String(form.get("includeBackground") ?? "false").toLowerCase() ===
          "true",
        transparent:
          String(form.get("transparent") ?? "true").toLowerCase() === "true",
        bgColor: String(form.get("bgColor") ?? DEFAULT_BG),
      };

      const result = await buildLayeredSvg(input, options);

      return json({
        svg: result.svg,
        width: result.width,
        height: result.height,
        layers: result.layers,
        gate: { running: gate.running, queued: gate.queued },
      });
    } finally {
      try {
        release?.();
      } catch {}
    }
  } catch (err: any) {
    return json(
      { error: err?.message || "Server error during layered SVG conversion." },
      { status: 500 },
    );
  }
}

type PosterizeMode = "low" | "medium" | "high";

type LayerOptions = {
  colorCount: number;
  mergeDistance: number;
  minAreaPercent: number;
  turdSize: number;
  optTolerance: number;
  posterize: PosterizeMode;
  smoothMasks: boolean;
  includeBackground: boolean;
  transparent: boolean;
  bgColor: string;
};

type PaletteColor = {
  r: number;
  g: number;
  b: number;
  count: number;
};

type LayerSummary = {
  color: string;
  label: string;
  pixels: number;
  percent: number;
};

async function buildLayeredSvg(
  input: Buffer,
  opts: LayerOptions,
): Promise<{
  svg: string;
  width: number;
  height: number;
  layers: LayerSummary[];
}> {
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  const sharp = req("sharp") as typeof import("sharp");

  try {
    (sharp as any).concurrency?.(1);
    (sharp as any).cache?.({ files: 0, memory: 48 });
  } catch {}

  const meta = await sharp(input).metadata();
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

  const resized = sharp(input)
    .rotate()
    .resize({
      width: MAX_TRACE_SIDE,
      height: MAX_TRACE_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha();

  const { data, info } = await resized
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width | 0;
  const height = info.height | 0;
  const channels = info.channels | 0;
  if (channels < 4 || width <= 0 || height <= 0) {
    throw new Error("Could not prepare image pixels for color layering.");
  }

  const pixels = data as Buffer;
  const usable = collectUsablePixels(
    pixels,
    width,
    height,
    channels,
    opts.includeBackground,
  );
  if (usable.length < 20) {
    throw new Error("Not enough visible image detail to create color layers.");
  }

  const initial = seedPalette(usable, opts.colorCount, opts.posterize);
  const palette = refinePalette(
    usable,
    initial,
    opts.mergeDistance,
    opts.colorCount,
  );
  if (palette.length === 0) {
    throw new Error("Could not detect usable color layers in this image.");
  }

  const totalPixels = width * height;
  const minPixels = Math.max(
    8,
    Math.round(totalPixels * (opts.minAreaPercent / 100)),
  );
  const assignments = assignPixelsToPalette(
    pixels,
    width,
    height,
    channels,
    palette,
    opts.includeBackground,
  );

  const layerData: Array<{
    color: PaletteColor;
    pixels: number;
    index: number;
  }> = palette
    .map((color, index) => ({
      color,
      pixels: assignments.counts[index] ?? 0,
      index,
    }))
    .filter((x) => x.pixels >= minPixels)
    .sort((a, b) => b.pixels - a.pixels);

  if (layerData.length === 0) {
    throw new Error(
      "The detected color areas were too small. Lower the minimum color area setting and try again.",
    );
  }

  const potrace = await import("potrace");
  const traceFn: any = (potrace as any).trace;
  const PotraceClass: any = (potrace as any).Potrace;
  if (typeof traceFn !== "function" && !PotraceClass) {
    throw new Error("potrace API not found");
  }

  const groups: string[] = [];
  const summaries: LayerSummary[] = [];

  for (const layer of layerData) {
    const mask = Buffer.alloc(width * height, 255);
    for (let i = 0; i < assignments.ids.length; i++) {
      if (assignments.ids[i] === layer.index) mask[i] = 0;
    }

    let maskSharp = sharp(mask, { raw: { width, height, channels: 1 } });
    if (opts.smoothMasks) {
      maskSharp = maskSharp.median(1);
    }

    const maskPng = await maskSharp.png().toBuffer();
    const colorHex = rgbToHex(layer.color.r, layer.color.g, layer.color.b);

    const svgRaw: string = await new Promise((resolve, reject) => {
      const traceOpts: any = {
        color: "#000000",
        threshold: 128,
        turdSize: opts.turdSize,
        optTolerance: opts.optTolerance,
        turnPolicy: "majority",
        invert: false,
        blackOnWhite: true,
      };

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
      }
    });

    const safe = coerceSvg(svgRaw);
    const ensured = ensureViewBoxResponsive(safe);
    const body = extractSvgBody(
      recolorPaths(
        stripFullWhiteBackgroundRect(ensured.svg, width, height),
        colorHex,
      ),
    );
    if (!body.trim()) continue;

    const label = `Layer ${summaries.length + 1} ${colorHex}`;
    groups.push(
      `<g id="${escapeXmlAttr(label)}" data-color="${colorHex}">${body}</g>`,
    );
    summaries.push({
      color: colorHex,
      label,
      pixels: layer.pixels,
      percent: Number(((layer.pixels / totalPixels) * 100).toFixed(2)),
    });
  }

  if (groups.length === 0) {
    throw new Error(
      "No vector paths were created. Try fewer colors or a lower minimum color area.",
    );
  }

  const background = opts.transparent
    ? ""
    : `<rect x="0" y="0" width="${width}" height="${height}" fill="${escapeXmlAttr(opts.bgColor || DEFAULT_BG)}"/>`;

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Layered SVG for Cricut">`,
    `<title>Layered SVG for Cricut</title>`,
    `<desc>Generated color-layer SVG with grouped paths for Cricut craft projects.</desc>`,
    background,
    ...groups,
    `</svg>`,
  ].join("");

  return { svg, width, height, layers: summaries };
}

function collectUsablePixels(
  pixels: Buffer,
  width: number,
  height: number,
  channels: number,
  includeBackground: boolean,
): PaletteColor[] {
  const result: PaletteColor[] = [];
  const total = width * height;
  const step = Math.max(1, Math.floor(total / 16000));

  for (let i = 0; i < total; i += step) {
    const off = i * channels;
    const r = pixels[off];
    const g = pixels[off + 1];
    const b = pixels[off + 2];
    const a = pixels[off + 3];
    if (a < 35) continue;
    if (!includeBackground && isLikelyBackground(r, g, b, a)) continue;
    result.push({ r, g, b, count: 1 });
  }

  return result;
}

function seedPalette(
  samples: PaletteColor[],
  colorCount: number,
  posterize: PosterizeMode,
): PaletteColor[] {
  const buckets = new Map<string, PaletteColor>();
  const shift = posterize === "low" ? 6 : posterize === "high" ? 4 : 5;

  for (const p of samples) {
    const rr = p.r >> shift;
    const gg = p.g >> shift;
    const bb = p.b >> shift;
    const key = `${rr},${gg},${bb}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.r += p.r;
      existing.g += p.g;
      existing.b += p.b;
      existing.count++;
    } else {
      buckets.set(key, { r: p.r, g: p.g, b: p.b, count: 1 });
    }
  }

  const ranked = [...buckets.values()]
    .map((p) => ({
      r: Math.round(p.r / p.count),
      g: Math.round(p.g / p.count),
      b: Math.round(p.b / p.count),
      count: p.count,
    }))
    .sort((a, b) => b.count - a.count);

  const seeds: PaletteColor[] = [];
  for (const candidate of ranked) {
    if (seeds.every((s) => colorDistance(s, candidate) > 28)) {
      seeds.push(candidate);
    }
    if (seeds.length >= colorCount) break;
  }

  return seeds.length ? seeds : ranked.slice(0, colorCount);
}

function refinePalette(
  samples: PaletteColor[],
  initial: PaletteColor[],
  mergeDistance: number,
  colorCount: number,
): PaletteColor[] {
  let centers = initial.slice(0, colorCount).map((p) => ({ ...p, count: 1 }));
  if (centers.length === 0) return [];

  for (let iter = 0; iter < 8; iter++) {
    const sums = centers.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
    for (const p of samples) {
      const idx = nearestColorIndex(p, centers);
      sums[idx].r += p.r;
      sums[idx].g += p.g;
      sums[idx].b += p.b;
      sums[idx].count++;
    }
    centers = centers.map((old, idx) => {
      const s = sums[idx];
      if (!s.count) return old;
      return {
        r: Math.round(s.r / s.count),
        g: Math.round(s.g / s.count),
        b: Math.round(s.b / s.count),
        count: s.count,
      };
    });
  }

  centers = centers.sort((a, b) => b.count - a.count);
  const merged: PaletteColor[] = [];
  for (const c of centers) {
    const match = merged.find((m) => colorDistance(m, c) <= mergeDistance);
    if (match) {
      const total = match.count + c.count;
      match.r = Math.round((match.r * match.count + c.r * c.count) / total);
      match.g = Math.round((match.g * match.count + c.g * c.count) / total);
      match.b = Math.round((match.b * match.count + c.b * c.count) / total);
      match.count = total;
    } else {
      merged.push({ ...c });
    }
  }

  return merged.slice(0, colorCount);
}

function assignPixelsToPalette(
  pixels: Buffer,
  width: number,
  height: number,
  channels: number,
  palette: PaletteColor[],
  includeBackground: boolean,
): { ids: Int16Array; counts: number[] } {
  const total = width * height;
  const ids = new Int16Array(total);
  ids.fill(-1);
  const counts = palette.map(() => 0);

  for (let i = 0; i < total; i++) {
    const off = i * channels;
    const r = pixels[off];
    const g = pixels[off + 1];
    const b = pixels[off + 2];
    const a = pixels[off + 3];
    if (a < 35) continue;
    if (!includeBackground && isLikelyBackground(r, g, b, a)) continue;
    const idx = nearestColorIndex({ r, g, b, count: 1 }, palette);
    ids[i] = idx;
    counts[idx]++;
  }

  return { ids, counts };
}

function isLikelyBackground(
  r: number,
  g: number,
  b: number,
  a: number,
): boolean {
  if (a < 35) return true;
  const bright = r >= 246 && g >= 246 && b >= 246;
  const nearGray = Math.max(r, g, b) - Math.min(r, g, b) <= 8;
  return bright && nearGray;
}

function nearestColorIndex(p: PaletteColor, palette: PaletteColor[]): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < palette.length; i++) {
    const d = colorDistance(p, palette[i]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function colorDistance(a: PaletteColor, b: PaletteColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => clampInt(v, 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function coerceSvg(svgRaw: string | null | undefined): string {
  const fallback =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"></svg>';
  if (!svgRaw) return fallback;
  const trimmed = String(svgRaw).trim();
  if (/^<svg\b/i.test(trimmed)) return trimmed;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${trimmed}</svg>`;
}

function ensureViewBoxResponsive(svg: string): {
  svg: string;
  width: number;
  height: number;
} {
  const openTagMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openTagMatch) return { svg, width: 1024, height: 1024 };

  const openTag = openTagMatch[0];
  const hasViewBox = /viewBox\s*=\s*["'][^"']*["']/.test(openTag);
  const widthMatch = openTag.match(/width\s*=\s*["'](\d+(\.\d+)?)(px)?["']/i);
  const heightMatch = openTag.match(/height\s*=\s*["'](\d+(\.\d+)?)(px)?["']/i);
  const width = widthMatch ? Number(widthMatch[1]) : 1024;
  const height = heightMatch ? Number(heightMatch[1]) : 1024;

  let newOpen = openTag;
  if (!hasViewBox) {
    newOpen = newOpen.replace(
      /<svg\b/i,
      `<svg viewBox="0 0 ${Math.round(width)} ${Math.round(height)}"`,
    );
  }

  newOpen = newOpen
    .replace(/\swidth\s*=\s*["'][^"']*["']/i, "")
    .replace(/\sheight\s*=\s*["'][^"']*["']/i, "");

  return { svg: svg.replace(openTag, newOpen), width, height };
}

function recolorPaths(svg: string, fillColor: string): string {
  let out = svg.replace(
    /<path\b([^>]*?)\sfill\s*=\s*["'][^"']*["']([^>]*?)>/gi,
    (_m, a, b) => `<path${a} fill="${fillColor}"${b}>`,
  );
  out = out.replace(/<path\b((?:(?!>)[\s\S])*?)>/gi, (m, attrs) => {
    if (/fill\s*=/.test(attrs)) return m;
    return `<path${attrs} fill="${fillColor}">`;
  });
  return out;
}

function stripFullWhiteBackgroundRect(
  svg: string,
  width: number,
  height: number,
): string {
  const whitePattern =
    /(#ffffff|#fff|white|rgb\(255\s*,\s*255\s*,\s*255\)|rgba\(255\s*,\s*255\s*,\s*255\s*,\s*1\))/i;

  const numeric = new RegExp(
    `<rect\\b[^>]*x\\s*=\\s*["']0["'][^>]*y\\s*=\\s*["']0["'][^>]*width\\s*=\\s*["']${escapeReg(String(width))}["'][^>]*height\\s*=\\s*["']${escapeReg(String(height))}["'][^>]*fill\\s*=\\s*["']${whitePattern.source}["'][^>]*>`,
    "ig",
  );

  const percent = new RegExp(
    `<rect\\b[^>]*x\\s*=\\s*["']0%?["'][^>]*y\\s*=\\s*["']0%?["'][^>]*width\\s*=\\s*["']100%["'][^>]*height\\s*=\\s*["']100%["'][^>]*fill\\s*=\\s*["']${whitePattern.source}["'][^>]*>`,
    "ig",
  );

  return svg.replace(numeric, "").replace(percent, "");
}

function extractSvgBody(svg: string): string {
  return svg
    .replace(/^[\s\S]*?<svg\b[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<desc>[\s\S]*?<\/desc>/gi, "");
}

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeXmlAttr(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampNumber(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/* ========================
   UI types and presets
======================== */
type Settings = {
  colorCount: number;
  mergeDistance: number;
  minAreaPercent: number;
  turdSize: number;
  optTolerance: number;
  posterize: PosterizeMode;
  smoothMasks: boolean;
  includeBackground: boolean;
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
  colorCount: 6,
  mergeDistance: 34,
  minAreaPercent: 0.22,
  turdSize: 3,
  optTolerance: 0.34,
  posterize: "medium",
  smoothMasks: true,
  includeBackground: false,
  transparent: true,
  bgColor: DEFAULT_BG,
};

const PRESETS: Preset[] = [
  {
    id: "layered-vinyl-balanced",
    label: "Layered Vinyl  -  Balanced",
    description:
      "Best first choice for decals, HTV, labels, and simple multi-color artwork.",
    settings: {
      colorCount: 6,
      mergeDistance: 34,
      minAreaPercent: 0.22,
      turdSize: 3,
      optTolerance: 0.34,
      posterize: "medium",
      smoothMasks: true,
      includeBackground: false,
      transparent: true,
    },
  },
  {
    id: "simple-logo-layers",
    label: "Logo  -  Clean Color Layers",
    description:
      "Fewer colors, cleaner shapes, and stronger merging for logos and icons.",
    settings: {
      colorCount: 4,
      mergeDistance: 42,
      minAreaPercent: 0.18,
      turdSize: 2,
      optTolerance: 0.28,
      posterize: "medium",
      smoothMasks: true,
      includeBackground: false,
      transparent: true,
    },
  },
  {
    id: "vinyl-easy-weed",
    label: "Vinyl  -  Easier Weeding",
    description:
      "Removes tiny color fragments and creates simpler vinyl-style layers.",
    settings: {
      colorCount: 5,
      mergeDistance: 48,
      minAreaPercent: 0.45,
      turdSize: 5,
      optTolerance: 0.48,
      posterize: "low",
      smoothMasks: true,
      includeBackground: false,
      transparent: true,
    },
  },
  {
    id: "htv-shirt-layers",
    label: "HTV Shirts  -  Smooth Layers",
    description:
      "Smooths shapes for heat-transfer vinyl and reduces small nuisance pieces.",
    settings: {
      colorCount: 5,
      mergeDistance: 40,
      minAreaPercent: 0.35,
      turdSize: 4,
      optTolerance: 0.5,
      posterize: "low",
      smoothMasks: true,
      includeBackground: false,
      transparent: true,
    },
  },
  {
    id: "sticker-art-layers",
    label: "Sticker Art  -  More Colors",
    description:
      "Keeps more color groups for sticker-style illustrations and printable craft art.",
    settings: {
      colorCount: 9,
      mergeDistance: 24,
      minAreaPercent: 0.12,
      turdSize: 2,
      optTolerance: 0.3,
      posterize: "high",
      smoothMasks: true,
      includeBackground: false,
      transparent: true,
    },
  },
  {
    id: "classroom-party-cutouts",
    label: "Party / Classroom  -  Bold Layers",
    description:
      "Bolder grouped colors for cardstock, classroom cutouts, and party decorations.",
    settings: {
      colorCount: 5,
      mergeDistance: 46,
      minAreaPercent: 0.28,
      turdSize: 4,
      optTolerance: 0.42,
      posterize: "low",
      smoothMasks: true,
      includeBackground: false,
      transparent: true,
    },
  },
  {
    id: "detailed-art",
    label: "Detailed Art  -  Keep Small Areas",
    description:
      "More layers and lower cleanup for artwork with important small color details.",
    settings: {
      colorCount: 10,
      mergeDistance: 18,
      minAreaPercent: 0.06,
      turdSize: 1,
      optTolerance: 0.22,
      posterize: "high",
      smoothMasks: false,
      includeBackground: false,
      transparent: true,
    },
  },
  {
    id: "include-white-background",
    label: "Include White  -  Background Layer",
    description:
      "Keeps near-white areas when they are part of the design, not just the page background.",
    settings: {
      colorCount: 6,
      mergeDistance: 34,
      minAreaPercent: 0.22,
      turdSize: 3,
      optTolerance: 0.34,
      posterize: "medium",
      smoothMasks: true,
      includeBackground: true,
      transparent: true,
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
  layers?: LayerSummary[];
  gate?: { running: number; queued: number };
};

type HistoryItem = {
  svg: string;
  width: number;
  height: number;
  stamp: number;
  layers: LayerSummary[];
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
    return "Live preview is throttled for 10-25 MB layered files.";
  return "";
}
function autoModeDetail(mode: AutoMode): string {
  if (mode === "medium")
    return "Layered SVG generation is heavier than single-color tracing.";
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
  const [activePreset, setActivePreset] = React.useState<string>(
    "layered-vinyl-balanced",
  );
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
        layers: fetcher.data.layers ?? [],
      };
      setHistory((prev) => [item, ...prev].slice(0, 8));
      setInfo(null);
    }
  }, [
    fetcher.data?.svg,
    fetcher.data?.width,
    fetcher.data?.height,
    fetcher.data?.layers,
  ]);

  React.useEffect(() => {
    if (!fetcher.data?.error) return;
    if (fetcher.data.code === "BUSY" && file) {
      const retryAfterMs = Math.max(1500, fetcher.data.retryAfterMs ?? 2500);
      setInfo("Server is busy. Retrying layered conversion automatically...");
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
    setActivePreset("layered-vinyl-balanced");
    setHistory([]);
    setErr(null);
    setInfo(null);
    setDims(null);
    setOriginalFileSize(f.size);

    let chosen = f;

    if (chosen.size > LIVE_MED_MAX) {
      try {
        setInfo(
          "Large file detected. Compressing locally before layered preview...",
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
    setTimeout(() => submitConvert(chosen, DEFAULTS), 0);
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
    fd.append("colorCount", String(targetSettings.colorCount));
    fd.append("mergeDistance", String(targetSettings.mergeDistance));
    fd.append("minAreaPercent", String(targetSettings.minAreaPercent));
    fd.append("turdSize", String(targetSettings.turdSize));
    fd.append("optTolerance", String(targetSettings.optTolerance));
    fd.append("posterize", targetSettings.posterize);
    fd.append("smoothMasks", String(targetSettings.smoothMasks));
    fd.append("includeBackground", String(targetSettings.includeBackground));
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
    setActivePreset(preset.id);
    setSettings((s) => ({
      ...DEFAULTS,
      transparent: s.transparent,
      bgColor: s.bgColor,
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
                PNG to Layered SVG for Cricut
              </h1>
              <p className="mb-3 text-sm text-slate-600 text-center">
                Create grouped color-layer SVG files from PNG or JPG artwork.
                Best for layered vinyl, HTV, decals, cardstock, labels, and
                simple Cricut color projects.
              </p>

              <PresetPicker
                presets={PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />

              <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-slate-700">
                This tool creates approximate vector color layers. It is not a
                photo-preserving Print Then Cut exporter. For best Cricut
                results, use clean artwork with clear color separation.
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
                    Layer settings
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
                    <Field label={`Color layers (${settings.colorCount})`}>
                      <input
                        type="range"
                        min={2}
                        max={12}
                        step={1}
                        value={settings.colorCount}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            colorCount: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#0b2dff]"
                      />
                    </Field>

                    <Field
                      label={`Merge similar colors (${settings.mergeDistance})`}
                    >
                      <input
                        type="range"
                        min={8}
                        max={90}
                        step={1}
                        value={settings.mergeDistance}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            mergeDistance: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Color simplification">
                      <select
                        value={settings.posterize}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            posterize: e.target.value as PosterizeMode,
                          }))
                        }
                        className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <option value="low">Low detail, cleaner layers</option>
                        <option value="medium">Medium detail</option>
                        <option value="high">
                          High detail, more color variation
                        </option>
                      </select>
                    </Field>

                    <Field label="Minimum color area (%)">
                      <Num
                        value={settings.minAreaPercent}
                        min={0.02}
                        max={5}
                        step={0.02}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, minAreaPercent: v }))
                        }
                      />
                    </Field>

                    <Field label="Turd size">
                      <Num
                        value={settings.turdSize}
                        min={0}
                        max={20}
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

                    <Field label="Smooth layer edges">
                      <input
                        type="checkbox"
                        checked={settings.smoothMasks}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            smoothMasks: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                      />
                    </Field>

                    <Field label="Include near-white areas">
                      <input
                        type="checkbox"
                        checked={settings.includeBackground}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            includeBackground: e.target.checked,
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
                  {busy ? "Building layers…" : "Convert to Layered SVG"}
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
                    Original Image Preview:
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
                            : "size unknown"}{" "}
                          • {item.layers.length} layer
                          {item.layers.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      {item.layers.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.layers.map((layer) => (
                            <span
                              key={layer.label}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                            >
                              <span
                                className="h-3 w-3 rounded-full border border-slate-300"
                                style={{ backgroundColor: layer.color }}
                              />
                              {layer.color} ({layer.percent}%)
                            </span>
                          ))}
                        </div>
                      )}

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
                            a.download = "layered-cricut.svg";
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
                          Download Layered SVG
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
                          alt="Layered SVG result"
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
                    ? "Building layers…"
                    : "Layered SVG previews appear here...  "}
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

      <ContextualAffiliateCard />

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

function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-8 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-gradient-to-b from-sky-50 to-white p-6 md:p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-sky-700 uppercase">
                PNG/JPG to layered SVG for Cricut projects
              </p>
              <h2 className="text-sky-950 text-2xl md:text-3xl font-bold leading-tight">
                Build grouped color layers for vinyl, HTV, decals, labels, and
                craft art
              </h2>
              <p className="text-slate-600">
                This converter separates visible image colors into grouped SVG
                layers. Each detected color is traced into its own SVG group,
                which makes the result easier to inspect, recolor, hide,
                duplicate, or prepare for Cricut Design Space.
              </p>
              <p className="text-slate-600">
                It works best with simple PNG or JPG artwork that already has
                clear color regions: logos, decals, text graphics, icons,
                classroom cutouts, clipart, party decorations, and small
                business label designs.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { k: "Grouped layers", v: "One SVG group per color" },
                  { k: "Color controls", v: "Choose layer count and merging" },
                  { k: "Cricut-focused", v: "Vinyl, HTV, decals, labels" },
                  { k: "Cleaner exports", v: "Remove tiny color fragments" },
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

          <section className="mt-8">
            <h3 className="text-sky-950 text-lg font-bold">
              Best uses for layered Cricut SVGs
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Layered vinyl decals",
                "HTV shirt graphics",
                "Tumbler decals",
                "Cardstock cutouts",
                "Logo layers",
                "Labels and tags",
                "Classroom projects",
                "Small business packaging",
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
                How to convert PNG to layered SVG for Cricut
              </h3>
              <span className="text-xs text-slate-500">
                Upload → choose preset → adjust color layers → download SVG
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload a PNG or JPG design",
                  body: "Use artwork with clean color regions when possible. Logos, icons, clipart, and simple illustrations usually layer better than busy photos.",
                },
                {
                  title: "Choose a layered SVG preset",
                  body: "Balanced is the safest first choice. Use Easy Weeding for vinyl, Smooth Layers for HTV, or More Colors for sticker-style art.",
                },
                {
                  title: "Set how many color layers you want",
                  body: "More layers keep more color detail but can create more pieces. Fewer layers are easier to cut, weed, and assemble.",
                },
                {
                  title: "Merge similar colors and remove tiny areas",
                  body: "Increase color merging and minimum area to reduce small fragments that are difficult to weed or align.",
                },
                {
                  title: "Download and inspect the SVG",
                  body: "The result uses grouped SVG paths by color. Check the file in Cricut Design Space before cutting expensive vinyl, HTV, cardstock, or sticker material.",
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
              Layer settings explained
            </h3>
            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Color layers",
                  body: "Controls the maximum number of color groups. Use fewer layers for vinyl and more layers for detailed artwork.",
                },
                {
                  title: "Merge similar colors",
                  body: "Combines close shades so you do not end up with separate layers for tiny color differences.",
                },
                {
                  title: "Color simplification",
                  body: "Low detail gives cleaner craft layers. High detail preserves more variation but can create busier SVGs.",
                },
                {
                  title: "Minimum color area",
                  body: "Drops tiny detected color regions that usually turn into annoying cut fragments.",
                },
                {
                  title: "Turd size and curve tolerance",
                  body: "These control cleanup and curve smoothness during vector tracing. Higher values usually create simpler paths.",
                },
                {
                  title: "Include near-white areas",
                  body: "Leave this off when white is only the image background. Turn it on when white is part of the actual design.",
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
              A layered SVG is not the same as preserving a full photo. This
              tool approximates colors into vector regions. That is useful for
              vinyl, HTV, cardstock, decals, and simple craft art. For
              full-color printed stickers, a Print Then Cut workflow is usually
              better.
            </p>
          </section>

          <section className="mt-12">
            <h3 className="text-sky-950 text-lg font-bold">FAQ</h3>
            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "Does this preserve every original color?",
                  a: "No. It simplifies the image into a controlled number of color layers. That is intentional because Cricut vinyl and HTV workflows usually need practical layers, not thousands of image colors.",
                },
                {
                  q: "Is this better than the single-color Cricut converter?",
                  a: "Use this page when you need multiple color groups. Use the single-color Cricut converter when you want one clean cut file for decals, stencils, text art, or silhouettes.",
                },
                {
                  q: "Why did some small details disappear?",
                  a: "The minimum color area and turd size settings remove tiny regions. Lower those settings if the small details are important.",
                },
                {
                  q: "Can I edit the colors after export?",
                  a: "Yes. The SVG output groups paths by detected color and applies solid fill colors. You can edit those fills in vector software or inside compatible design tools.",
                },
                {
                  q: "Is this affiliated with Cricut?",
                  a: "No. iLoveSVG is independent and is not affiliated with Cricut. Cricut is mentioned only to describe common craft file workflows.",
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <summary className="cursor-pointer font-semibold text-sky-950">
                    {item.q}
                  </summary>
                  <p className="mt-2 text-sm text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}

export function PresetPicker({
  presets,
  activePreset,
  applyPreset,
}: {
  presets: Preset[];
  activePreset: string;
  applyPreset: (preset: Preset) => void;
}) {
  const active = presets.find((p) => p.id === activePreset) ?? presets[0];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <label
        className="block text-sm font-semibold text-sky-950 mb-1"
        htmlFor="preset-picker"
      >
        Layer preset
      </label>
      <select
        id="preset-picker"
        value={activePreset}
        onChange={(e) => {
          const next = presets.find((p) => p.id === e.target.value);
          if (next) applyPreset(next);
        }}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
      >
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
      {active && (
        <p className="mt-2 text-xs text-slate-600">{active.description}</p>
      )}
    </div>
  );
}
