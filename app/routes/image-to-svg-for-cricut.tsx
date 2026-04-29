import * as React from "react";
import type { Route } from "./+types/image-to-svg-for-cricut";
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
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";

/** Stable server flag: true on SSR render, false in client bundle */
const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "Image to SVG for Cricut | Free Cricut Cut File Converter - iLoveSVG";
  const description =
    "Convert PNG, JPG, WEBP, GIF, BMP, TIFF, AVIF, HEIC, and SVG images into clean SVG files for Cricut Design Space. Free image to SVG converter for Cricut cut files, decals, labels, stencils, and stickers.";
  const canonical = "https://www.ilovesvg.com/image-to-svg-for-cricut";

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
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/tiff",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/svg+xml",
]);
const ALLOWED_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "tif",
  "tiff",
  "avif",
  "heic",
  "heif",
  "svg",
]);
const SVG_MIME = "image/svg+xml";
const BROWSER_PREVIEW_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/avif",
  "image/svg+xml",
]);

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
    if (!isAllowedImageFile(webFile)) {
      return json(
        {
          error:
            "Unsupported image type. Use PNG, JPG, WEBP, GIF, BMP, TIFF, AVIF, HEIC, HEIF, or SVG.",
        },
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

      if (isSvgFile(webFile)) {
        const rawSvg = decodeSvgBuffer(input);
        const sanitized = sanitizeSvgString(rawSvg);
        if (!/^<svg\b/i.test(sanitized)) {
          return json(
            {
              error:
                "This SVG file could not be parsed. Try exporting a clean SVG and uploading again.",
            },
            { status: 415 },
          );
        }
        const ensured = ensureViewBoxResponsive(coerceSvg(sanitized));
        const cleaned = stripFullWhiteBackgroundRect(
          ensured.svg,
          ensured.width,
          ensured.height,
        );
        const finalSVG = transparent
          ? cleaned
          : injectBackgroundRectString(
              cleaned,
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
      }

      // --- Authoritative megapixel/side guard for raster formats ---
      try {
        const { createRequire } = await import("node:module");
        const req = createRequire(import.meta.url);
        const sharp = req("sharp") as typeof import("sharp");
        const meta = await sharp(input, { animated: false }).metadata();
        const w = meta.width ?? 0;
        const h = meta.height ?? 0;

        if (!w || !h) {
          return json(
            {
              error:
                "Could not read image dimensions. Try exporting the image as PNG, JPG, WEBP, or SVG and upload again.",
            },
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
        return json(
          {
            error:
              "Could not parse this image format. Try exporting it as PNG, JPG, WEBP, or SVG and upload again.",
          },
          { status: 415 },
        );
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
    let base = sharp(input, { animated: false }).rotate();

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
  const viewBoxMatch = openTag.match(/viewBox\s*=\s*["']([^"']*)["']/i);
  const widthMatch = openTag.match(/width\s*=\s*["'](\d+(\.\d+)?)(px)?["']/i);
  const heightMatch = openTag.match(/height\s*=\s*["'](\d+(\.\d+)?)(px)?["']/i);

  let width = widthMatch ? Number(widthMatch[1]) : 1024;
  let height = heightMatch ? Number(heightMatch[1]) : 1024;

  if (viewBoxMatch) {
    const nums = viewBoxMatch[1]
      .trim()
      .split(/[\s,]+/)
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n));
    if (!widthMatch && nums.length === 4 && nums[2] > 0) width = nums[2];
    if (!heightMatch && nums.length === 4 && nums[3] > 0) height = nums[3];
  }

  let newOpen = openTag;

  if (!viewBoxMatch) {
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

function getFileExtension(file: File): string {
  const name = file.name || "";
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function isAllowedImageFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  const ext = getFileExtension(file);
  return ALLOWED_MIME.has(mime) || ALLOWED_EXTENSIONS.has(ext);
}

function isSvgFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  return mime === SVG_MIME || getFileExtension(file) === "svg";
}

function canBrowserPreview(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  return BROWSER_PREVIEW_MIME.has(mime) || getFileExtension(file) === "svg";
}

function decodeSvgBuffer(input: Buffer): string {
  const raw = input
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!raw) {
    throw new Error("The SVG file is empty.");
  }
  return raw;
}

function sanitizeSvgString(svg: string): string {
  let out = svg.trim();

  out = out
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!doctype[\s\S]*?>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[\s\S]*?>/gi, "");

  out = out
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(
      /\s(?:href|xlink:href)\s*=\s*"\s*(?:javascript:|data:)[^"]*"/gi,
      "",
    )
    .replace(
      /\s(?:href|xlink:href)\s*=\s*'\s*(?:javascript:|data:)[^']*'/gi,
      "",
    );

  return out.trim();
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
    label: "Cricut  -  Clean trace (default)",
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
    label: "Cricut Vinyl  -  Bold decal",
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
    label: "Cricut  -  Fine detail",
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
    label: "Cricut  -  Smooth shapes",
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
    label: "Cricut  -  Thin details",
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
    if (!isAllowedImageFile(f)) {
      setErr(
        "Please choose a PNG, JPG, WEBP, GIF, BMP, TIFF, AVIF, HEIC, HEIF, or SVG file.",
      );
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

    if (
      chosen.size > LIVE_MED_MAX &&
      !isSvgFile(chosen) &&
      canBrowserPreview(chosen)
    ) {
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
    if (canBrowserPreview(chosen)) {
      await measureAndSet(chosen);
    } else {
      setDims(null);
      setInfo(
        "This format may not preview in your browser, but the server will try to parse and convert it.",
      );
    }

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
                Image to SVG for Cricut
              </h1>

              <PresetPicker
                presets={PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />

              <p className="mb-3 text-center text-sm text-slate-600">
                Supports PNG, JPG, WEBP, GIF, BMP, TIFF, AVIF, HEIC, HEIF, and
                SVG files for Cricut SVG output.
              </p>

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
                            a.download = "image-to-svg-for-cricut.svg";
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
                    : "Converted Cricut SVG files appear here...  "}
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
      <ContextualAffiliateCard />
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
  if (!isAllowedImageFile(file)) {
    throw new Error(
      "Unsupported image type. Use PNG, JPG, WEBP, GIF, BMP, TIFF, AVIF, HEIC, HEIF, or SVG.",
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File too large. Max 30 MB per image.");
  }

  if (isSvgFile(file)) {
    const text = await file.text();
    const safe = sanitizeSvgString(text);
    if (!/^<svg\b/i.test(safe)) {
      throw new Error(
        "This SVG file could not be parsed. Try exporting a clean SVG and uploading again.",
      );
    }
    return;
  }

  try {
    const { w, h } = await getImageSize(file);
    if (!w || !h) return;
    const mp = (w * h) / 1_000_000;
    if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
      throw new Error(
        `Image too large: ${w}×${h} (~${mp.toFixed(1)} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
      );
    }
  } catch (e: any) {
    if (e?.message?.startsWith("Image too large")) throw e;
  }
}

/** Compress to ≤25MB (best effort). Converts PNG→JPEG if necessary for size.
 *  Strategy: try JPEG quality steps; if still large, progressively scale down. */
async function compressToTarget25MB(file: File): Promise<File> {
  const TARGET = LIVE_MED_MAX; // 25MB
  if (file.size <= TARGET) return file;
  if (isSvgFile(file) || !canBrowserPreview(file))
    throw new Error(
      "This image format cannot be compressed in the browser. Try resizing it or exporting it as PNG/JPG first.",
    );
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
                Image to SVG for Cricut
              </p>
              <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                Convert common image formats into Cricut-ready SVG files
              </h2>
              <p className="text-slate-600">
                This page is built for people starting with mixed image sources:
                PNG screenshots, JPG artwork, WEBP downloads, scanned TIFFs,
                bitmap logos, phone photos, and existing SVGs that need cleanup
                before being used in Cricut Design Space.
              </p>
              <p className="text-slate-600">
                Raster images are normalized and traced into vector paths. SVG
                uploads are handled differently: they are parsed, cleaned of
                risky markup, made responsive with a viewBox, and exported again
                without forcing a lossy retrace.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    k: "More formats",
                    v: "PNG, JPG, WEBP, GIF, BMP, TIFF, AVIF, HEIC, HEIF, SVG",
                  },
                  {
                    k: "SVG passthrough",
                    v: "Clean existing SVGs instead of retracing them",
                  },
                  {
                    k: "Cricut workflow",
                    v: "Designed for Design Space upload prep",
                  },
                  {
                    k: "Cut-file tuning",
                    v: "Presets for decals, labels, stencils, and icons",
                  },
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

          <section className="">
            <h3 className="text-lg font-bold">
              What this Cricut image converter is best for
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Vinyl decals",
                "Labels",
                "Sticker outlines",
                "Simple logos",
                "Stencil art",
                "Monograms",
                "Card shapes",
                "Existing SVG cleanup",
                "Scanned line art",
                "Icon cut files",
              ].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-4 grid md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold">
                  Use raster tracing for flat artwork
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Best results come from high-contrast images with clear edges:
                  black logos, simple clipart, handwriting scans, silhouettes,
                  and solid shapes. These convert into cleaner cut paths than
                  busy photos or soft gradients.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold">
                  Use SVG cleanup for existing vectors
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  If you already have an SVG, upload it directly. The tool keeps
                  the vector structure, removes risky script-style markup, adds
                  responsive sizing, and exports a cleaner SVG for upload.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold">
                  Avoid over-detailed source images
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Cricut cut files work better with fewer, smoother paths. If a
                  photo has hair, shadows, texture, or gradients, use Photo Edge
                  presets only when you want a stylized outline rather than a
                  perfect full-color recreation.
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
              <h3 itemProp="name" className="text-lg font-bold">
                How to convert an image to SVG for Cricut
              </h3>
              <span className="text-xs text-slate-500">
                Upload → choose preset → adjust → download SVG
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload your image or SVG",
                  body: "Use PNG, JPG, WEBP, GIF, BMP, TIFF, AVIF, HEIC, HEIF, or SVG. Less common formats may not preview in your browser, but the server will still attempt to parse them.",
                },
                {
                  title: "Pick the closest Cricut preset",
                  body: "Use Logo/Clean Shapes for decals and labels, Scan Cleanup for hand-drawn or scanned art, and Photo Edge only when you want an outline-style result from a photo.",
                },
                {
                  title: "Tune the cut path",
                  body: "Raise threshold to include lighter areas, lower it to keep only darker shapes. Increase turd size to remove tiny specks that can create unwanted Cricut cuts.",
                },
                {
                  title: "Keep transparency unless you need a background",
                  body: "Transparent SVGs are usually better for Cricut uploads. Add a background only when you intentionally need a filled rectangle behind the design.",
                },
                {
                  title: "Download and upload to Design Space",
                  body: "Download the SVG, then upload it into Cricut Design Space. Check the preview before cutting, especially around small holes, thin text, and isolated dots.",
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

          <section className="mt-12">
            <h3 className="text-lg font-bold">
              Format guidance for Cricut projects
            </h3>
            <p className="mt-2 text-sm text-slate-600 max-w-[85ch]">
              Different source files need different handling. The goal is not
              just “make an SVG.” The goal is to create an SVG that imports
              cleanly and does not create hundreds of messy cut paths.
            </p>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "PNG with transparent background",
                  body: "Usually the best raster source. Use Logo or Lineart presets. Transparent backgrounds help avoid tracing a full rectangular box around the design.",
                },
                {
                  title: "JPG photos or screenshots",
                  body: "Good for high-contrast subjects, but weak for shadows and gradients. Try Photo Edge presets if you want outlines; use simpler source art for actual cut files.",
                },
                {
                  title: "WEBP, AVIF, HEIC, and HEIF",
                  body: "Common from phones and websites. These may not preview in every browser, but the server attempts to decode them and convert the first usable image frame.",
                },
                {
                  title: "GIF files",
                  body: "Animated GIFs are treated as a still source. Use them only when the first frame is the shape you want to trace.",
                },
                {
                  title: "TIFF and BMP scans",
                  body: "Useful for scanned drawings and older bitmap exports. Use Scan Cleanup presets and increase turd size if you see dust-like speckles.",
                },
                {
                  title: "Existing SVG files",
                  body: "Existing SVGs are parsed and cleaned rather than retraced. This preserves vector paths better than converting SVG to bitmap and tracing it again.",
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

          <section className="mt-12">
            <h3 className="text-lg font-bold">
              Settings that matter for Cricut cuts
            </h3>
            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Threshold",
                  body: "Controls what becomes a shape. Raise it when pale gray lines disappear. Lower it when the design becomes too chunky or fills in small gaps.",
                },
                {
                  title: "Turd size",
                  body: "Removes tiny islands. For Cricut, this is important because every speck can become an unwanted cut. Raise it for scans and noisy images.",
                },
                {
                  title: "Curve tolerance",
                  body: "Higher values smooth paths and reduce file complexity. Lower values keep detail but can create more nodes and harder-to-cut shapes.",
                },
                {
                  title: "Turn policy",
                  body: "Changes how ambiguous corners resolve. Try black or majority when small corners look broken or when gaps need to close.",
                },
                {
                  title: "Transparent background",
                  body: "Usually keep this on. A solid background can become a large rectangle in Design Space unless you intentionally want that shape.",
                },
                {
                  title: "Line color",
                  body: "Useful for preview and simple single-color SVGs. Cricut material color is still chosen later in Design Space when you prepare the cut.",
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

          <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-lg font-bold">
              Before cutting: quick Cricut sanity check
            </h3>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {[
                [
                  "Zoom into thin areas",
                  "Very thin strokes can tear vinyl or disappear at small sizes.",
                ],
                [
                  "Remove stray dots",
                  "Tiny specks may become separate cuts. Increase turd size or clean the source image.",
                ],
                [
                  "Check enclosed holes",
                  "Letters like A, O, P, R and small stencil bridges can fill in or cut incorrectly.",
                ],
                [
                  "Simplify busy photos",
                  "A detailed photo trace can produce too many paths for a clean craft workflow.",
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

          <section
            className="mt-12"
            itemScope
            itemType="https://schema.org/FAQPage"
          >
            <h3 className="text-lg font-bold">Frequently asked questions</h3>

            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "Which image formats can I upload?",
                  a: "This page accepts PNG, JPG, JPEG, WEBP, GIF, BMP, TIFF, AVIF, HEIC, HEIF, and SVG. Browser preview support varies, but the server attempts to parse the supported formats.",
                },
                {
                  q: "What happens when I upload an SVG?",
                  a: "SVG files are not retraced. The tool sanitizes the markup, removes risky active content, normalizes sizing with a viewBox, and exports the SVG again.",
                },
                {
                  q: "Is every converted SVG ready to cut immediately?",
                  a: "No. Automatic tracing can create extra nodes, small islands, or filled-in holes. Always check the SVG in Design Space before cutting expensive vinyl or cardstock.",
                },
                {
                  q: "Why does my photo look like a rough outline?",
                  a: "This converter creates vector paths. Photos contain gradients and texture, so Photo Edge mode extracts contours rather than recreating the full photo as a clean cut file.",
                },
                {
                  q: "What file limits apply?",
                  a: "Uploads are capped at 30 MB and about 30 megapixels. Preview is fastest below 10 MB and throttled up to 25 MB. Some formats over 25 MB may need to be resized before upload.",
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
