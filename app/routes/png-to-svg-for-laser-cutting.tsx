import * as React from "react";
import type { Route } from "./+types/png-to-svg-for-laser-cutting";
import {
  json,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { useFetcher, type ActionFunctionArgs } from "react-router";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { useState } from "react";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import { ChevronDownIcon } from "./home";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";

/** Stable server flag: true on SSR render, false in client bundle */
const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "PNG to SVG for Laser Cutting | Free Vector Cut File Converter";
  const description =
    "Convert PNG and JPG artwork into clean SVG vector paths for laser cutting, scoring, and engraving. Tune presets for wood, acrylic, cardstock, stencils, logos, and maker projects.";
  const canonical = "https://www.ilovesvg.com/png-to-svg-for-laser-cutting";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    {
      name: "keywords",
      content:
        "png to svg for laser cutting, laser cut svg converter, png to laser svg, jpg to svg for laser cutting, laser cutter svg maker, image to svg laser cutter, svg cut file converter, laser engraving svg",
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
   Limits & types (mirrored client/server)
======================== */
// Client submits ≤25MB for live preview. Allow a little overhead for multipart.
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB
const MAX_MP = 30; // ~30 megapixels
const MAX_SIDE = 8000; // max width or height in pixels
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

// Dark background default for invert "white on dark"
const DARK_BG_DEFAULT = "#0b1020";

// -------- Live preview tiers (client) --------
// ≤10MB: fast,  10-25MB: throttled. >25MB → attempt client auto-compress to ≤25MB; if not possible, block with message.
const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 400;
const LIVE_MED_MS = 1500;

// -------- Concurrency gate (server) --------
type ReleaseFn = () => void;
type Gate = {
  acquireOrQueue: () => Promise<ReleaseFn>;
  running: number;
  queued: number;
};
async function getGate(): Promise<Gate> {
  const g = globalThis as any;
  if (g.__iheartsvg_gate) return g.__iheartsvg_gate as Gate;

  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  let cpuCount = 1;
  try {
    const os = req("os") as typeof import("os");
    cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 1;
  } catch {}
  const MAX = Math.max(1, Math.min(2, cpuCount)); // N=1 on 1 vCPU; N=2 on 2+ vCPU
  const QUEUE_MAX = 8; // small fairness queue
  const EST_JOB_MS = 3000; // rough estimate used to compute Retry-After

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

  g.__iheartsvg_gate = new SimpleGate(MAX, QUEUE_MAX);
  return g.__iheartsvg_gate as Gate;
}

/* ========================
   Action: Potrace (RAM-only)
   + Optional server-side "Edge" preprocessor via sharp
   + Concurrency gate with 429 + Retry-After when saturated

   IMPORTANT:
   We treat `invert` as OUTPUT "white on dark" mode (not potrace invert),
   to avoid blank results. We force a visible background and recolor paths.
======================== */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // --- Guard: method ---
    if (request.method.toUpperCase() !== "POST") {
      return json(
        { error: "Method not allowed" },
        { status: 405, headers: { Allow: "POST" } },
      );
    }

    // --- Guard: content type ---
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data")) {
      return json(
        { error: "Unsupported content type. Use multipart/form-data." },
        { status: 415 },
      );
    }

    // --- Early reject: don't parse multipart if request is huge ---
    const contentLength = Number(request.headers.get("content-length") || "0");
    const MAX_OVERHEAD = 5 * 1024 * 1024;
    if (contentLength && contentLength > MAX_UPLOAD_BYTES + MAX_OVERHEAD) {
      return json(
        {
          error:
            "Upload too large for live conversion. Please resize and try again.",
        },
        { status: 413 },
      );
    }

    // Parse multipart with strict per-part limit (RAM upload handler)
    const uploadHandler = createMemoryUploadHandler({
      maxPartSize: MAX_UPLOAD_BYTES,
    });
    const form = await parseMultipartFormData(request, uploadHandler);

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return json({ error: "No file uploaded." }, { status: 400 });
    }

    // Basic type/size checks (authoritative)
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

    // ----- Acquire concurrency slot BEFORE reading bytes into RAM -----
    const gate = await getGate();
    let release: ReleaseFn | null = null;

    try {
      release = await gate.acquireOrQueue();
    } catch (e: any) {
      const retryAfterMs = Math.max(1000, Number(e?.retryAfterMs) || 1500);
      return json(
        {
          error:
            "Server is busy converting other images. We'll retry automatically.",
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
      // NOW read original bytes into Buffer (RAM-heavy)
      const ab = await webFile.arrayBuffer();
      // @ts-ignore Buffer exists in Remix node runtime
      let input: Buffer = Buffer.from(ab);

      // --- Authoritative megapixel/side guard (cheap header decode via sharp) ---
      try {
        const { createRequire } = await import("node:module");
        const req = createRequire(import.meta.url);
        const sharp = req("sharp") as typeof import("sharp");
        const meta = await sharp(input).metadata();
        const w = meta.width ?? 0;
        const h = meta.height ?? 0;

        if (!w || !h) {
          return json(
            { error: "Could not read image dimensions. Try a different file." },
            { status: 415 },
          );
        }

        const mp = (w * h) / 1_000_000;
        if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
          return json(
            {
              error: `Image too large: ${w}×${h} (~${mp.toFixed(
                1,
              )} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
            },
            { status: 413 },
          );
        }
      } catch {
        // If sharp metadata fails here, continue - Potrace may still handle small files.
      }

      // Potrace params
      const threshold = Number(form.get("threshold") ?? 224);
      const turdSize = Number(form.get("turdSize") ?? 2);
      const optTolerance = Number(form.get("optTolerance") ?? 0.28);
      const turnPolicy = String(form.get("turnPolicy") ?? "minority") as
        | "black"
        | "white"
        | "left"
        | "right"
        | "minority"
        | "majority";

      // We interpret invert as output "white on dark"
      const whiteOnDark =
        String(form.get("invert") ?? "false").toLowerCase() === "true";

      // Path color the user requested
      let lineColor = String(form.get("lineColor") ?? "#ff0000");
      const outputMode = String(
        form.get("outputMode") ?? "cut-line",
      ) as OutputMode;
      const strokeWidth = Math.max(
        0.01,
        Math.min(5, Number(form.get("strokeWidth") ?? 0.1)),
      );

      // Background
      let transparent =
        String(form.get("transparent") ?? "true").toLowerCase() === "true";
      let bgColor = String(form.get("bgColor") ?? "#ffffff");

      // Preprocess (for photos)
      const preprocess = String(form.get("preprocess") ?? "none") as
        | "none"
        | "edge";
      const blurSigma = Number(form.get("blurSigma") ?? 0.8);
      const edgeBoost = Number(form.get("edgeBoost") ?? 1.0);

      // Force sensible output for white-on-dark
      if (whiteOnDark) {
        transparent = false;
        if (
          !bgColor ||
          bgColor.toLowerCase() === "#ffffff" ||
          bgColor.toLowerCase() === "#fff"
        ) {
          bgColor = DARK_BG_DEFAULT;
        }
        // If they didn't set a visible line, force white
        if (!lineColor || lineColor.toLowerCase() === "#000000") {
          lineColor = "#ffffff";
        }
      }

      // Normalize for Potrace
      const prepped = await normalizeForPotrace(input, {
        preprocess,
        blurSigma,
        edgeBoost,
      });

      // Potrace (CJS API)
      const potrace = await import("potrace");
      const traceFn: any = (potrace as any).trace;
      const PotraceClass: any = (potrace as any).Potrace;

      // IMPORTANT: do NOT use potrace invert for white-on-dark output mode
      // We trace as black, then recolor paths.
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

      // Post-process SVG safely (defensive)
      const safeSvg = coerceSvg(svgRaw);
      const ensured = ensureViewBoxResponsive(safeSvg);
      const svg2 =
        outputMode === "engrave-fill"
          ? recolorPaths(ensured.svg, lineColor)
          : convertPathsToStroke(ensured.svg, lineColor, strokeWidth);
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
      { error: err?.message || "Server error during conversion." },
      { status: 500 },
    );
  }
}

/* ---------- Image normalization for Potrace (server-side, robust) ---------- */
async function normalizeForPotrace(
  input: Buffer,
  opts: { preprocess: "none" | "edge"; blurSigma: number; edgeBoost: number },
): Promise<Buffer> {
  try {
    // Lazy CJS import so this never leaks into client bundle
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const sharp = req("sharp") as typeof import("sharp");

    // Keep cache tiny for small droplets (best-effort)
    try {
      (sharp as any).concurrency?.(1);
      (sharp as any).cache?.({ files: 0, memory: 32 }); // even smaller
    } catch {}

    // Decode + respect EXIF
    let base = sharp(input).rotate();

    // Soft guard to avoid OOM
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

      const src = data as Buffer; // 1 channel enforced by grayscale above
      const out = Buffer.alloc(W * H, 255);

      const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          let gx = 0,
            gy = 0,
            n = 0;
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
          out[y * W + x] = 255 - m; // edges dark, background light
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

    // Plain grayscale prep
    return await base
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .removeAlpha()
      .grayscale()
      .gamma()
      .normalize()
      .png()
      .toBuffer();
  } catch {
    // If sharp is not available or fails, just return original
    return input;
  }
}

/** Heuristic: flat if min==max OR very low variance OR mean near 0 or 255. */
function isFlatBuffer(buf: Buffer, sampleStep = 53): boolean {
  const len = buf.length;
  if (len === 0) return true;

  let min = 255,
    max = 0,
    sum = 0,
    count = 0;
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

/* ---------- SVG helpers (Node-safe, no DOMParser) ---------- */
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
  let width = widthMatch ? Number(widthMatch[1]) : 1024;
  let height = heightMatch ? Number(heightMatch[1]) : 1024;

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

function convertPathsToStroke(
  svg: string,
  strokeColor: string,
  strokeWidth: number,
): string {
  return svg.replace(/<path\b([^>]*)>/gi, (_m, attrs) => {
    const nextAttrs = String(attrs)
      .replace(/\sfill\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sstroke\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sstroke-width\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sstroke-linejoin\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sstroke-linecap\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\s*\/\s*$/g, "");

    return `<path${nextAttrs} fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  });
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
   UI (types)
======================== */
type OutputMode = "cut-line" | "engrave-fill" | "score-line";

type Settings = {
  outputMode: OutputMode;
  strokeWidth: number;
  threshold: number;
  turdSize: number;
  optTolerance: number;
  turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  lineColor: string;
  invert: boolean;

  // background
  transparent: boolean;
  bgColor: string;

  // preprocess
  preprocess: "none" | "edge";
  blurSigma: number;
  edgeBoost: number;
};

type Preset = {
  id: string;
  label: string;
  settings: Partial<Settings>;
};

const PRESETS: Preset[] = [
  {
    id: "laser-cut-clean",
    label: "Laser Cut  -  Clean Outline (default)",
    settings: {
      outputMode: "cut-line",
      strokeWidth: 1,
      preprocess: "none",
      threshold: 224,
      turdSize: 3,
      optTolerance: 0.36,
      turnPolicy: "majority",
      lineColor: "#ff0000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "wood-cut-bold",
    label: "Wood Cut  -  Bold Shapes",
    settings: {
      outputMode: "cut-line",
      strokeWidth: 1,
      preprocess: "none",
      threshold: 214,
      turdSize: 5,
      optTolerance: 0.48,
      turnPolicy: "black",
      lineColor: "#ff0000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "acrylic-smooth",
    label: "Acrylic  -  Smooth Curves",
    settings: {
      outputMode: "cut-line",
      strokeWidth: 1,
      preprocess: "none",
      threshold: 218,
      turdSize: 4,
      optTolerance: 0.55,
      turnPolicy: "majority",
      lineColor: "#ff0000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "cardstock-paper",
    label: "Cardstock  -  Fewer Tiny Cuts",
    settings: {
      outputMode: "cut-line",
      strokeWidth: 1,
      preprocess: "none",
      threshold: 216,
      turdSize: 7,
      optTolerance: 0.62,
      turnPolicy: "majority",
      lineColor: "#ff0000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "engrave-fill-logo",
    label: "Engrave  -  Filled Logo",
    settings: {
      outputMode: "engrave-fill",
      strokeWidth: 1,
      preprocess: "none",
      threshold: 226,
      turdSize: 3,
      optTolerance: 0.32,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "score-line-blue",
    label: "Score Line  -  Blue Preview",
    settings: {
      outputMode: "score-line",
      strokeWidth: 1,
      preprocess: "none",
      threshold: 230,
      turdSize: 2,
      optTolerance: 0.28,
      turnPolicy: "minority",
      lineColor: "#0057ff",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "stencil-cut",
    label: "Stencil  -  Solid Shapes",
    settings: {
      outputMode: "cut-line",
      strokeWidth: 1,
      preprocess: "none",
      threshold: 208,
      turdSize: 6,
      optTolerance: 0.52,
      turnPolicy: "black",
      lineColor: "#ff0000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "logo-clean-cut",
    label: "Logo  -  Clean Vector Paths",
    settings: {
      outputMode: "cut-line",
      strokeWidth: 1,
      preprocess: "none",
      threshold: 210,
      turdSize: 3,
      optTolerance: 0.32,
      turnPolicy: "majority",
      lineColor: "#ff0000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "thin-detail-cut",
    label: "Thin Details  -  Keep More Lines",
    settings: {
      outputMode: "cut-line",
      strokeWidth: 1,
      preprocess: "none",
      threshold: 238,
      turdSize: 1,
      optTolerance: 0.22,
      turnPolicy: "minority",
      lineColor: "#ff0000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "scan-cleanup",
    label: "Scan  -  Remove Speckles",
    settings: {
      outputMode: "cut-line",
      strokeWidth: 1,
      preprocess: "none",
      threshold: 226,
      turdSize: 6,
      optTolerance: 0.38,
      turnPolicy: "majority",
      lineColor: "#ff0000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "drawing-outline",
    label: "Drawing  -  Outline Trace",
    settings: {
      outputMode: "cut-line",
      strokeWidth: 1,
      preprocess: "edge",
      blurSigma: 1.0,
      edgeBoost: 1.25,
      threshold: 226,
      turdSize: 4,
      optTolerance: 0.4,
      turnPolicy: "majority",
      lineColor: "#ff0000",
      transparent: true,
    },
  },
  {
    id: "dark-material-preview",
    label: "Dark Material  -  Light Preview",
    settings: {
      outputMode: "cut-line",
      strokeWidth: 1,
      preprocess: "none",
      threshold: 224,
      turdSize: 4,
      optTolerance: 0.44,
      turnPolicy: "majority",
      invert: true,
      lineColor: "#ffffff",
      transparent: false,
      bgColor: DARK_BG_DEFAULT,
    },
  },
];

const DEFAULTS: Settings = {
  outputMode: "cut-line",
  strokeWidth: 1,
  threshold: 224,
  turdSize: 3,
  optTolerance: 0.36,
  turnPolicy: "majority",
  lineColor: "#ff0000",
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
};

// ---- tiering helpers (client) ----
type AutoMode = "fast" | "medium" | "off";
function getAutoMode(bytes?: number | null): AutoMode {
  if (bytes == null) return "off";
  if (bytes <= LIVE_FAST_MAX) return "fast";
  if (bytes <= LIVE_MED_MAX) return "medium";
  return "off";
}
function autoModeHint(mode: AutoMode): string {
  if (mode === "medium")
    return "Live preview is throttled for 10-25 MB laser artwork.";
  return "";
}
function autoModeDetail(mode: AutoMode): string {
  if (mode === "medium")
    return "Large laser artwork updates run less frequently to keep tracing stable.";
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
    React.useState<string>("laser-cut-clean");
  const busy = fetcher.state !== "idle";
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  // client-side measured dims
  const [dims, setDims] = React.useState<{
    w: number;
    h: number;
    mp: number;
  } | null>(null);

  // Hydration guard
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  // Attempts history
  const [history, setHistory] = React.useState<HistoryItem[]>([]);

  // Live preview tier
  const [autoMode, setAutoMode] = React.useState<AutoMode>("off");

  // When a new server SVG arrives, push to history
  React.useEffect(() => {
    if (fetcher.data?.svg) {
      const item: HistoryItem = {
        svg: fetcher.data.svg,
        width: fetcher.data.width ?? 0,
        height: fetcher.data.height ?? 0,
        stamp: Date.now(),
      };
      setHistory((prev) => [item, ...prev].slice(0, 10));
    }
  }, [fetcher.data?.svg, fetcher.data?.width, fetcher.data?.height]);

  React.useEffect(() => {
    if (!fetcher.data?.error) return;

    if (fetcher.data.code === "BUSY" && file) {
      const retryAfterMs = Math.max(1000, fetcher.data.retryAfterMs ?? 1500);
      setInfo("Server is busy. Retrying conversion automatically...");
      const t = setTimeout(() => submitConvert(), retryAfterMs);
      return () => clearTimeout(t);
    }

    setErr(fetcher.data.error);
  }, [fetcher.data?.error, fetcher.data?.code, fetcher.data?.retryAfterMs]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

    // Stop live preview while we swap state
    suppressLiveRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Clear current file first so nothing submits with the old one
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);

    // Reset settings/results for the new upload
    setSettings(DEFAULTS);
    setActivePreset("laser-cut-clean");
    setHistory([]); // optional, remove if you want to keep old results

    setErr(null);
    setInfo(null);
    setDims(null);
    setOriginalFileSize(f.size);

    let chosen = f;

    if (chosen.size > LIVE_MED_MAX) {
      try {
        setInfo(
          "Large file detected. Compressing locally before laser preview...",
        );
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

    // Re-enable live preview and force one conversion for the new file
    suppressLiveRef.current = false;
    setTimeout(() => submitConvert(chosen, DEFAULTS), 0);
  }

  async function submitConvert(
    fileOverride?: File,
    settingsOverride?: Settings,
  ) {
    const targetFile = fileOverride ?? file;
    const targetSettings = settingsOverride ?? settings;

    if (!targetFile) {
      setErr("Choose an image first.");
      return;
    }

    // Client-side precheck
    try {
      await validateBeforeSubmit(targetFile);
    } catch (e: any) {
      setErr(e?.message || "Image is too large.");
      return;
    }

    // Ensure invert always produces visible output (white on dark)
    const effective = (() => {
      if (!targetSettings.invert) return targetSettings;
      const bg =
        !targetSettings.bgColor ||
        targetSettings.bgColor.toLowerCase() === "#ffffff" ||
        targetSettings.bgColor.toLowerCase() === "#fff"
          ? DARK_BG_DEFAULT
          : targetSettings.bgColor;

      return {
        ...targetSettings,
        transparent: false,
        bgColor: bg,
        lineColor:
          targetSettings.lineColor?.toLowerCase() === "#000000"
            ? "#ffffff"
            : targetSettings.lineColor,
      };
    })();

    const fd = new FormData();
    fd.append("file", targetFile);
    fd.append("threshold", String(effective.threshold));
    fd.append("turdSize", String(effective.turdSize));
    fd.append("optTolerance", String(effective.optTolerance));
    fd.append("turnPolicy", effective.turnPolicy);
    fd.append("lineColor", effective.lineColor);
    fd.append("outputMode", effective.outputMode);
    fd.append("strokeWidth", String(effective.strokeWidth));
    fd.append("invert", String(effective.invert));
    fd.append("transparent", String(effective.transparent));
    fd.append("bgColor", effective.bgColor);
    fd.append("preprocess", effective.preprocess);
    fd.append("blurSigma", String(effective.blurSigma));
    fd.append("edgeBoost", String(effective.edgeBoost));
    setErr(null);

    // Target this route's index action
    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action: `${window.location.pathname}?index`,
    });
  }

  // ---- Tiered live preview (always live for allowed sizes; throttled >10MB) ----
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressLiveRef = React.useRef(false);

  React.useEffect(() => {
    if (suppressLiveRef.current) return;
    if (!file) return;

    const mode = autoMode;
    if (mode === "off") return; // file >25MB and not compressible - no auto submit

    const delay = mode === "fast" ? LIVE_FAST_MS : LIVE_MED_MS;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      submitConvert();
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, settings, activePreset, autoMode]);

  // Disable logic identical on SSR and first client render
  const buttonDisabled = isServer || !hydrated || busy || !file;

  // Apply preset without carrying user overrides except background choices
  function applyPreset(preset: Preset) {
    setActivePreset(preset.id);
    setSettings((s) => {
      const baseline: Settings = {
        ...DEFAULTS,
        transparent: s.transparent,
        bgColor: s.bgColor,
      };
      const lineColor =
        preset.settings.lineColor !== undefined
          ? preset.settings.lineColor
          : s.lineColor;

      return {
        ...baseline,
        lineColor,
        ...preset.settings,
      } as Settings;
    });
  }

  const [toast, setToast] = React.useState<string | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  function handleCopySvg(svg: string) {
    navigator.clipboard.writeText(svg).then(() => {
      showToast("SVG copied");
    });
  }

  return (
    <>
      <main className=" bg-slate-50 text-slate-900">
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
            {/* INPUT */}
            <div className="bg-white sm:border sm:border-slate-200 rounded-xl p-4 sm:shadow-sm overflow-hidden min-w-0">
              <h1 className="inline-flex text-center w-full justify-center mb-2 text-sky-950 items-center gap-2 text-xl sm:text-3xl font-extrabold leading-none m-0">
                PNG to SVG for Laser Cutting
              </h1>
              <p className="mb-3 text-sm text-slate-600 text-center">
                Create clean vector paths from PNG or JPG artwork for laser
                cutting, scoring, and engraving. Best for wood, acrylic,
                cardstock, stencils, signs, labels, and maker projects.
              </p>

              <PresetPicker
                presets={PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />

              <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-slate-700">
                <span className="font-semibold text-sky-950">
                  What this creates:
                </span>{" "}
                SVG vector paths for cut, score, or engrave workflows. Machine
                power, speed, kerf, material thickness, and operation mapping
                still need to be set in your laser software.
              </div>

              {/* Settings */}
              <div className="mt-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="mb-2 w-full inline-flex items-center justify-between px-3 py-1.5 rounded-md border border-slate-200 bg-sky-50 text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                  aria-expanded={showAdvanced}
                  aria-controls="advanced-settings"
                >
                  <span className="inline-flex items-center gap-2">
                    Advanced settings
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
                    {/* ⬇️ PASTE YOUR EXISTING BLOCK HERE ⬇️ */}

                    <Field label="Output mode">
                      <select
                        value={settings.outputMode}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            outputMode: e.target.value as OutputMode,
                            lineColor:
                              e.target.value === "engrave-fill"
                                ? "#000000"
                                : e.target.value === "score-line"
                                  ? "#0057ff"
                                  : "#ff0000",
                          }))
                        }
                        className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <option value="cut-line">
                          Cut line (stroke, no fill)
                        </option>
                        <option value="score-line">
                          Score line (blue stroke)
                        </option>
                        <option value="engrave-fill">
                          Engrave fill (filled shape)
                        </option>
                      </select>
                    </Field>

                    {settings.outputMode !== "engrave-fill" && (
                      <Field label="Stroke width">
                        <Num
                          value={settings.strokeWidth}
                          min={0.01}
                          max={5}
                          step={0.01}
                          onChange={(v) =>
                            setSettings((s) => ({ ...s, strokeWidth: v }))
                          }
                        />
                      </Field>
                    )}

                    <Field label="Preprocess">
                      <select
                        value={settings.preprocess}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            preprocess: e.target.value as any,
                          }))
                        }
                        className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <option value="none">None (lineart)</option>
                        <option value="edge">Edge (photo/painting)</option>
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
                            max={2.0}
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
                        className="w-full accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Turd size">
                      <Num
                        value={settings.turdSize}
                        min={0}
                        max={10}
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

                    <Field label="Turn policy">
                      <select
                        value={settings.turnPolicy}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            turnPolicy: e.target.value as any,
                          }))
                        }
                        className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <option value="black">black</option>
                        <option value="white">white</option>
                        <option value="left">left</option>
                        <option value="right">right</option>
                        <option value="minority">minority</option>
                        <option value="majority">majority</option>
                      </select>
                    </Field>

                    <Field label="Path color">
                      <input
                        type="color"
                        value={settings.lineColor}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            lineColor: e.target.value,
                          }))
                        }
                        className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer"
                      />
                    </Field>

                    <Field label="Invert trace">
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

                    {/* ⬆️ END EXISTING BLOCK ⬆️ */}
                  </div>
                )}
              </div>

              {/* Dropzone */}
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

              {/* Convert button + errors + tier hints */}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => submitConvert()}
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
                  {busy ? "Converting…" : "Convert to Laser SVG"}
                </button>

                {/* Live preview tier notice */}
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

              {/* Input preview below controls */}
              {previewUrl && (
                <div className="hidden md:flex flex-col mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <p className="text-slate-700 ml-2 mt-1">
                    {" "}
                    Original Laser Artwork Preview:
                  </p>
                  <img
                    src={previewUrl}
                    alt="Input"
                    className="w-full h-auto block"
                  />
                </div>
              )}
            </div>

            {/* RESULTS */}
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
                            a.download = "laser-cut-file.svg";
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
                          Download Laser SVG
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
                          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                            item.svg,
                          )}`}
                          alt="SVG result"
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
                  {busy ? "Converting…" : "Laser SVG previews appear here..."}
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed right-4 bottom-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[1000]">
            {toast}
          </div>
        )}
      </main>
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

/* ===== Client-side helpers (dimension precheck + compression ≤25MB) ===== */
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

/** Compress to ≤25MB (best effort). Converts PNG→JPEG if necessary for size.
 *  Strategy: try JPEG quality steps; if still large, progressively scale down. */
async function compressToTarget25MB(file: File): Promise<File> {
  const TARGET = LIVE_MED_MAX; // 25MB
  if (file.size <= TARGET) return file;
  if (!file.type.startsWith("image/"))
    throw new Error("Unsupported file type for compression.");

  const img =
    "createImageBitmap" in window
      ? await createImageBitmap(file)
      : await loadImageElement(file);

  // Start with original dims; scale down gradually as needed
  let w = img.width;
  let h = img.height;

  // Helper to encode current canvas as JPEG with provided quality
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
        // OffscreenCanvas path
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

  // Heuristic: first try quality-only reductions, then scale down by 85% steps
  const qualities = [0.9, 0.8, 0.7, 0.6, 0.5];
  for (const q of qualities) {
    const b = await encode(q);
    if (b.size <= TARGET) {
      return new File([b], renameToJpeg(file.name), { type: "image/jpeg" });
    }
  }

  // Still too large → scale down progressively + mid quality
  let scale = 0.9;
  while (w > 64 && h > 64) {
    w = Math.max(64, Math.floor(w * scale));
    h = Math.max(64, Math.floor(h * scale));
    const b = await encode(0.75);
    if (b.size <= TARGET) {
      return new File([b], renameToJpeg(file.name), { type: "image/jpeg" });
    }
    // tighten both quality and scale over time
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

/* ===== UI helpers ===== */
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
  let v = bytes,
    i = 0;
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
          <header className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 md:p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                PNG/JPG to SVG for laser cutting
              </p>
              <h2 className="text-sky-950 text-2xl md:text-3xl font-bold leading-tight">
                Create cleaner vector paths for laser cut, score, and engrave
                projects
              </h2>
              <p className="text-slate-600">
                This converter turns PNG or JPG artwork into SVG vector paths
                for laser cutter workflows. Use cut-line mode for outlines,
                score-line mode for guide marks, and engrave-fill mode when you
                want filled vector shapes for marking or engraving.
              </p>
              <p className="text-slate-600">
                It works best with simple high-contrast artwork: logos,
                silhouettes, signs, ornaments, labels, stencils, templates,
                acrylic shapes, wood cutouts, cardstock designs, and maker
                projects.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { k: "Cut paths", v: "Stroke output for outlines" },
                  { k: "Engrave fills", v: "Filled vector shapes" },
                  { k: "Cleanup controls", v: "Reduce speckles and noise" },
                  { k: "Laser-focused", v: "Wood, acrylic, paper, stencils" },
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

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sky-950 text-lg font-bold">
              Best for laser-ready vector paths
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This page creates traced SVG paths from raster artwork. It is
              useful for laser cutting outlines, scoring guide paths, and filled
              engrave shapes. It does not set your machine power, speed, kerf,
              material thickness, or origin. Always test your SVG in your laser
              software before cutting expensive material.
            </p>
          </section>

          <section className="mt-8">
            <h3 className="text-sky-950 text-lg font-bold">Best laser uses</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Wood cutouts",
                "Acrylic shapes",
                "Cardstock projects",
                "Stencil templates",
                "Signs and plaques",
                "Logo engraving",
                "Ornaments",
                "Maker templates",
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
                How to convert PNG to SVG for laser cutting
              </h3>
              <span className="text-xs text-slate-500">
                Upload → choose laser preset → tune paths → download SVG
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload a PNG or JPG design",
                  body: "Use clean, high-contrast artwork when possible. Simple shapes, logos, icons, stencils, and silhouettes trace better than busy photos.",
                },
                {
                  title: "Choose a laser preset",
                  body: "Start with Clean Outline for general cutting, Engrave Filled Logo for filled shapes, or Score Line when you need guide paths.",
                },
                {
                  title: "Pick cut, score, or engrave output",
                  body: "Cut and score modes export stroked paths with no fill. Engrave mode exports filled vector shapes.",
                },
                {
                  title: "Tune cleanup and smoothness",
                  body: "Use threshold, turd size, curve tolerance, and turn policy to reduce speckles, remove tiny fragments, and smooth rough traces.",
                },
                {
                  title: "Check the SVG in your laser software",
                  body: "Import the SVG into your laser cutter software and assign power, speed, material, kerf, and operation settings there.",
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
              Laser settings explained
            </h3>
            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Output mode",
                  body: "Cut line and score line create stroked paths with no fill. Engrave fill creates filled shapes.",
                },
                {
                  title: "Stroke width",
                  body: "Controls preview thickness for cut and score paths. Your laser software may use its own line-width rules.",
                },
                {
                  title: "Threshold",
                  body: "Controls what becomes vector material. Higher includes lighter pixels; lower keeps only darker, stronger shapes.",
                },
                {
                  title: "Turd size",
                  body: "Removes small speckles and dust that can become unwanted tiny cut paths.",
                },
                {
                  title: "Curve tolerance",
                  body: "Higher values simplify paths and smooth curves. Lower values keep more detail but may create heavier SVGs.",
                },
                {
                  title: "Preprocess edge mode",
                  body: "Useful for drawings or rough artwork when you want outlines instead of filled regions.",
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
              Important laser expectation
            </h3>
            <p className="mt-2 text-sm text-slate-700">
              This converter prepares SVG geometry only. It does not know your
              machine, material, lens, kerf, power, speed, pass count, air
              assist, or bed setup. Use the SVG as a starting point, then
              configure the real laser settings inside your laser cutter
              software.
            </p>
          </section>

          <section className="mt-12">
            <h3 className="text-sky-950 text-lg font-bold">FAQ</h3>
            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "Does this create a laser-ready SVG?",
                  a: "It creates vector SVG paths suitable for import into laser software. You still need to assign cut, score, or engrave operations and machine settings in your laser program.",
                },
                {
                  q: "Should I use cut line or engrave fill?",
                  a: "Use cut line for outlines and shapes you want the laser to follow. Use engrave fill when you want filled vector regions for marking or engraving.",
                },
                {
                  q: "Does it preserve image colors?",
                  a: "No. This page is for traced laser paths. Use color only as a path preview or operation cue. It is not a full-color vectorizer.",
                },
                {
                  q: "Why did tiny details disappear?",
                  a: "The cleanup settings remove small fragments that usually become bad laser paths. Lower turd size and curve tolerance if those details matter.",
                },
                {
                  q: "Is this tied to a specific laser brand?",
                  a: "No. iLoveSVG is an independent SVG utility site. Always verify import behavior in your own laser software.",
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
  activePreset: string | null;
  applyPreset: (p: Preset) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const DEFAULT_VISIBLE = 2; // 3 rows × 2 columns
  const visiblePresets = expanded ? presets : presets.slice(0, DEFAULT_VISIBLE);

  const showToggle = presets.length > DEFAULT_VISIBLE;

  return (
    <div className="mb-2 mt-[.67rem] min-w-0">
      {/* Always 2 columns */}
      <div className="grid sm:grid-cols-2 gap-2">
        {visiblePresets.map((p) => {
          const isActive = activePreset === p.id;

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              aria-pressed={isActive}
              title={p.label}
              className={[
                "px-3 py-2 rounded-md border transition cursor-pointer",
                "text-[13px] sm:text-sm leading-snug text-center font-semibold",
                "break-words min-h-[2.75rem]",
                isActive
                  ? "bg-sky-200  border-sky-200"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-sky-50",
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
          aria-expanded={expanded}
          className="mt-2 w-full inline-flex items-center justify-between px-3 py-2 rounded-md border border-slate-200 bg-sky-50 text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
        >
          <span className="flex items-center justify-center text-sm font-medium">
            <Icons name="sliders" size={16} className="inline-block mr-1" />
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
