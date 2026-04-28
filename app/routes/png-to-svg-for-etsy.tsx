import * as React from "react";
import type { Route } from "./+types/png-to-svg-for-etsy";
import {
  json,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { Link, useFetcher, type ActionFunctionArgs } from "react-router";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { useState } from "react";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";

/** Stable server flag: true on SSR render, false in client bundle */
const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "PNG to SVG for Etsy | Free Etsy SVG Converter - iLoveSVG";
  const description =
    "Convert PNG and JPG designs into clean SVG files for Etsy digital downloads, stickers, decals, logos, and printable artwork. Free PNG to SVG converter with live preview.";
  const canonical = "https://www.ilovesvg.com/png-to-svg-for-etsy";

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
      let lineColor = String(form.get("lineColor") ?? "#000000");

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
type Settings = {
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
    id: "line-accurate",
    label: "Etsy PNG  -  Accurate trace (default)",
    settings: {
      preprocess: "none",
      threshold: 224,
      turdSize: 2,
      optTolerance: 0.28,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "line-bold",
    label: "Etsy Sticker  -  Bold outline",
    settings: {
      preprocess: "none",
      threshold: 212,
      turdSize: 3,
      optTolerance: 0.38,
      turnPolicy: "majority",
    },
  },
  {
    id: "line-fine",
    label: "Etsy Detail  -  Fine lines",
    settings: {
      preprocess: "none",
      threshold: 232,
      turdSize: 1,
      optTolerance: 0.22,
      turnPolicy: "minority",
    },
  },
  {
    id: "line-gap",
    label: "Cut File  -  Seal gaps",
    settings: {
      preprocess: "none",
      threshold: 218,
      turdSize: 3,
      optTolerance: 0.34,
      turnPolicy: "black",
    },
  },
  {
    id: "photo-soft",
    label: "Photo Edge  -  Soft",
    settings: {
      preprocess: "edge",
      blurSigma: 1.2,
      edgeBoost: 0.9,
      threshold: 210,
      turdSize: 2,
      optTolerance: 0.35,
    },
  },
  {
    id: "photo-normal",
    label: "Photo Edge  -  Normal",
    settings: {
      preprocess: "edge",
      blurSigma: 0.9,
      edgeBoost: 1.1,
      threshold: 220,
      turdSize: 2,
      optTolerance: 0.35,
    },
  },
  {
    id: "photo-bold",
    label: "Photo Edge  -  Bold",
    settings: {
      preprocess: "edge",
      blurSigma: 0.6,
      edgeBoost: 1.4,
      threshold: 230,
      turdSize: 3,
      optTolerance: 0.4,
    },
  },
  {
    id: "edge-clean",
    label: "Edge  -  Clean",
    settings: {
      preprocess: "edge",
      blurSigma: 0.8,
      edgeBoost: 1.2,
      threshold: 236,
      turdSize: 2,
      optTolerance: 0.45,
    },
  },
  {
    id: "scan-clean",
    label: "Scan  -  Clean (remove speckles)",
    settings: {
      preprocess: "none",
      threshold: 226,
      turdSize: 4,
      optTolerance: 0.3,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "scan-aggressive",
    label: "Scan  -  Aggressive (close gaps)",
    settings: {
      preprocess: "none",
      threshold: 218,
      turdSize: 5,
      optTolerance: 0.42,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "logo-clean",
    label: "Etsy Logo  -  Clean shapes",
    settings: {
      preprocess: "none",
      threshold: 210,
      turdSize: 2,
      optTolerance: 0.25,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "logo-thin",
    label: "Etsy Logo  -  Thin details",
    settings: {
      preprocess: "none",
      threshold: 238,
      turdSize: 1,
      optTolerance: 0.2,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "noisy-denoise",
    label: "Noisy Photo  -  Denoise Edge",
    settings: {
      preprocess: "edge",
      blurSigma: 1.6,
      edgeBoost: 1.25,
      threshold: 222,
      turdSize: 3,
      optTolerance: 0.38,
      turnPolicy: "majority",
    },
  },
  {
    id: "low-contrast",
    label: "Low-contrast Photo  -  Boost edges",
    settings: {
      preprocess: "edge",
      blurSigma: 1.0,
      edgeBoost: 1.6,
      threshold: 228,
      turdSize: 2,
      optTolerance: 0.36,
    },
  },
  {
    id: "invert-white-on-black",
    label: "Invert  -  White lines on black",
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
    id: "comics-inks",
    label: "Comics  -  Inks (chunky)",
    settings: {
      preprocess: "edge",
      blurSigma: 0.7,
      edgeBoost: 1.5,
      threshold: 234,
      turdSize: 3,
      optTolerance: 0.48,
      turnPolicy: "black",
      lineColor: "#000000",
    },
  },
  {
    id: "blueprint",
    label: "Diagram  -  Blueprint (invert + blue)",
    settings: {
      preprocess: "none",
      threshold: 230,
      turdSize: 2,
      optTolerance: 0.3,
      turnPolicy: "minority",
      invert: true,
      lineColor: "#0ea5e9",
      transparent: false,
      bgColor: DARK_BG_DEFAULT,
    },
  },
  {
    id: "whiteboard",
    label: "Whiteboard  -  Anti-glare",
    settings: {
      preprocess: "edge",
      blurSigma: 1.3,
      edgeBoost: 1.15,
      threshold: 220,
      turdSize: 2,
      optTolerance: 0.34,
      turnPolicy: "majority",
      lineColor: "#0f172a",
    },
  },
];

const DEFAULTS: Settings = {
  threshold: 224,
  turdSize: 2,
  optTolerance: 0.28,
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
  if (mode === "medium") return "Live preview is throttled for 10-25 MB files.";
  return "";
}
function autoModeDetail(mode: AutoMode): string {
  if (mode === "medium")
    return "Large file; updates run less frequently to keep things smooth.";
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
    React.useState<string>("line-accurate");
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

  React.useEffect(() => {
    if (suppressLiveRef.current) return;
    if (!file) return;

    const mode = autoMode;
    if (mode === "off") return;

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
    setActivePreset("line-accurate");
    setHistory([]); // optional, remove if you want to keep old results

    setErr(null);
    setInfo(null);
    setDims(null);
    setOriginalFileSize(f.size);

    let chosen = f;

    if (chosen.size > LIVE_MED_MAX) {
      try {
        setInfo("Compressing large image locally for smoother preview...");
        chosen = await compressToTarget25MB(chosen);
        setInfo("Large image compressed locally for preview.");
      } catch (e: any) {
        suppressLiveRef.current = false;
        setErr(e?.message || "This image is too large to preview smoothly.");
        setInfo(null);
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
    setTimeout(() => submitConvert(), 0);
  }

  async function submitConvert() {
    if (!file) {
      setErr("Choose an image first.");
      return;
    }

    // Client-side precheck
    try {
      await validateBeforeSubmit(file);
    } catch (e: any) {
      setErr(e?.message || "Image is too large.");
      return;
    }

    // Ensure invert always produces visible output (white on dark)
    const effective = (() => {
      if (!settings.invert) return settings;
      const bg =
        !settings.bgColor ||
        settings.bgColor.toLowerCase() === "#ffffff" ||
        settings.bgColor.toLowerCase() === "#fff"
          ? DARK_BG_DEFAULT
          : settings.bgColor;

      return {
        ...settings,
        transparent: false,
        bgColor: bg,
        lineColor:
          settings.lineColor?.toLowerCase() === "#000000"
            ? "#ffffff"
            : settings.lineColor,
      };
    })();

    const fd = new FormData();
    fd.append("file", file);
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
              <h1 className="inline-flex text-center w-full justify-center mb-3 text-sky-950 items-center gap-2 text-xl sm:text-3xl font-extrabold leading-none m-0">
                PNG to SVG for Etsy
              </h1>

              <PresetPicker
                presets={PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />

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

                    <Field label="Line color">
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
                  onClick={submitConvert}
                  disabled={buttonDisabled}
                  suppressHydrationWarning
                  className={[
                    "flex items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors",
                    "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0]",
                    "disabled:opacity-70 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  <Icons
                    name="convert"
                    size={18}
                    className="mr-1"
                    title="Convert"
                  />
                  {busy ? "Converting…" : "Convert PNG to SVG"}
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
                            a.download = "converted.svg";
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
                  {busy
                    ? "Converting…"
                    : "Converted Etsy SVG files appear here...  "}
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
          {/* Header / Hero */}
          <header className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 md:p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                PNG/JPEG to SVG for Etsy sellers
              </p>
              <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                PNG to SVG for Etsy listings, digital downloads, and shop assets
              </h2>
              <p className="text-slate-600 ">
                Convert PNG or JPEG artwork into clean SVG paths for Etsy-style
                digital products, printable designs, sticker graphics, decals,
                product logos, and simple cut-file preparation. The converter
                keeps the same fast live preview and advanced tracing controls,
                but the guidance is tuned around Etsy seller workflows.
              </p>

              <p className="text-slate-600">
                Upload your artwork, choose a preset that matches the design,
                adjust the trace, then download or copy the SVG. For best
                results, start with high-contrast artwork, logos, text graphics,
                line art, sticker designs, or clean transparent PNGs.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { k: "Etsy-ready SVG", v: "Download clean editable paths" },
                  { k: "Sticker designs", v: "Trace bold outlines and shapes" },
                  { k: "Logo assets", v: "Vectorize shop marks and icons" },
                  { k: "Live preview", v: "Tune before exporting" },
                ].map((x) => (
                  <div
                    key={x.k}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="text-sm font-semibold">{x.k}</div>
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
          <ExampleSvgConversion />

          {/* Use cases */}
          <section className="">
            <h3 className="text-lg font-bold">Best for Etsy sellers</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Digital downloads",
                "Sticker artwork",
                "Decal graphics",
                "Shop logos",
                "Printable art",
                "Simple cut files",
                "Listing mockup assets",
                "Line art bundles",
              ].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold">
                  Stickers, decals, and line art
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Use “Etsy PNG - Accurate trace” for clean artwork and “Etsy
                  Sticker - Bold outline” when the design needs stronger filled
                  shapes. Raise turd size to remove tiny dust specks before
                  listing the SVG as a download.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold">
                  Logos, icons, and shop branding
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Use “Etsy Logo - Clean shapes” for shop marks, icons, and
                  simple product graphics. Lower curve tolerance if the result
                  loses detail, or raise it if the SVG has too many rough nodes.
                </p>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6">
            <h3 className="text-lg font-bold">
              How this Etsy SVG converter works
            </h3>
            <p className="mt-2 text-sm text-slate-700 max-w-[90ch]">
              This tool traces the visible dark and light areas of a PNG or JPEG
              into SVG paths. That means it works best when the source image has
              clear contrast, solid shapes, crisp lettering, or clean line work.
              It is not a magic layered-design generator: a complex full-color
              photo may become a stylized outline instead of a ready-made
              multi-layer SVG.
            </p>
            <div className="mt-4 grid md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold">Upload artwork</div>
                <p className="mt-1 text-sm text-slate-600">
                  Start with a PNG or JPEG up to 30 MB. Transparent PNGs, black
                  line art, logo exports, and high-contrast sticker artwork are
                  the strongest inputs.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold">Tune the trace</div>
                <p className="mt-1 text-sm text-slate-600">
                  Pick an Etsy-focused preset, then adjust threshold, curve
                  tolerance, turd size, color, and background until the preview
                  matches the file you want to sell or edit.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold">Export SVG</div>
                <p className="mt-1 text-sm text-slate-600">
                  Download the SVG or copy the markup. Open it in your design
                  software to inspect paths, resize it, recolor it, or package
                  it with your Etsy digital product files.
                </p>
              </div>
            </div>
          </section>

          {/* HowTo */}
          <section
            itemScope
            itemType="https://schema.org/HowTo"
            className="mt-12"
          >
            <div className="flex items-end justify-between gap-4">
              <h3 itemProp="name" className="text-lg font-bold">
                How to convert PNG to SVG for Etsy
              </h3>
              <span className="text-xs text-slate-500">
                Fast path: upload → preset → tweak → export
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload a PNG or JPEG design",
                  body: "Drag and drop your Etsy artwork, sticker design, logo, printable graphic, or product icon. Large files may be compressed locally for smoother preview up to 25 MB.",
                },
                {
                  title: "Choose an Etsy-focused preset",
                  body: "Use accurate trace for general PNG artwork, bold outline for stickers, seal gaps for simple cut files, or clean logo shapes for shop branding.",
                },
                {
                  title: "Adjust the trace settings",
                  body: "Tune threshold, curve tolerance, turd size, and turn policy. Use these controls to balance clean shapes against fine detail.",
                },
                {
                  title: "Set line color and background",
                  body: "Keep the background transparent for most Etsy downloads, or add a solid background when you need a preview-style SVG asset.",
                },
                {
                  title: "Download the SVG file",
                  body: "Export the SVG and review it in your design software before adding it to a digital download bundle or using it in a listing workflow.",
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
                    <div className="shrink-0 h-8 w-8 rounded-full bg-slate-900 text-white text-sm font-bold grid place-items-center">
                      {i + 1}
                    </div>
                    <div>
                      <div itemProp="name" className="font-semibold">
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

          {/* Etsy guidance */}
          <section className="mt-12">
            <h3 className="text-lg font-bold">
              Tips for better Etsy SVG results
            </h3>
            <p className="mt-2 text-sm text-slate-600 max-w-[80ch]">
              Etsy buyers expect clean, usable files. Before selling a converted
              SVG, open it in your design tool and verify that the paths, line
              thickness, transparency, and scale are what you intended.
            </p>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Use clean source artwork",
                  body: "High-contrast PNGs, black-and-white drawings, lettering, logos, and flat graphics trace better than noisy screenshots or low-resolution photos.",
                },
                {
                  title: "Keep transparency when possible",
                  body: "Transparent SVG output is usually better for Etsy digital downloads because buyers can place the design over different backgrounds.",
                },
                {
                  title: "Check lettering carefully",
                  body: "Text becomes paths after tracing. Inspect letters for filled counters, rough edges, or broken curves before packaging the file.",
                },
                {
                  title: "Do not oversell photo traces",
                  body: "Photo Edge presets can create stylized outlines, but they are not the same as a clean hand-built layered SVG for cutting or printing.",
                },
                {
                  title: "Package with useful formats",
                  body: "Many Etsy sellers include SVG alongside PNG, PDF, DXF, or EPS exports. This page creates SVG only, so create any extra formats in design software.",
                },
                {
                  title: "Test before listing",
                  body: "Open the SVG in the software your buyers are likely to use and confirm the file scales cleanly without unexpected filled areas.",
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold">{c.title}</div>
                  <p className="mt-1 text-sm text-slate-600">{c.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Settings */}
          <section className="mt-12">
            <h3 className="text-lg font-bold">Settings explained</h3>
            <p className="mt-2 text-sm text-slate-600 max-w-[80ch]">
              These controls decide how your PNG or JPEG becomes SVG paths.
              Small changes can make the difference between a usable Etsy file
              and a messy trace.
            </p>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Preprocess",
                  body: "Use None for logos, icons, lettering, and clean line art. Use Edge mode for photos or painted artwork when you want contour-style SVG output.",
                },
                {
                  title: "Threshold",
                  body: "Controls what becomes part of the traced shape. Raise it to include lighter areas; lower it to keep only stronger dark marks.",
                },
                {
                  title: "Curve tolerance",
                  body: "Lower preserves detail. Higher smooths shapes and may reduce SVG file complexity.",
                },
                {
                  title: "Turd size",
                  body: "Removes tiny specks, scanner dust, and accidental texture that you probably do not want in an Etsy download file.",
                },
                {
                  title: "Turn policy",
                  body: "Controls how ambiguous corners resolve. Try a different policy if corners, small holes, or edges look wrong.",
                },
                {
                  title: "Line color, invert, background",
                  body: "Most Etsy SVG downloads should stay transparent. Use line color and invert when creating preview graphics or dark-background assets.",
                },
                {
                  title: "Edge boost and blur σ",
                  body: "In Edge mode, blur reduces noise and edge boost strengthens contours before tracing.",
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold">{c.title}</div>
                  <p className="mt-1 text-sm text-slate-600">{c.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Performance */}
          <section className="mt-12">
            <h3 className="text-lg font-bold">Performance and limits</h3>

            <div className="mt-4 grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-sm font-semibold">Specs</div>
                <dl className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <dt className="text-slate-500">Max file size</dt>
                    <dd className="mt-1 font-semibold">30 MB per image</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <dt className="text-slate-500">Resolution guard</dt>
                    <dd className="mt-1 font-semibold">
                      ~{MAX_MP.toFixed(1)} MP or {MAX_SIDE.toLocaleString()} px
                      per side
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <dt className="text-slate-500">Preview tiers</dt>
                    <dd className="mt-1 font-semibold">
                      Fast ≤10 MB, throttled ≤25 MB
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <dt className="text-slate-500">Large files</dt>
                    <dd className="mt-1 font-semibold">
                      Auto-compress on-device when possible
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-sm font-semibold">Server stability</div>
                <p className="mt-2 text-sm text-slate-700">
                  Vectorization is CPU heavy. We cap concurrent conversions.
                  When busy, you may get <code>429</code> with{" "}
                  <code>Retry-After</code>, and the client retries smoothly.
                </p>
                <p className="mt-3 text-sm text-slate-700">
                  Batch conversion is off because this site is free and the load
                  is not feasible.
                </p>
              </div>
            </div>
          </section>

          {/* Troubleshooting */}
          <section className="mt-12">
            <h3 className="text-lg font-bold">Troubleshooting and tips</h3>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {[
                [
                  "SVG looks messy",
                  "Use a cleaner source PNG, raise turd size, or try a logo/line-art preset instead of a photo edge preset.",
                ],
                [
                  "Tiny dots appear",
                  "Raise turd size or use a scan cleanup preset to remove dust, texture, and accidental specks.",
                ],
                [
                  "Letters fill in",
                  "Lower threshold or try a fine-detail preset. Very small text may need to be rebuilt manually in design software.",
                ],
                [
                  "Edges look jagged",
                  "Increase curve tolerance slightly, or upload a higher-resolution source image.",
                ],
                [
                  "File is too large",
                  "Downscale or crop unused borders. Very large source images can create unnecessarily complex SVG paths.",
                ],
                [
                  "Not suitable as a cut file",
                  "A traced SVG may still need cleanup before cutting. Inspect paths, gaps, overlaps, and small islands before selling it.",
                ],
              ].map(([t, d]) => (
                <div
                  key={t}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold">{t}</div>
                  <p className="mt-1 text-sm text-slate-600">{d}</p>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section
            className="mt-12"
            itemScope
            itemType="https://schema.org/FAQPage"
          >
            <h3 className="text-lg font-bold">Frequently asked questions</h3>

            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "Can I use this SVG converter for Etsy digital downloads?",
                  a: "Yes. It is useful for converting clean PNG or JPEG artwork into SVG paths for Etsy-style digital downloads, stickers, logos, printable graphics, and simple design assets. Always inspect the SVG before selling it.",
                },
                {
                  q: "Will this make a layered SVG for cutting machines?",
                  a: "No. This tool creates traced SVG paths from a raster image. It can be useful for simple cut-file preparation, but complex layered files usually need manual cleanup in design software.",
                },
                {
                  q: "What type of PNG works best?",
                  a: "High-contrast artwork works best: black line art, transparent PNG designs, flat logos, icons, lettering, decals, and sticker-style graphics. Low-resolution screenshots and noisy photos usually trace poorly.",
                },
                {
                  q: "Should I use a transparent background?",
                  a: "For most Etsy download files, yes. Transparent SVG output is easier for buyers to place over different backgrounds. Use a solid background only when you intentionally need one.",
                },
                {
                  q: "What file limits apply?",
                  a: "PNG/JPEG up to 30 MB, ~30 MP. Preview is fastest ≤10 MB and throttled up to 25 MB. Above 25 MB we try on-device compression.",
                },
                {
                  q: "Can this convert full-color photos into Etsy SVG files?",
                  a: "It can create stylized edge traces from photos, but it will not automatically produce a polished multi-color commercial SVG. Photo-based products usually need manual design work after conversion.",
                },
              ].map((x) => (
                <article
                  key={x.q}
                  itemScope
                  itemType="https://schema.org/Question"
                  itemProp="mainEntity"
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h4 itemProp="name" className="m-0 font-semibold">
                    {x.q}
                  </h4>
                  <p
                    itemScope
                    itemType="https://schema.org/Answer"
                    itemProp="acceptedAnswer"
                    className="mt-2 text-sm text-slate-600"
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
