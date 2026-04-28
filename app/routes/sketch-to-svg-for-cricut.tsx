import * as React from "react";
import type { Route } from "./+types/drawing-to-svg-for-cricut";
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
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";

const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "Drawing to SVG for Cricut - Free Hand Drawing to SVG Converter";
  const description =
    "Convert drawings, sketches, doodles, kids' artwork, and hand lettering into Cricut-ready SVG files. Clean lines, remove speckles, smooth curves, and download SVG cut files online.";
  const canonical = "https://www.ilovesvg.com/drawing-to-svg-for-cricut";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    { rel: "canonical", href: canonical },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.VALUE_FROM_EXPRESS };
}

/* ========================
   Limits and types
======================== */
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_MP = 30;
const MAX_SIDE = 8000;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

const DARK_BG_DEFAULT = "#0b1020";

const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 450;
const LIVE_MED_MS = 1600;

type ReleaseFn = () => void;
type Gate = {
  acquireOrQueue: () => Promise<ReleaseFn>;
  running: number;
  queued: number;
};

async function getGate(): Promise<Gate> {
  const g = globalThis as any;
  if (g.__drawing_to_svg_gate) return g.__drawing_to_svg_gate as Gate;

  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);

  let cpuCount = 1;

  try {
    const os = req("os") as typeof import("os");
    cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 1;
  } catch {}

  const MAX = Math.max(1, Math.min(2, cpuCount));
  const QUEUE_MAX = 8;
  const EST_JOB_MS = 3000;

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

  g.__drawing_to_svg_gate = new SimpleGate(MAX, QUEUE_MAX);
  return g.__drawing_to_svg_gate as Gate;
}

/* ========================
   Action
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
            "Upload too large for live conversion. Please resize the drawing and try again.",
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
      return json({ error: "No drawing uploaded." }, { status: 400 });
    }

    const webFile = file as File;

    if (!ALLOWED_MIME.has(webFile.type)) {
      return json(
        { error: "Only PNG, JPG, or JPEG drawings are allowed." },
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
      const retryAfterMs = Math.max(1000, Number(e?.retryAfterMs) || 1500);

      return json(
        {
          error:
            "Server is busy converting other drawings. We will retry automatically.",
          retryAfterMs,
          code: "BUSY",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
          },
        },
      );
    }

    try {
      const ab = await webFile.arrayBuffer();
      const input: Buffer = Buffer.from(ab);

      try {
        const { createRequire } = await import("node:module");
        const req = createRequire(import.meta.url);
        const sharp = req("sharp") as typeof import("sharp");
        const meta = await sharp(input).metadata();

        const w = meta.width ?? 0;
        const h = meta.height ?? 0;

        if (!w || !h) {
          return json(
            {
              error:
                "Could not read drawing dimensions. Try a different PNG or JPG file.",
            },
            { status: 415 },
          );
        }

        const mp = (w * h) / 1_000_000;

        if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
          return json(
            {
              error: `Drawing is too large: ${w}×${h} (~${mp.toFixed(
                1,
              )} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
            },
            { status: 413 },
          );
        }
      } catch {
        // If sharp metadata fails, Potrace may still handle valid smaller images.
      }

      const threshold = Number(form.get("threshold") ?? 224);
      const turdSize = Number(form.get("turdSize") ?? 3);
      const optTolerance = Number(form.get("optTolerance") ?? 0.32);
      const turnPolicy = String(form.get("turnPolicy") ?? "minority") as
        | "black"
        | "white"
        | "left"
        | "right"
        | "minority"
        | "majority";

      const whiteOnDark =
        String(form.get("invert") ?? "false").toLowerCase() === "true";

      let lineColor = String(form.get("lineColor") ?? "#000000");

      let transparent =
        String(form.get("transparent") ?? "true").toLowerCase() === "true";
      let bgColor = String(form.get("bgColor") ?? "#ffffff");

      const preprocess = String(form.get("preprocess") ?? "none") as
        | "none"
        | "edge";
      const blurSigma = Number(form.get("blurSigma") ?? 0.8);
      const edgeBoost = Number(form.get("edgeBoost") ?? 1.0);

      if (whiteOnDark) {
        transparent = false;

        if (
          !bgColor ||
          bgColor.toLowerCase() === "#ffffff" ||
          bgColor.toLowerCase() === "#fff"
        ) {
          bgColor = DARK_BG_DEFAULT;
        }

        if (!lineColor || lineColor.toLowerCase() === "#000000") {
          lineColor = "#ffffff";
        }
      }

      const prepped = await normalizeForPotrace(input, {
        preprocess,
        blurSigma,
        edgeBoost,
      });

      const potrace = await import("potrace");
      const traceFn: any = (potrace as any).trace;
      const PotraceClass: any = (potrace as any).Potrace;

      const opts: any = {
        color: "#000000",
        threshold,
        turdSize,
        optTolerance,
        turnPolicy,
        invert: false,
        blackOnWhite: true,
      };

      const svgRaw: string = await new Promise((resolve, reject) => {
        if (typeof traceFn === "function") {
          traceFn(prepped, opts, (err: any, out: string) =>
            err ? reject(err) : resolve(out),
          );
        } else if (PotraceClass) {
          const p = new PotraceClass(opts);

          p.loadImage(prepped, (err: any) => {
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

      const safeSvg = coerceSvg(svgRaw);
      const ensured = ensureViewBoxResponsive(safeSvg);
      const svg2 = recolorPaths(ensured.svg, lineColor);
      const svg3 = stripFullWhiteBackgroundRect(
        svg2,
        ensured.width,
        ensured.height,
      );

      const finalSVG = transparent
        ? svg3
        : injectBackgroundRectString(
            svg3,
            ensured.width,
            ensured.height,
            bgColor,
          );

      return json({
        svg: finalSVG,
        width: ensured.width,
        height: ensured.height,
        gate: {
          running: gate.running,
          queued: gate.queued,
        },
      });
    } finally {
      try {
        release?.();
      } catch {}
    }
  } catch (err: any) {
    return json(
      { error: err?.message || "Server error during drawing conversion." },
      { status: 500 },
    );
  }
}

/* ========================
   Server image normalization
======================== */
async function normalizeForPotrace(
  input: Buffer,
  opts: { preprocess: "none" | "edge"; blurSigma: number; edgeBoost: number },
): Promise<Buffer> {
  try {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const sharp = req("sharp") as typeof import("sharp");

    try {
      (sharp as any).concurrency?.(1);
      (sharp as any).cache?.({ files: 0, memory: 32 });
    } catch {}

    let base = sharp(input).rotate();

    try {
      const meta = await base.metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      const mp = (w * h) / 1_000_000;

      if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
        base = base.resize({ width: 4000, height: 4000, fit: "inside" });
      }
    } catch {}

    if (opts.preprocess === "edge") {
      const { data, info } = await base
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .removeAlpha()
        .grayscale()
        .blur(opts.blurSigma > 0 ? opts.blurSigma : undefined)
        .raw()
        .toBuffer({ resolveWithObject: true });

      const W = info.width | 0;
      const H = info.height | 0;

      if (W <= 1 || H <= 1) {
        return await sharp(input)
          .rotate()
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .removeAlpha()
          .grayscale()
          .gamma()
          .normalize()
          .png()
          .toBuffer();
      }

      const src = data as Buffer;
      const out = Buffer.alloc(W * H, 255);

      const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          let gx = 0;
          let gy = 0;
          let n = 0;

          for (let j = -1; j <= 1; j++) {
            for (let i = -1; i <= 1; i++) {
              const v = src[(y + j) * W + (x + i)];
              gx += v * kx[n];
              gy += v * ky[n];
              n++;
            }
          }

          let m = Math.sqrt(gx * gx + gy * gy) * opts.edgeBoost;
          if (m > 255) m = 255;

          out[y * W + x] = 255 - m;
        }
      }

      if (isFlatBuffer(out)) {
        return await sharp(input)
          .rotate()
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .removeAlpha()
          .grayscale()
          .gamma()
          .normalize()
          .png()
          .toBuffer();
      }

      return await sharp(out, {
        raw: { width: W, height: H, channels: 1 },
      })
        .png()
        .toBuffer();
    }

    return await base
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .removeAlpha()
      .grayscale()
      .gamma()
      .normalize()
      .png()
      .toBuffer();
  } catch {
    return input;
  }
}

function isFlatBuffer(buf: Buffer, sampleStep = 53): boolean {
  const len = buf.length;
  if (len === 0) return true;

  let min = 255;
  let max = 0;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < len; i += sampleStep) {
    const v = buf[i];

    if (v < min) min = v;
    if (v > max) max = v;

    sum += v;
    count++;
  }

  const mean = sum / Math.max(count, 1);
  const range = max - min;

  if (range <= 2) return true;
  if (mean <= 8 || mean >= 247) return true;

  let varSum = 0;

  for (let i = 0; i < len; i += sampleStep) {
    const v = buf[i] - mean;
    varSum += v * v;
  }

  const variance = varSum / Math.max(count - 1, 1);
  return variance < 8;
}

/* ========================
   SVG helpers
======================== */
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

  const newSVG = svg.replace(openTag, newOpen);
  return { svg: newSVG, width, height };
}

function recolorPaths(svg: string, fillColor: string): string {
  let out = svg.replace(
    /<path\b([^>]*?)\sfill\s*=\s*["'][^"']*["']([^>]*?)>/gi,
    (_m, a, b) => `<path${a} fill="${fillColor}"${b}>`,
  );

  out = out.replace(
    /<path\b((?:(?!>)[\s\S])*?)>(?![\s\S]*?<\/path>)/gi,
    (m, attrs) => {
      if (/fill\s*=/.test(attrs)) return m;
      return `<path${attrs} fill="${fillColor}">`;
    },
  );

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
    `<rect\\b[^>]*x\\s*=\\s*["']0["'][^>]*y\\s*=\\s*["']0["'][^>]*width\\s*=\\s*["']${escapeReg(
      String(width),
    )}["'][^>]*height\\s*=\\s*["']${escapeReg(
      String(height),
    )}["'][^>]*fill\\s*=\\s*["']${whitePattern.source}["'][^>]*>`,
    "ig",
  );

  const percent = new RegExp(
    `<rect\\b[^>]*x\\s*=\\s*["']0%?["'][^>]*y\\s*=\\s*["']0%?["'][^>]*width\\s*=\\s*["']100%["'][^>]*height\\s*=\\s*["']100%["'][^>]*fill\\s*=\\s*["']${whitePattern.source}["'][^>]*>`,
    "ig",
  );

  return svg.replace(numeric, "").replace(percent, "");
}

function injectBackgroundRectString(
  svg: string,
  width: number,
  height: number,
  color: string,
): string {
  const openTagMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openTagMatch) return svg;

  const openTag = openTagMatch[0];
  const rect = `<rect x="0" y="0" width="${width}" height="${height}" fill="${color}"/>`;
  const idx = svg.indexOf(openTag) + openTag.length;

  return svg.slice(0, idx) + rect + svg.slice(idx);
}

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ========================
   UI types
======================== */
type Settings = {
  threshold: number;
  turdSize: number;
  optTolerance: number;
  turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  lineColor: string;
  invert: boolean;
  transparent: boolean;
  bgColor: string;
  preprocess: "none" | "edge";
  blurSigma: number;
  edgeBoost: number;
};

type Preset = {
  id: string;
  label: string;
  help: string;
  settings: Partial<Settings>;
};

const PRESETS: Preset[] = [
  {
    id: "drawing-clean",
    label: "Drawing - Clean default",
    help: "Best first choice for marker drawings, doodles, and simple sketches on white paper.",
    settings: {
      preprocess: "none",
      threshold: 224,
      turdSize: 3,
      optTolerance: 0.32,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "kids-art",
    label: "Kids' drawing - Simple",
    help: "Simplifies uneven lines and removes small paper specks so Cricut has fewer tiny cuts.",
    settings: {
      preprocess: "none",
      threshold: 218,
      turdSize: 5,
      optTolerance: 0.45,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "hand-lettering",
    label: "Hand lettering - Bold",
    help: "Preserves thick lettering strokes for decals, labels, signs, and vinyl projects.",
    settings: {
      preprocess: "none",
      threshold: 214,
      turdSize: 2,
      optTolerance: 0.26,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "pencil-sketch",
    label: "Pencil sketch - Boost light lines",
    help: "Includes lighter pencil strokes without going fully photo-edge mode.",
    settings: {
      preprocess: "none",
      threshold: 238,
      turdSize: 1,
      optTolerance: 0.22,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "ink-outline",
    label: "Ink outline - Accurate",
    help: "Keeps crisp ink lines for scanned drawings, tattoo-style designs, and line illustrations.",
    settings: {
      preprocess: "none",
      threshold: 230,
      turdSize: 2,
      optTolerance: 0.2,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "doodle-sticker",
    label: "Doodle sticker - Smooth",
    help: "Smooths rough edges for stickers, vinyl decals, cards, and simple cut files.",
    settings: {
      preprocess: "none",
      threshold: 220,
      turdSize: 4,
      optTolerance: 0.5,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "logo-sketch",
    label: "Logo sketch - Clean shapes",
    help: "Good for turning a rough hand-drawn logo concept into a cleaner vector SVG.",
    settings: {
      preprocess: "none",
      threshold: 208,
      turdSize: 2,
      optTolerance: 0.25,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "scan-speckles",
    label: "Scanned drawing - Remove speckles",
    help: "Aggressively removes dust, scanner dots, paper texture, and tiny accidental marks.",
    settings: {
      preprocess: "none",
      threshold: 226,
      turdSize: 6,
      optTolerance: 0.38,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "photo-of-drawing",
    label: "Photo of drawing - Edge cleanup",
    help: "Use when the drawing was photographed instead of scanned and has shadows or uneven light.",
    settings: {
      preprocess: "edge",
      blurSigma: 1.1,
      edgeBoost: 1.25,
      threshold: 222,
      turdSize: 3,
      optTolerance: 0.36,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "low-contrast-drawing",
    label: "Low contrast - Boost edges",
    help: "Helps recover faint drawings, light pencil, low-contrast paper photos, and gray scans.",
    settings: {
      preprocess: "edge",
      blurSigma: 0.9,
      edgeBoost: 1.65,
      threshold: 230,
      turdSize: 2,
      optTolerance: 0.34,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "white-on-dark",
    label: "White lines on dark",
    help: "Creates a visible white-line SVG on a dark background for previewing inverted designs.",
    settings: {
      preprocess: "none",
      threshold: 225,
      turdSize: 2,
      optTolerance: 0.3,
      turnPolicy: "minority",
      invert: true,
      lineColor: "#ffffff",
      transparent: false,
      bgColor: DARK_BG_DEFAULT,
    },
  },
  {
    id: "blue-pen",
    label: "Blue pen style",
    help: "Outputs a blue-line SVG for pen-style drawings, school notes, diagrams, and craft previews.",
    settings: {
      preprocess: "none",
      threshold: 226,
      turdSize: 2,
      optTolerance: 0.32,
      turnPolicy: "minority",
      lineColor: "#0ea5e9",
      invert: false,
      transparent: true,
    },
  },
];

const DEFAULTS: Settings = {
  threshold: 224,
  turdSize: 3,
  optTolerance: 0.32,
  turnPolicy: "minority",
  lineColor: "#000000",
  invert: false,
  transparent: true,
  bgColor: "#ffffff",
  preprocess: "none",
  blurSigma: 0.8,
  edgeBoost: 1.0,
};

type ServerResult = {
  svg?: string;
  error?: string;
  width?: number;
  height?: number;
  retryAfterMs?: number;
  code?: string;
  gate?: { running: number; queued: number };
};

type HistoryItem = {
  svg: string;
  width: number;
  height: number;
  stamp: number;
  presetLabel: string;
  settings: Settings;
};

type AutoMode = "fast" | "medium" | "off";

function getAutoMode(bytes?: number | null): AutoMode {
  if (bytes == null) return "off";
  if (bytes <= LIVE_FAST_MAX) return "fast";
  if (bytes <= LIVE_MED_MAX) return "medium";
  return "off";
}

function autoModeHint(mode: AutoMode): string {
  if (mode === "medium") return "Live preview is throttled for 10-25 MB files.";
  if (mode === "off")
    return "Use the button to convert larger files after compression.";
  return "";
}

function autoModeDetail(mode: AutoMode): string {
  if (mode === "medium") {
    return "Large drawing; updates run less frequently to keep the converter stable.";
  }

  if (mode === "off") {
    return "For best results, resize or scan the drawing smaller before converting.";
  }

  return "";
}

/* ========================
   Page
======================== */
export default function DrawingToSvgForCricut({}: Route.ComponentProps) {
  const fetcher = useFetcher<ServerResult>();

  const [file, setFile] = React.useState<File | null>(null);
  const [originalFileSize, setOriginalFileSize] = React.useState<number | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] =
    React.useState<string>("drawing-clean");
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
  const [showTips, setShowTips] = React.useState(true);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const objectUrlRef = React.useRef<string | null>(null);

  const pendingFirstConvertRef = React.useRef<{
    file: File;
    settings: Settings;
    requestId: number;
  } | null>(null);

  const requestIdRef = React.useRef(0);
  const lastSubmittedKeyRef = React.useRef<string | null>(null);

  const busy = fetcher.state !== "idle";

  const activePresetObject =
    PRESETS.find((preset) => preset.id === activePreset) ?? PRESETS[0];

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    const pending = pendingFirstConvertRef.current;

    if (!pending) return;
    if (!file) return;
    if (file !== pending.file) return;
    if (busy) return;

    pendingFirstConvertRef.current = null;
    submitFileForConversion(pending.file, pending.settings, "first-upload");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, busy]);

  React.useEffect(() => {
    if (fetcher.data?.error) {
      setErr(fetcher.data.error);
    }

    if (fetcher.data?.code === "BUSY" && fetcher.data.retryAfterMs && file) {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

      const retryFile = file;
      const retrySettings = settings;

      retryTimerRef.current = setTimeout(() => {
        submitFileForConversion(retryFile, retrySettings, "retry");
      }, fetcher.data.retryAfterMs);

      setInfo("Server is busy. Retrying automatically.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data?.error, fetcher.data?.code, fetcher.data?.retryAfterMs]);

  React.useEffect(() => {
    if (fetcher.data?.svg) {
      const item: HistoryItem = {
        svg: fetcher.data.svg,
        width: fetcher.data.width ?? 0,
        height: fetcher.data.height ?? 0,
        stamp: Date.now(),
        presetLabel: activePresetObject.label,
        settings,
      };

      setHistory((prev) => [item, ...prev].slice(0, 10));
      setErr(null);
      setInfo("Drawing converted. Download the SVG or adjust settings.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data?.svg, fetcher.data?.width, fetcher.data?.height]);

  React.useEffect(() => {
    if (!file) return;
    if (pendingFirstConvertRef.current) return;
    if (autoMode === "off") return;
    if (busy) return;

    const delay = autoMode === "fast" ? LIVE_FAST_MS : LIVE_MED_MS;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const liveFile = file;
    const liveSettings = settings;

    debounceRef.current = setTimeout(() => {
      submitFileForConversion(liveFile, liveSettings, "live-preview");
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, settings, activePreset, autoMode, busy]);

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
      setErr("Please choose a PNG, JPG, or JPEG drawing.");
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

    pendingFirstConvertRef.current = null;
    lastSubmittedKeyRef.current = null;

    setFile(null);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setPreviewUrl(null);
    setSettings(DEFAULTS);
    setActivePreset("drawing-clean");
    setHistory([]);
    setErr(null);
    setInfo(null);
    setDims(null);
    setAutoMode("off");
    setOriginalFileSize(f.size);

    let chosen = f;

    try {
      if (chosen.size > LIVE_MED_MAX && chosen.size <= MAX_UPLOAD_BYTES) {
        setInfo("Compressing the drawing locally for live preview.");
        chosen = await compressToTarget25MB(chosen);
      }

      if (requestId !== requestIdRef.current) return;

      if (chosen.size > MAX_UPLOAD_BYTES) {
        setErr("File too large. Max 30 MB per image.");
        setInfo(null);
        return;
      }

      await validateBeforeSubmit(chosen);

      if (requestId !== requestIdRef.current) return;

      const url = URL.createObjectURL(chosen);
      objectUrlRef.current = url;

      pendingFirstConvertRef.current = {
        file: chosen,
        settings: DEFAULTS,
        requestId,
      };

      setFile(chosen);
      setAutoMode(getAutoMode(chosen.size));
      setPreviewUrl(url);

      await measureAndSet(chosen);
    } catch (e: any) {
      if (requestId !== requestIdRef.current) return;

      pendingFirstConvertRef.current = null;
      setErr(e?.message || "Could not prepare this drawing.");
      setInfo(null);
    }
  }

  function submitCurrentFile() {
    if (!file) {
      setErr("Choose a drawing first.");
      return;
    }

    submitFileForConversion(file, settings, "manual");
  }

  async function submitFileForConversion(
    fileToConvert: File,
    settingsToUse: Settings,
    reason: "first-upload" | "manual" | "live-preview" | "retry",
  ) {
    if (!fileToConvert) {
      setErr("Choose a drawing first.");
      return;
    }

    try {
      await validateBeforeSubmit(fileToConvert);
    } catch (e: any) {
      setErr(e?.message || "Drawing is too large.");
      return;
    }

    const effective = getEffectiveSettings(settingsToUse);

    const submitKey = [
      reason,
      fileToConvert.name,
      fileToConvert.size,
      fileToConvert.lastModified,
      effective.threshold,
      effective.turdSize,
      effective.optTolerance,
      effective.turnPolicy,
      effective.lineColor,
      effective.invert,
      effective.transparent,
      effective.bgColor,
      effective.preprocess,
      effective.blurSigma,
      effective.edgeBoost,
    ].join("|");

    if (reason !== "manual" && lastSubmittedKeyRef.current === submitKey) {
      return;
    }

    lastSubmittedKeyRef.current = submitKey;

    const fd = new FormData();
    fd.append("file", fileToConvert);
    fd.append("threshold", String(effective.threshold));
    fd.append("turdSize", String(effective.turdSize));
    fd.append("optTolerance", String(effective.optTolerance));
    fd.append("turnPolicy", effective.turnPolicy);
    fd.append("lineColor", effective.lineColor);
    fd.append("invert", String(effective.invert));
    fd.append("transparent", String(effective.transparent));
    fd.append("bgColor", effective.bgColor);
    fd.append("preprocess", effective.preprocess);
    fd.append("blurSigma", String(effective.blurSigma));
    fd.append("edgeBoost", String(effective.edgeBoost));

    setErr(null);
    setInfo(reason === "first-upload" ? "Converting drawing..." : null);

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action:
        typeof window === "undefined"
          ? "/drawing-to-svg-for-cricut?index"
          : `${window.location.pathname}?index`,
    });
  }

  function getEffectiveSettings(settingsToUse: Settings): Settings {
    if (!settingsToUse.invert) return settingsToUse;

    const bg =
      !settingsToUse.bgColor ||
      settingsToUse.bgColor.toLowerCase() === "#ffffff" ||
      settingsToUse.bgColor.toLowerCase() === "#fff"
        ? DARK_BG_DEFAULT
        : settingsToUse.bgColor;

    return {
      ...settingsToUse,
      transparent: false,
      bgColor: bg,
      lineColor:
        settingsToUse.lineColor?.toLowerCase() === "#000000"
          ? "#ffffff"
          : settingsToUse.lineColor,
    };
  }

  const buttonDisabled = isServer || !hydrated || busy || !file;

  function applyPreset(preset: Preset) {
    setActivePreset(preset.id);

    const nextSettings = {
      ...DEFAULTS,
      transparent: settings.transparent,
      bgColor: settings.bgColor,
      ...preset.settings,
    } as Settings;

    setSettings(nextSettings);

    if (file && autoMode !== "off" && !busy) {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const presetFile = file;

      debounceRef.current = setTimeout(
        () => {
          submitFileForConversion(presetFile, nextSettings, "live-preview");
        },
        autoMode === "fast" ? LIVE_FAST_MS : LIVE_MED_MS,
      );
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  function handleCopySvg(svg: string) {
    navigator.clipboard.writeText(svg).then(
      () => {
        showToast("SVG copied");
      },
      () => {
        setErr("Copy failed. Download the SVG instead.");
      },
    );
  }

  function downloadSvg(item: HistoryItem) {
    const b = new Blob([item.svg], {
      type: "image/svg+xml;charset=utf-8",
    });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = makeDownloadName(file?.name || "drawing", "svg");
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(u);
  }

  function downloadSettingsCsv(item: HistoryItem) {
    const rows = [
      ["Field", "Value"],
      ["Original file", file?.name || ""],
      ["Preset", item.presetLabel],
      ["Width", item.width],
      ["Height", item.height],
      ["Threshold", item.settings.threshold],
      ["Turd size", item.settings.turdSize],
      ["Curve tolerance", item.settings.optTolerance],
      ["Turn policy", item.settings.turnPolicy],
      ["Line color", item.settings.lineColor],
      ["Transparent background", item.settings.transparent ? "Yes" : "No"],
      ["Background color", item.settings.bgColor],
      ["Preprocess", item.settings.preprocess],
      ["Blur sigma", item.settings.blurSigma],
      ["Edge boost", item.settings.edgeBoost],
    ];

    const csv = rows
      .map((row) => row.map((cell) => csvEscape(String(cell))).join(","))
      .join("\n");

    const b = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = "drawing-to-svg-for-cricut-settings.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(u);
  }

  function printResult() {
    window.print();
  }

  return (
    <>
      <main className="bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-[1180px] px-4">
          <div className="hidden py-6 lg:block">
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

          <section className="grid grid-cols-1 items-start gap-4 sm:pt-6 md:grid-cols-2 lg:pb-8 lg:pt-0">
            <div className="min-w-0 overflow-hidden rounded-xl bg-white p-4 sm:border sm:border-slate-200 sm:shadow-sm">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-sky-700">
                Cricut drawing vectorizer
              </p>

              <h1 className="m-0 mb-3 inline-flex w-full items-center justify-center gap-2 text-center text-xl font-extrabold leading-none text-sky-950 sm:text-3xl">
                Drawing to SVG for Cricut
              </h1>

              <p className="mb-4 text-center text-sm leading-6 text-slate-600">
                Upload a hand drawing, doodle, kids' artwork, scanned sketch, or
                lettering image and convert it into a cleaner SVG cut file for
                Cricut Design Space.
              </p>

              <PresetPicker
                presets={PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />

              {activePresetObject?.help && (
                <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-[13px] leading-5 text-slate-700">
                  <b className="text-sky-900">{activePresetObject.label}:</b>{" "}
                  {activePresetObject.help}
                </div>
              )}

              <div className="mt-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="mb-2 inline-flex w-full cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-sky-50 px-3 py-1.5 text-slate-900 transition-colors hover:bg-slate-50"
                  aria-expanded={showAdvanced}
                  aria-controls="advanced-settings"
                >
                  <span className="inline-flex items-center gap-2">
                    Advanced drawing cleanup settings
                  </span>
                  <ChevronDownIcon open={showAdvanced} />
                </button>

                {showAdvanced && (
                  <div
                    id="advanced-settings"
                    className="flex min-w-0 flex-col gap-2"
                  >
                    <Field label="Preprocess">
                      <select
                        value={settings.preprocess}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            preprocess: e.target
                              .value as Settings["preprocess"],
                          }))
                        }
                        className="w-full cursor-pointer rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 transition-colors hover:bg-slate-50"
                      >
                        <option value="none">None: scan / line drawing</option>
                        <option value="edge">Edge: photo of drawing</option>
                      </select>
                    </Field>

                    {settings.preprocess === "edge" && (
                      <>
                        <Field label={`Blur σ (${settings.blurSigma})`}>
                          <Num
                            value={settings.blurSigma}
                            min={0}
                            max={3}
                            step={0.1}
                            onChange={(v) =>
                              setSettings((s) => ({ ...s, blurSigma: v }))
                            }
                          />
                        </Field>

                        <Field label={`Edge boost (${settings.edgeBoost})`}>
                          <Num
                            value={settings.edgeBoost}
                            min={0.5}
                            max={2.2}
                            step={0.1}
                            onChange={(v) =>
                              setSettings((s) => ({ ...s, edgeBoost: v }))
                            }
                          />
                        </Field>
                      </>
                    )}

                    <Field label={`Threshold (${settings.threshold})`}>
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
                        className="w-full cursor-pointer accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Speckle removal">
                      <Num
                        value={settings.turdSize}
                        min={0}
                        max={12}
                        step={1}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, turdSize: v }))
                        }
                      />
                    </Field>

                    <Field label="Curve smoothing">
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

                    <Field label="Corner handling">
                      <select
                        value={settings.turnPolicy}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            turnPolicy: e.target
                              .value as Settings["turnPolicy"],
                          }))
                        }
                        className="w-full cursor-pointer rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 transition-colors hover:bg-slate-50"
                      >
                        <option value="minority">minority</option>
                        <option value="majority">majority</option>
                        <option value="black">black</option>
                        <option value="white">white</option>
                        <option value="left">left</option>
                        <option value="right">right</option>
                      </select>
                    </Field>

                    <Field label="SVG line color">
                      <input
                        type="color"
                        value={settings.lineColor}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            lineColor: e.target.value,
                          }))
                        }
                        className="h-7 w-14 cursor-pointer rounded-md border border-[#dbe3ef] bg-white"
                      />
                    </Field>

                    <Field label="Invert lineart">
                      <input
                        type="checkbox"
                        checked={settings.invert}
                        onChange={(e) =>
                          setSettings((s) => {
                            const on = e.target.checked;

                            if (!on) return { ...s, invert: false };

                            const bg =
                              !s.bgColor ||
                              s.bgColor.toLowerCase() === "#ffffff" ||
                              s.bgColor.toLowerCase() === "#fff"
                                ? DARK_BG_DEFAULT
                                : s.bgColor;

                            return {
                              ...s,
                              invert: true,
                              transparent: false,
                              bgColor: bg,
                              lineColor:
                                s.lineColor?.toLowerCase() === "#000000"
                                  ? "#ffffff"
                                  : s.lineColor,
                            };
                          })
                        }
                        className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Background">
                      <div className="flex min-w-0 items-center gap-2">
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
                          className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
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
                            "h-7 w-14 cursor-pointer rounded-md border border-[#dbe3ef] bg-white",
                            settings.transparent
                              ? "pointer-events-none opacity-50"
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
                  <div className="mt-0 flex items-center justify-between gap-2 rounded-lg border border-[#dae6ff] bg-[#f7faff] px-3 py-2 text-slate-900">
                    <div className="flex min-w-0 items-center gap-2">
                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt=""
                          className="mr-1 h-[22px] w-[22px] rounded-md object-cover"
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
                        requestIdRef.current += 1;
                        pendingFirstConvertRef.current = null;
                        lastSubmittedKeyRef.current = null;

                        if (debounceRef.current)
                          clearTimeout(debounceRef.current);
                        if (retryTimerRef.current)
                          clearTimeout(retryTimerRef.current);

                        if (objectUrlRef.current) {
                          URL.revokeObjectURL(objectUrlRef.current);
                          objectUrlRef.current = null;
                        }

                        setFile(null);
                        setPreviewUrl(null);
                        setAutoMode("off");
                        setDims(null);
                        setErr(null);
                        setInfo(null);
                        setOriginalFileSize(null);
                        setHistory([]);
                      }}
                      className="cursor-pointer rounded-md border border-[#d6e4ff] bg-[#eff4ff] px-2 py-1 hover:bg-[#e5eeff]"
                      aria-label="Remove drawing"
                    >
                      ×
                    </button>
                  </div>

                  {dims && (
                    <div className="mt-2 text-[13px] text-slate-700">
                      Detected drawing size:{" "}
                      <b>
                        {dims.w}×{dims.h}
                      </b>{" "}
                      (~{dims.mp.toFixed(1)} MP)
                    </div>
                  )}
                </>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={submitCurrentFile}
                  disabled={buttonDisabled}
                  suppressHydrationWarning
                  className={[
                    "flex w-full items-center justify-center rounded-lg border px-3.5 py-2 font-bold transition-colors",
                    "cursor-pointer border-[#0a24da] bg-[#0b2dff] text-white hover:border-[#091ec0] hover:bg-[#0a24da]",
                    "disabled:cursor-not-allowed disabled:opacity-70",
                  ].join(" ")}
                >
                  <Icons
                    name="convert"
                    size={18}
                    className="mr-1"
                    title="Convert"
                  />
                  {busy ? "Converting..." : "Convert Drawing to SVG"}
                </button>

                {file && autoMode !== "fast" && (
                  <span className="text-[13px] text-slate-600">
                    {autoModeHint(autoMode)} {autoModeDetail(autoMode)}
                  </span>
                )}

                {err && <span className="text-sm text-red-700">{err}</span>}

                {!err && info && (
                  <span className="text-[13px] text-slate-600">{info}</span>
                )}
              </div>

              {previewUrl && (
                <div className="mt-3 hidden flex-col overflow-hidden rounded-xl border border-slate-200 bg-white md:flex">
                  <p className="ml-2 mt-1 text-slate-700">
                    Original drawing preview:
                  </p>
                  <img
                    src={previewUrl}
                    alt="Input drawing"
                    className="block h-auto w-full"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowTips((v) => !v)}
                className="mt-3 inline-flex w-full cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                aria-expanded={showTips}
              >
                Tips for cleaner Cricut SVGs
                <ChevronDownIcon open={showTips} />
              </button>

              {showTips && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      Use a scan when possible. Photos work, but shadows add
                      noise.
                    </li>
                    <li>
                      Use black marker on white paper for the cleanest cut file.
                    </li>
                    <li>Raise speckle removal if the SVG has tiny dots.</li>
                    <li>
                      Raise curve smoothing if Cricut creates too many small
                      cuts.
                    </li>
                    <li>
                      Use edge mode for photographed drawings or uneven
                      lighting.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="h-full max-h-[124.25em] min-w-0 overflow-auto rounded-xl border border-slate-200 bg-slate-600 p-4 shadow-sm">
              {busy && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
              )}

              {history.length > 0 ? (
                <div className="grid gap-3">
                  {history.map((item) => (
                    <div
                      key={item.stamp}
                      className="rounded-xl border border-slate-200 bg-white p-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="block text-[13px] font-semibold text-slate-800">
                            {item.presetLabel}
                          </span>
                          <span className="text-[13px] text-slate-700">
                            {item.width > 0 && item.height > 0
                              ? `${item.width} × ${item.height} px`
                              : "size unknown"}
                          </span>
                        </div>

                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                          Cricut SVG
                        </span>
                      </div>

                      <div className="my-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => downloadSvg(item)}
                          className="flex cursor-pointer items-center justify-center rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 font-semibold text-white hover:bg-sky-600"
                        >
                          <Icons
                            name="download"
                            size={16}
                            className="mr-1 inline-block"
                          />
                          Download SVG
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopySvg(item.svg)}
                          className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 hover:bg-slate-100"
                        >
                          <Icons
                            name="copy"
                            size={16}
                            className="mr-1 inline-block"
                          />
                          Copy SVG
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadSettingsCsv(item)}
                          className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 hover:bg-slate-100"
                        >
                          Export Settings CSV
                        </button>

                        <button
                          type="button"
                          onClick={printResult}
                          className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 hover:bg-slate-100"
                        >
                          Print to PDF
                        </button>
                      </div>

                      <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
                        <img
                          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                            item.svg,
                          )}`}
                          alt="Converted drawing SVG result"
                          className="h-auto max-w-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="m-0 flex items-center justify-center font-semibold text-white">
                  {!busy && (
                    <Icons
                      name="success"
                      size={20}
                      className="mr-1 inline-block"
                    />
                  )}
                  {busy
                    ? "Converting drawing..."
                    : "Converted drawing SVGs appear here."}
                </p>
              )}
            </div>
          </section>
        </div>

        {toast && (
          <div className="fixed bottom-4 right-4 z-[1000] rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}
      </main>

      <div className="block py-6 lg:hidden">
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
    throw new Error("Only PNG, JPG, or JPEG drawings are allowed.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File too large. Max 30 MB per image.");
  }

  const { w, h } = await getImageSize(file);

  if (!w || !h) throw new Error("Could not read drawing dimensions.");

  const mp = (w * h) / 1_000_000;

  if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
    throw new Error(
      `Drawing is too large: ${w}×${h} (~${mp.toFixed(
        1,
      )} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
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

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
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

  const qualities = [0.92, 0.84, 0.76, 0.68, 0.6, 0.52];

  for (const q of qualities) {
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
    "This drawing cannot be reduced below 25 MB without excessive quality loss.",
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

function makeDownloadName(name: string, extension: string) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const safeBase =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "drawing";

  return `${safeBase}-cricut.${extension}`;
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

/* ========================
   UI helpers
======================== */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2 rounded-lg border border-[#edf2fb] bg-[#fafcff] px-3 py-2">
      <span className="min-w-[180px] shrink-0 text-[13px] text-slate-700">
        {label}
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
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
      className="w-[110px] rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900"
    />
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
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

function PresetPicker({
  presets,
  activePreset,
  applyPreset,
}: {
  presets: Preset[];
  activePreset: string | null;
  applyPreset: (p: Preset) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const DEFAULT_VISIBLE = 4;
  const visiblePresets = expanded ? presets : presets.slice(0, DEFAULT_VISIBLE);
  const showToggle = presets.length > DEFAULT_VISIBLE;

  return (
    <div className="mb-2 mt-[.67rem] min-w-0">
      <div className="grid gap-2 sm:grid-cols-2">
        {visiblePresets.map((p) => {
          const isActive = activePreset === p.id;

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              aria-pressed={isActive}
              title={p.help}
              className={[
                "min-w-0 cursor-pointer rounded-lg border px-3 py-2 text-left text-[13px] font-semibold transition-colors",
                isActive
                  ? "border-sky-600 bg-sky-600 text-white hover:bg-sky-700"
                  : "border-slate-200 bg-slate-50 text-slate-900 hover:border-sky-300 hover:bg-sky-50",
              ].join(" ")}
            >
              <span className="block truncate">{p.label}</span>
            </button>
          );
        })}
      </div>

      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          {expanded ? "Show fewer presets" : "Show more drawing presets"}
        </button>
      )}
    </div>
  );
}

/* ========================
   SEO sections
======================== */
function SeoSections() {
  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-[1180px] px-4 py-8 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 md:p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hand drawing to SVG cut file converter
              </p>

              <h2 className="text-2xl font-bold leading-tight text-sky-950 md:text-3xl">
                Convert drawings into Cricut-ready SVG files
              </h2>

              <p className="text-slate-600">
                This drawing to SVG converter is built for people who want to
                turn real hand-made artwork into Cricut projects. Upload a scan
                or photo of a drawing, choose a cleanup preset, preview the
                vector result, and download an SVG file for Cricut Design Space.
              </p>

              <p className="text-slate-600">
                It works best for marker drawings, clean pencil sketches,
                doodles, simple kids' art, hand lettering, logo sketches,
                white-paper scans, and black-and-white illustrations. The tool
                focuses on practical craft output: fewer messy specks, smoother
                curves, cleaner transparent backgrounds, and usable SVG paths.
              </p>

              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    k: "Drawing-first presets",
                    v: "Kids' art, pencil, ink, lettering, scans",
                  },
                  {
                    k: "Cricut-friendly cleanup",
                    v: "Speckle removal and curve smoothing",
                  },
                  {
                    k: "Transparent SVG",
                    v: "Useful for vinyl, decals, cards, and labels",
                  },
                  {
                    k: "Live preview",
                    v: "Tune settings before downloading",
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

          <ContextualAffiliateCard />

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
          <ExampleSvgConversion />

          <section className="mt-12">
            <h3 className="text-lg font-bold text-sky-950">
              What kinds of drawings work best?
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Kids' drawings",
                "Doodles",
                "Hand lettering",
                "Marker sketches",
                "Pencil sketches",
                "Ink drawings",
                "Logo sketches",
                "Scanned artwork",
                "Simple line art",
                "Card designs",
                "Sticker outlines",
                "Vinyl decals",
              ].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold text-sky-950">
                  Best source images
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Use a high-contrast scan or straight-on photo. Black marker on
                  white paper usually gives the cleanest Cricut SVG. Avoid
                  shadows, wrinkled paper, and busy backgrounds.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold text-sky-950">
                  Best Cricut projects
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Converted drawings work well for vinyl decals, cardstock
                  cards, simple stickers, labels, wall art, keepsake kids'
                  artwork, hand-lettered signs, and custom craft templates.
                </p>
              </div>
            </div>
          </section>

          <section
            itemScope
            itemType="https://schema.org/HowTo"
            className="mt-12"
          >
            <div className="flex items-end justify-between gap-4">
              <h3 itemProp="name" className="text-lg font-bold text-sky-950">
                How to convert a drawing to SVG for Cricut
              </h3>

              <span className="text-xs text-slate-500">
                Upload, clean up, preview, download SVG
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload a scan or photo of your drawing",
                  body: "Choose a PNG, JPG, or JPEG image. Scans are usually cleaner, but well-lit phone photos can work too.",
                },
                {
                  title: "Pick the closest drawing preset",
                  body: "Use kids' drawing, hand lettering, pencil sketch, ink outline, logo sketch, or photo-of-drawing mode depending on your image.",
                },
                {
                  title: "Adjust cleanup settings",
                  body: "Use threshold to capture more or fewer lines, speckle removal to remove paper dots, and curve smoothing to reduce rough cuts.",
                },
                {
                  title: "Preview the SVG result",
                  body: "Check whether the converted file keeps the main drawing without adding too much paper texture or tiny background marks.",
                },
                {
                  title: "Download and upload to Cricut Design Space",
                  body: "Download the SVG file and upload it to Cricut Design Space. If the file feels too complex, return and increase smoothing or speckle removal.",
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
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">
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
                        className="mt-1 text-sm leading-6 text-slate-600"
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
            <h3 className="text-lg font-bold text-sky-950">
              How the drawing cleanup settings affect your SVG
            </h3>

            <p className="mt-2 max-w-[80ch] text-sm leading-6 text-slate-600">
              Drawings are different from clean logos. Paper texture, pencil
              pressure, shadows, dust, and uneven lighting can all become extra
              SVG paths. These settings help you control how much detail Cricut
              has to process.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                {
                  title: "Threshold",
                  body: "Higher values include lighter pencil marks. Lower values keep only darker ink or marker lines.",
                },
                {
                  title: "Speckle removal",
                  body: "Removes tiny dots caused by paper grain, scanner dust, shadows, and broken pencil marks.",
                },
                {
                  title: "Curve smoothing",
                  body: "Higher values make rough hand-drawn edges smoother and can reduce the number of awkward tiny cuts.",
                },
                {
                  title: "Preprocess",
                  body: "Use normal mode for scans and clean drawings. Use edge mode for photographed drawings, shadows, and low-contrast images.",
                },
                {
                  title: "Corner handling",
                  body: "Changes how ambiguous corners and small gaps are resolved. Majority is often cleaner; minority is often more faithful.",
                },
                {
                  title: "Transparent background",
                  body: "Best for most Cricut SVG files. Use a solid background only when you want to preview white or colored lines.",
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold text-sky-950">
                    {c.title}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold text-sky-950">
              Common drawing-to-SVG problems and fixes
            </h3>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                [
                  "SVG has too many dots",
                  "Raise speckle removal and use the scanned drawing preset.",
                ],
                [
                  "Pencil lines disappear",
                  "Raise threshold or use the low contrast preset.",
                ],
                [
                  "Cricut cuts too many tiny pieces",
                  "Increase curve smoothing and use a simpler preset.",
                ],
                [
                  "Photo shadows appear in the SVG",
                  "Use photo-of-drawing mode and photograph the drawing in even light.",
                ],
                [
                  "Letters look too thin",
                  "Use the hand lettering preset or lower the threshold slightly.",
                ],
                [
                  "Edges look jagged",
                  "Increase curve smoothing and avoid low-resolution photos.",
                ],
              ].map(([t, d]) => (
                <div
                  key={t}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold text-sky-950">{t}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{d}</p>
                </div>
              ))}
            </div>
          </section>

          <section
            className="mt-12"
            itemScope
            itemType="https://schema.org/FAQPage"
          >
            <h3 className="text-lg font-bold text-sky-950">
              Frequently asked questions
            </h3>

            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "Can I turn a hand drawing into an SVG for Cricut?",
                  a: "Yes. Upload a scan or clear photo of the drawing, choose a drawing preset, adjust cleanup settings if needed, and download the SVG file for Cricut Design Space.",
                },
                {
                  q: "What file types can I upload?",
                  a: "This converter accepts PNG, JPG, and JPEG images up to 30 MB, with practical live-preview handling for files up to 25 MB after local compression.",
                },
                {
                  q: "What kind of drawing converts best?",
                  a: "High-contrast drawings convert best. Black marker or dark ink on white paper usually creates a cleaner SVG than faint pencil, shaded artwork, or photos with shadows.",
                },
                {
                  q: "Why does my Cricut SVG have lots of tiny pieces?",
                  a: "The converter may be tracing paper texture, dust, shadows, or broken sketch marks. Raise speckle removal, increase curve smoothing, or use a simpler drawing preset.",
                },
                {
                  q: "Should I use a scan or a phone photo?",
                  a: "A scan is usually better. A phone photo can work if it is bright, straight-on, sharp, and taken without shadows across the paper.",
                },
                {
                  q: "Can I use this for kids' drawings?",
                  a: "Yes. Use the kids' drawing preset. It simplifies uneven lines and reduces tiny marks so the result is easier to use for Cricut crafts.",
                },
                {
                  q: "Is the output a real SVG?",
                  a: "Yes. The result is an SVG file with vector paths that can be downloaded, copied, and uploaded to Cricut Design Space.",
                },
                {
                  q: "Why did my pencil sketch not convert well?",
                  a: "Faint pencil marks are low contrast. Try the pencil sketch or low contrast preset, raise threshold, and use a brighter scan or photo.",
                },
              ].map((x) => (
                <article
                  key={x.q}
                  itemScope
                  itemType="https://schema.org/Question"
                  itemProp="mainEntity"
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h4
                    itemProp="name"
                    className="m-0 font-semibold text-sky-950"
                  >
                    {x.q}
                  </h4>

                  <p
                    itemScope
                    itemType="https://schema.org/Answer"
                    itemProp="acceptedAnswer"
                    className="mt-2 text-sm leading-6 text-slate-600"
                  >
                    <span itemProp="text">{x.a}</span>
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
