import * as React from "react";
import type { Route } from "./+types/home";
import {
  json,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { Link, useFetcher, type ActionFunctionArgs } from "react-router";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";

/** Stable server flag: true on SSR render, false in client bundle */
const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "i🩵SVG  -  Potrace (server, in-memory, live preview, client auto-compress)";
  const description =
    "Convert PNG/JPEG to SVG with live preview. Auto-compress large files on-device to 25 MB for instant preview. Server concurrency-gated. Batch supported.";
  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
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
======================== */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // --- Guard: method ---
    if (request.method.toUpperCase() !== "POST") {
      return json(
        { error: "Method not allowed" },
        { status: 405, headers: { Allow: "POST" } }
      );
    }

    // --- Guard: content type ---
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data")) {
      return json(
        { error: "Unsupported content type. Use multipart/form-data." },
        { status: 415 }
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
        { status: 413 }
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
        { status: 415 }
      );
    }
    if ((webFile.size || 0) > MAX_UPLOAD_BYTES) {
      return json(
        {
          error: `File too large. Max ${Math.round(
            MAX_UPLOAD_BYTES / (1024 * 1024)
          )} MB per image.`,
        },
        { status: 413 }
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
        }
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
            { status: 415 }
          );
        }

        const mp = (w * h) / 1_000_000;
        if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
          return json(
            {
              error: `Image too large: ${w}×${h} (~${mp.toFixed(
                1
              )} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
            },
            { status: 413 }
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
      const lineColor = String(form.get("lineColor") ?? "#000000");
      const invert =
        String(form.get("invert") ?? "false").toLowerCase() === "true";

      // Background
      const transparent =
        String(form.get("transparent") ?? "true").toLowerCase() === "true";
      const bgColor = String(form.get("bgColor") ?? "#ffffff");

      // Preprocess (for photos)
      const preprocess = String(form.get("preprocess") ?? "none") as
        | "none"
        | "edge";
      const blurSigma = Number(form.get("blurSigma") ?? 0.8);
      const edgeBoost = Number(form.get("edgeBoost") ?? 1.0);

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

      const opts: any = {
        color: lineColor,
        threshold,
        turdSize,
        optTolerance,
        turnPolicy,
        invert,
        blackOnWhite: !invert,
      };

      const svgRaw: string = await new Promise((resolve, reject) => {
        if (typeof traceFn === "function") {
          traceFn(prepped, opts, (err: any, out: string) =>
            err ? reject(err) : resolve(out)
          );
        } else if (PotraceClass) {
          const p = new PotraceClass(opts);
          p.loadImage(prepped, (err: any) => {
            if (err) return reject(err);
            p.setParameters(opts);
            p.getSVG((err2: any, out: string) =>
              err2 ? reject(err2) : resolve(out)
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
        ensured.height
      );
      const finalSVG = transparent
        ? svg3
        : injectBackgroundRectString(
            svg3,
            ensured.width,
            ensured.height,
            bgColor
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
      { status: 500 }
    );
  }
}

/* ---------- Image normalization for Potrace (server-side, robust) ---------- */
async function normalizeForPotrace(
  input: Buffer,
  opts: { preprocess: "none" | "edge"; blurSigma: number; edgeBoost: number }
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
      `<svg viewBox="0 0 ${Math.round(width)} ${Math.round(height)}"`
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
    (_m, a, b) => `<path${a} fill="${fillColor}"${b}>`
  );
  out = out.replace(
    /<path\b((?:(?!>)[\s\S])*?)>(?![\s\S]*?<\/path>)/gi,
    (m, attrs) => {
      if (/fill\s*=/.test(attrs)) return m;
      return `<path${attrs} fill="${fillColor}">`;
    }
  );
  return out;
}

function stripFullWhiteBackgroundRect(
  svg: string,
  width: number,
  height: number
): string {
  const whitePattern =
    /(#ffffff|#fff|white|rgb\(255\s*,\s*255\s*,\s*255\)|rgba\(255\s*,\s*255\s*,\s*255\s*,\s*1\))/i;

  const numeric = new RegExp(
    `<rect\\b[^>]*x\\s*=\\s*["']0["'][^>]*y\\s*=\\s*["']0["'][^>]*width\\s*=\\s*["']${escapeReg(
      String(width)
    )}["'][^>]*height\\s*=\\s*["']${escapeReg(
      String(height)
    )}["'][^>]*fill\\s*=\\s*["']${whitePattern.source}["'][^>]*>`,
    "ig"
  );

  const percent = new RegExp(
    `<rect\\b[^>]*x\\s*=\\s*["']0%?["'][^>]*y\\s*=\\s*["']0%?["'][^>]*width\\s*=\\s*["']100%["'][^>]*height\\s*=\\s*["']100%["'][^>]*fill\\s*=\\s*["']${whitePattern.source}["'][^>]*>`,
    "ig"
  );

  return svg.replace(numeric, "").replace(percent, "");
}

function injectBackgroundRectString(
  svg: string,
  width: number,
  height: number,
  color: string
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
    label: "Lineart  -  Accurate (default)",
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
    label: "Lineart  -  Bold",
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
    label: "Lineart  -  Fine detail",
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
    label: "Lineart  -  Seal gaps",
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
    label: "Logo  -  Clean shapes",
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
    label: "Logo  -  Thin details",
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
    null
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
    if (fetcher.data?.error) {
      setErr(fetcher.data.error);
    } else setErr(null);

    // If server replied 429 with retryAfterMs, auto-reschedule
    if (fetcher.data?.retryAfterMs) {
      const ms = Math.max(800, fetcher.data.retryAfterMs);
      setInfo(
        `Server busy… retrying automatically in ${(ms / 1000).toFixed(1)}s`
      );
      const t = setTimeout(() => {
        if (file) submitConvert(); // retry
      }, ms);
      return () => clearTimeout(t);
    } else {
      setInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data]);

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

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setErr(null);
    setInfo(null);
    setDims(null);
    setOriginalFileSize(f.size);

    let chosen = f;

    // If already above server max, try to compress immediately
    if (f.size > MAX_UPLOAD_BYTES) {
      setInfo("Huge file detected - compressing on your device…");
      try {
        chosen = await compressToTarget25MB(f);
      } catch (e: any) {
        setInfo(null);
        setErr(
          e?.message ||
            "This image is too large. Please resize it and try again."
        );
        // Block selection since it can never be uploaded
        setFile(null);
        setPreviewUrl(null);
        setAutoMode("off");
        setOriginalFileSize(null);
        return;
      }
    } else if (f.size > LIVE_MED_MAX) {
      // Over 25MB but within server max: compress only for live preview tier
      setInfo("Large file detected - compressing on your device for preview…");
      try {
        const shrunk = await compressToTarget25MB(f);
        chosen = shrunk;
        setInfo(`Compressed on-device to ${prettyBytes(shrunk.size)}.`);
      } catch (e: any) {
        setErr(
          e?.message ||
            "Could not compress below 25 MB. Live preview will be disabled."
        );
        setInfo(null);
        // Keep original if it's still within server max
        chosen = f;
      }
    }

    // Final guard: never keep a file that exceeds server max
    if (chosen.size > MAX_UPLOAD_BYTES) {
      setErr(
        `File too large. Max ${Math.round(
          MAX_UPLOAD_BYTES / (1024 * 1024)
        )} MB.`
      );
      setInfo(null);
      setFile(null);
      setPreviewUrl(null);
      setAutoMode("off");
      setOriginalFileSize(null);
      return;
    }

    setFile(chosen);
    setAutoMode(getAutoMode(chosen.size));
    const url = URL.createObjectURL(chosen);
    setPreviewUrl(url);
    await measureAndSet(chosen);
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

    const fd = new FormData();
    fd.append("file", file);
    fd.append("threshold", String(settings.threshold));
    fd.append("turdSize", String(settings.turdSize));
    fd.append("optTolerance", String(settings.optTolerance));
    fd.append("turnPolicy", settings.turnPolicy);
    fd.append("lineColor", settings.lineColor);
    fd.append("invert", String(settings.invert));
    fd.append("transparent", String(settings.transparent));
    fd.append("bgColor", settings.bgColor);
    fd.append("preprocess", settings.preprocess);
    fd.append("blurSigma", String(settings.blurSigma));
    fd.append("edgeBoost", String(settings.edgeBoost));
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
      <SiteHeader />

      <main className="min-h-[100dvh] bg-slate-50 text-slate-900">
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-12">
          <header className="text-center mb-2">
            <h1 className="inline-flex items-center gap-2 text-[34px] font-extrabold leading-none m-0">
              <span>i</span>
              <span
                role="img"
                aria-label="love"
                className="text-[34px] -translate-y-[1px]"
              >
                🩵
              </span>
              <span className="text-[#0b2dff]">SVG</span>
            </h1>
            <p className="mt-1 text-slate-600">
              Convert your PNG/JPEG images into crisp vector graphics with live
              preview. Large files auto-compress on your device up to 25 MB.
            </p>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden min-w-0">
              <h2 className="m-0 mb-3 text-lg text-slate-900">Input</h2>

              {/* Presets */}
              <div className="flex flex-wrap gap-2 mb-2 min-w-0">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={[
                      "px-3 py-1.5 rounded-md border text-slate-900 cursor-pointer transition-colors",
                      activePreset === p.id
                        ? "bg-[#e7eeff] border-[#0b2dff]"
                        : "bg-white border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Limits helper */}
              <div className="text-[13px] text-slate-600 mb-2">
                Limits: <b>{MAX_UPLOAD_BYTES / (1024 * 1024)} MB</b> •{" "}
                <b>{MAX_MP} MP</b> • <b>{MAX_SIDE}px longest side</b> each max.
              </div>
              <div className="text-sky-700 mb-2 text-center text-sm">
                Live preview: fast ≤10 MB, throttled ≤25 MB. Files over 30 MB
                are auto-compressed on-device (if possible).
              </div>

              {/* Dropzone */}
              {!file ? (
                <div
                  role="button"
                  tabIndex={0}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => document.getElementById("file-inp")?.click()}
                  className="border border-dashed border-[#c8d3ea] rounded-xl p-4 text-center cursor-pointer min-h-[10em] flex justify-center items-center bg-[#f9fbff] hover:bg-[#f2f6ff] focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <div className="text-sm text-slate-600">
                    Click, drag & drop, or paste a PNG/JPEG
                  </div>
                  <input
                    id="file-inp"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={onPick}
                    className="hidden"
                  />
                </div>
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

              {/* Settings */}
              <div className="mt-3 flex flex-col gap-2 min-w-0">
                <Field label="Preprocess">
                  <select
                    value={settings.preprocess}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        preprocess: e.target.value as any,
                      }))
                    }
                    className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
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
                    className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
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
                      setSettings((s) => ({ ...s, lineColor: e.target.value }))
                    }
                    className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white"
                  />
                </Field>

                <Field label="Invert lineart">
                  <input
                    type="checkbox"
                    checked={settings.invert}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, invert: e.target.checked }))
                    }
                    className="h-4 w-4 accent-[#0b2dff]"
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
                      className="h-4 w-4 accent-[#0b2dff]"
                    />
                    <span className="text-[13px] text-slate-700">
                      Transparent
                    </span>
                    <input
                      type="color"
                      value={settings.bgColor}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, bgColor: e.target.value }))
                      }
                      aria-disabled={settings.transparent}
                      className={[
                        "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white",
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

              {/* Convert button + errors + tier hints */}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={submitConvert}
                  disabled={buttonDisabled}
                  suppressHydrationWarning
                  className={[
                    "px-3.5 py-2 rounded-lg font-bold border transition-colors",
                    "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0]",
                    "disabled:opacity-70 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  {busy ? "Converting…" : "Convert"}
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
                <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <img
                    src={previewUrl}
                    alt="Input"
                    className="w-full h-auto block"
                  />
                </div>
              )}
            </div>

            {/* RESULTS */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-xl p-4 h-full max-h-[124.25em] overflow-scroll shadow-sm min-w-0">
              <h2 className="m-0 mb-3 text-lg text-slate-900 flex items-center gap-2">
                Result
                {busy && (
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
                )}
              </h2>

              {history.length > 0 ? (
                <div className="grid gap-3">
                  {history.map((item) => (
                    <div
                      key={item.stamp}
                      className="rounded-xl border border-slate-200 bg-white p-2"
                    >
                      <div className="rounded-xl border border-slate-200 bg-white min-h-[240px] flex items-center justify-center p-2">
                        <img
                          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                            item.svg
                          )}`}
                          alt="SVG result"
                          className="max-w-full h-auto"
                        />
                      </div>
                      <div className="flex gap-3 items-center mt-3 flex-wrap justify-between">
                        <span className="text-[13px] text-slate-700">
                          {item.width > 0 && item.height > 0
                            ? `${item.width} × ${item.height} px`
                            : "size unknown"}
                        </span>
                        <div className="flex gap-2 flex-wrap">
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
                            className="px-3 py-2 rounded-lg font-semibold border bg-sky-500 hover:bg-sky-600 text-white border-sky-600 cursor-pointer"
                          >
                            Download SVG
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopySvg(item.svg)}
                            className="px-3 py-2 rounded-lg font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                          >
                            Copy SVG
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600 m-0">
                  {busy
                    ? "Converting…"
                    : "Your converted file will appear here."}
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
      <OtherToolsLinks />
      <SeoSections />
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
      `Image too large: ${w}×${h} (~${mp.toFixed(1)} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`
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
          quality
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
    "This image cannot be reduced below 25 MB without excessive degradation."
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

/* ===== Simple site header & footer ===== */
function SiteHeader() {
  return (
    <div className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 h-12 flex items-center justify-between">
        {/* Logo (unchanged) */}
        <a href="/" className="font-extrabold tracking-tight text-slate-900">
          i<span className="text-sky-600">🩵</span>SVG
        </a>

        {/* Right-side nav */}
        <nav aria-label="Primary">
          <ul className="flex items-center gap-4 text-[14px] font-semibold">
            <li>
              <a
                href="/#other-tools"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                All Tools
              </a>
            </li>

            <li>
              <a
                href="/svg-recolor"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Recolor
              </a>
            </li>

            <li>
              <a
                href="/svg-resize-and-scale-editor"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Resize/Scale
              </a>
            </li>

            <li>
              <a
                href="/svg-to-png-converter"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                SVG to PNG
              </a>
            </li>

            <li>
              <a
                href="/svg-to-jpg-converter"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                SVG to JPG
              </a>
            </li>
            <li>
              <a
                href="/svg-to-webp-converter"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                SVG to WEBP
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            <span>© {new Date().getFullYear()} i🩵SVG</span>
            <span className="mx-2 text-slate-300">•</span>
            <span className="text-slate-500">
              Simple SVG tools, no accounts.
            </span>
          </div>

          <nav aria-label="Footer" className="text-sm">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-600">
              <li>
                <Link
                  to="/"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Home
                </Link>
              </li>

              <li className="text-slate-300" aria-hidden>
                |
              </li>

              <li>
                <Link
                  to="/svg-to-png-converter"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  SVG to PNG
                </Link>
              </li>
              <li>
                <Link
                  to="/svg-to-jpg-converter"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  SVG to JPG
                </Link>
              </li>
              <li>
                <Link
                  to="/svg-to-webp-converter"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  SVG to WebP
                </Link>
              </li>
              <li>
                <Link
                  to="/svg-background-editor"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Background
                </Link>
              </li>
              <li>
                <Link
                  to="/svg-resize-and-scale-editor"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Resize / Scale
                </Link>
              </li>
              <li>
                <Link
                  to="/svg-recolor"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Recolor
                </Link>
              </li>

              <li className="text-slate-300" aria-hidden>
                |
              </li>

              <li>
                <Link
                  to="/privacy-policy"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms-of-service"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Terms
                </Link>
              </li>
              <li>
                <Link
                  to="/cookies"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Cookies
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-12 text-slate-800">
        <article className="max-w-none">
          {/* Header / Hero */}
          <header className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 md:p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                PNG/JPEG to SVG vectorizer
              </p>
              <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                SVG Converter: Precise, fast, and built for creators
              </h2>
              <p className="text-slate-600 max-w-[75ch]">
                Potrace-powered raster-to-vector conversion tuned for logos,
                line art, scans, diagrams, and photo-style edge extraction.
                Clean, editable SVG output with snappy live preview and smart
                on-device compression.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { k: "Clean SVG", v: "Editable paths, recolor anywhere" },
                  { k: "Fast preview", v: "≤10 MB live updates" },
                  { k: "Throttled tier", v: "Up to 25 MB preview" },
                  { k: "Private by default", v: "Processed in memory" },
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

          {/* Use cases */}
          <section className="mt-10">
            <h3 className="text-lg font-bold">Best for</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Logos",
                "Line art",
                "Scans",
                "Whiteboards",
                "Comics",
                "Diagrams",
                "Stickers",
                "Photo edges",
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
                <div className="text-sm font-semibold">Lineart and ink</div>
                <p className="mt-1 text-sm text-slate-600">
                  Choose “Lineart - Accurate” for crisp strokes and clean fills.
                  Lower curve tolerance for detail, raise turd size to kill
                  dust.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold">Logos and icons</div>
                <p className="mt-1 text-sm text-slate-600">
                  Use “Logo - Clean shapes” for smoother curves and fewer nodes.
                  Adjust threshold to control what becomes solid.
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
                How to convert PNG or JPEG to SVG
              </h3>
              <span className="text-xs text-slate-500">
                Fast path: upload → preset → tweak → export
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload a PNG or JPEG",
                  body: "Drag and drop or use the picker. Large files may be auto-compressed on your device for smoother preview up to 25 MB.",
                },
                {
                  title: "Pick a preset that matches your art",
                  body: "Lineart for inks, Logo for clean shapes, Photo Edge for contour extraction.",
                },
                {
                  title: "Adjust settings",
                  body: "Tune threshold, curve tolerance, turd size, and turn policy. Preview updates automatically with rate limits for heavier images.",
                },
                {
                  title: "Choose line color and background",
                  body: "Keep transparency or inject a solid background color. Invert when needed.",
                },
                {
                  title: "Download or copy SVG",
                  body: "Export a scalable vector you can edit, recolor, and embed anywhere.",
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

          {/* Settings */}
          <section className="mt-12">
            <h3 className="text-lg font-bold">Settings explained</h3>
            <p className="mt-2 text-sm text-slate-600 max-w-[80ch]">
              Small tweaks make a huge difference. Use these to control detail,
              smoothness, and cleanup.
            </p>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Preprocess",
                  body: "None for logos and crisp inks. Edge mode for photos and paintings when you want outlines.",
                },
                {
                  title: "Threshold",
                  body: "Controls what counts as ink. Higher includes lighter pixels, lower keeps only darker strokes.",
                },
                {
                  title: "Curve tolerance",
                  body: "Lower preserves detail. Higher smooths curves and reduces SVG size.",
                },
                {
                  title: "Turd size",
                  body: "Removes tiny specks and scanner dust so your SVG looks intentional.",
                },
                {
                  title: "Turn policy",
                  body: "Decides how ambiguous corners resolve. Useful when corners look “wrong” in the trace.",
                },
                {
                  title: "Line color, invert, background",
                  body: "Pick any line color. Invert for white ink. Keep transparency or add a solid background.",
                },
                {
                  title: "Edge boost and blur σ",
                  body: "In Edge mode: blur reduces noise; edge boost amplifies contours before tracing.",
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
                ["Image too large", "Downscale or crop unused borders."],
                [
                  "Over 25 MB",
                  "We try to compress locally. If it fails, resize and re-upload.",
                ],
                [
                  "429 server busy",
                  "Stability protection. The app retries after the suggested delay.",
                ],
                ["Blank or too light", "Lower threshold or disable invert."],
                ["Jagged edges", "Increase curve tolerance slightly."],
                [
                  "Too many dots",
                  "Raise turd size or try Scan Cleanup presets.",
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
                  q: "What file limits apply?",
                  a: "PNG/JPEG up to 30 MB, ~30 MP. Preview is fastest ≤10 MB and throttled up to 25 MB. Above 25 MB we try on-device compression.",
                },
                {
                  q: "What happens with files over 25 MB?",
                  a: "We try to compress locally (PNG may become JPEG) to reach ≤25 MB for preview. If quality would drop too much, you will need to resize and re-upload.",
                },
                {
                  q: "Why do I see “Server busy” with Retry-After?",
                  a: "We cap concurrency to keep the site stable. When the queue is full the server responds 429 with Retry-After, and the app retries automatically.",
                },
                {
                  q: "Can this handle photos?",
                  a: "Yes. Use the Photo Edge presets to extract contours and stylized linework.",
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

      {/* Keep your ld+json script as-is */}
      {/* ... */}
    </section>
  );
}
