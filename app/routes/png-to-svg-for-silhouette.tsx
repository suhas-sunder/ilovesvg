import * as React from "react";
import type { Route } from "./+types/png-to-svg-for-silhouette";
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
import {
  LayerPaletteEditor,
  LayeredTraceControls,
  applyLayerEditsToSvg,
  type EditableSvgLayer,
  type SvgLayerMeta,
  type TraceMode,
} from "~/client/components/svg/LayerPaletteEditor";
import { PresetPicker } from "~/client/components/converter/PresetSelector";
import { TraceAdvancedSettingsPanel } from "~/client/components/converter/AdvancedSettingsPanel";
import { getRouteCapabilities } from "~/client/lib/converter/routeCapabilities";
import {
  DEFAULT_TRACE_ADVANCED_SETTINGS,
  appendAdvancedTraceSettings,
  type TraceAdvancedSettings,
} from "~/client/lib/converter/settings";

/** Stable server flag: true on SSR render, false in client bundle */
const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "PNG to SVG for Silhouette | Free Silhouette SVG Converter - iLoveSVG";
  const description =
    "Convert PNG and JPG images into clean SVG files for Silhouette Studio, Cameo projects, vinyl decals, stickers, stencils, and cut-file cleanup. Free PNG to SVG converter with live preview.";
  const canonical = "https://www.ilovesvg.com/png-to-svg-for-silhouette";

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

    const {
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
      "png-to-svg-for-silhouette",
      "raster-trace"
    );
    if (!rateLimit.allowed) return createRateLimitedResponse(rateLimit);

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

    const fileCountError = validateMultipartFileCount(form);
    if (fileCountError) return fileCountError;

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return json({ error: "No file uploaded." }, { status: 400 });
    }

    // Basic type/size checks (authoritative)
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
      const signatureError = validateFileSignature(input, webFile, ALLOWED_MIME);
      if (signatureError) return signatureError;

      // --- Authoritative megapixel/side guard (cheap header decode via sharp) ---
      try {
        const { getSharp } = await import("~/utils/conversionModules.server");
      const sharp = await getSharp();
        const meta = await sharp(input).metadata();
        const w = meta.width ?? 0;
        const h = meta.height ?? 0;

        if (!w || !h) {
          return json(
            { error: "Could not read image dimensions. Try a different file." },
            { status: 415 },
          );
        }

        if (w < 2 || h < 2) {
          return json(
            {
              error:
                "Image is too small to trace safely. Please upload an image at least 2x2 pixels.",
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
      const {
        applyTraceSvgOutputSettings,
        readAdvancedTraceFormSettings,
        shouldRemoveSelectedColors,
      } = await import("../utils/converterSettings.server");
      const advancedTraceSettings = readAdvancedTraceFormSettings(form);

      const traceMode = String(form.get("traceMode") ?? "single") as TraceMode;
      const { createLayeredColorSvg, annotateSingleTraceSvg } = await import(
        "../utils/svgLayerTrace.server"
      );
      const colorLayerCount = Number(form.get("colorLayerCount") ?? 5);
      const layerMaxTraceSide = Number(form.get("layerMaxTraceSide") ?? 1600);
      const minRegionPercent = Number(form.get("minRegionPercent") ?? 0.35);
      const layerOptTolerance = Number(form.get("layerOptTolerance") ?? 0.45);
      const layerTurdSize = Number(form.get("layerTurdSize") ?? 4);
      const layerTurnPolicy = String(
        form.get("layerTurnPolicy") ?? "majority",
      ) as Settings["layerTurnPolicy"];
      const posterize =
        String(form.get("posterize") ?? "true").toLowerCase() === "true";
      const removeWhite =
        String(form.get("removeWhite") ?? "false").toLowerCase() === "true";
      const removeTransparent =
        String(form.get("removeTransparent") ?? "true").toLowerCase() ===
        "true";

      if (traceMode === "layered") {
        const { createLayeredColorSvg: createServerLayeredColorSvg } = await import(
          "../utils/svgLayerTrace.server"
        );
        const layered = await createServerLayeredColorSvg(input, {
          layerCount: Math.round(colorLayerCount),
          maxTraceSide: Math.round(layerMaxTraceSide),
          minRegionPercent,
          optTolerance: layerOptTolerance,
          turdSize: Math.round(layerTurdSize),
          posterize,
          removeWhite,
          removeTransparent,
          transparent,
          bgColor,
          turnPolicy: layerTurnPolicy,
          removeColors: shouldRemoveSelectedColors(advancedTraceSettings, "layered")
            ? advancedTraceSettings.removeColors
            : [],
          removeColorTolerance: advancedTraceSettings.removeColorTolerance,
          layerAlpha: advancedTraceSettings.layerAlpha,
          backgroundAlpha: advancedTraceSettings.backgroundAlpha,
          colorMergeTolerance: advancedTraceSettings.colorMergeTolerance,
          posterizeStrength: advancedTraceSettings.posterizeStrength,
          sortLayersBy: advancedTraceSettings.sortLayersBy,
          brightness: advancedTraceSettings.brightness,
          contrast: advancedTraceSettings.contrast,
          outputWidth: advancedTraceSettings.outputWidth,
          outputHeight: advancedTraceSettings.outputHeight,
          preserveAspectRatio: advancedTraceSettings.preserveAspectRatio,
        });

        return json({
          svg: layered.svg,
          layers: layered.layers,
          width: layered.width,
          height: layered.height,
          gate: { running: gate.running, queued: gate.queued },
        });
      }

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
      const { normalizeRasterForTrace } = await import(
        "../utils/imagePreprocess.server"
      );
      const prepped = await normalizeRasterForTrace(input, {
        preprocess,
        blurSigma,
        edgeBoost,
        threshold,
        maxTraceSide: advancedTraceSettings.maxTraceSide,
        removeColors: shouldRemoveSelectedColors(advancedTraceSettings, "single")
          ? advancedTraceSettings.removeColors
          : [],
        removeColorTolerance: advancedTraceSettings.removeColorTolerance,
        brightness: advancedTraceSettings.brightness,
        contrast: advancedTraceSettings.contrast,
        edgeThreshold: advancedTraceSettings.edgeThreshold,
        edgeThickness: advancedTraceSettings.edgeThickness,
        noiseReduction: advancedTraceSettings.noiseReduction,
        gapCloseStrength: advancedTraceSettings.gapCloseStrength,
        minIslandPx: advancedTraceSettings.minIslandPx,
        holeFillPx: advancedTraceSettings.holeFillPx,
      });

      // Potrace (CJS API)
      const { traceBitmapToSvg } = await import("~/utils/potraceCompat");

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

      const svgRaw: string = await traceBitmapToSvg(prepped, opts);

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

      const editable = annotateSingleTraceSvg(finalSVG, lineColor);
      const adjusted = applyTraceSvgOutputSettings(editable.svg, advancedTraceSettings, {
        width: ensured.width,
        height: ensured.height,
      });

      return json({
        svg: adjusted.svg,
        layers: editable.layers,
        width: adjusted.width,
        height: adjusted.height,
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
    const { safeErrorMessage } = await import("~/utils/backendSecurity.server");
    return json(
      { error: safeErrorMessage(err?.message || "Server error during conversion.", "Server error during conversion.") },
      { status: 500 },
    );
  }
}

/* ---------- Image normalization for Potrace (server-side, robust) ---------- */
async function normalizeForPotrace(
  input: Buffer,
  _opts: {
    preprocess: "none" | "edge";
    blurSigma: number;
    edgeBoost: number;
    threshold?: number;
    maxTraceSide?: number;
    removeColors?: string[];
    removeColorTolerance?: number;
    brightness?: number;
    contrast?: number;
    edgeThreshold?: number;
    edgeThickness?: number;
    noiseReduction?: number;
    gapCloseStrength?: number;
    minIslandPx?: number;
    holeFillPx?: number;
  },
): Promise<Buffer> {
  return input;
}

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
type Settings = TraceAdvancedSettings & {
  threshold: number;
  turdSize: number;
  optTolerance: number;
  turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  lineColor: string;
  invert: boolean;

  traceMode: TraceMode;
  colorLayerCount: number;
  layerMaxTraceSide: number;
  minRegionPercent: number;
  layerOptTolerance: number;
  layerTurdSize: number;
  layerTurnPolicy:
    | "black"
    | "white"
    | "left"
    | "right"
    | "minority"
    | "majority";
  posterize: boolean;
  removeWhite: boolean;
  removeTransparent: boolean;

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
    id: "layered-color",
    label: "Layered color SVG",
    settings: {
      traceMode: "layered",
      colorLayerCount: 5,
      layerMaxTraceSide: 1600,
      minRegionPercent: 0.35,
      layerOptTolerance: 0.45,
      layerTurdSize: 4,
      layerTurnPolicy: "majority",
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      invert: false,
    },
  },
  {
    id: "layered-color-smoother",
    label: "Layered color SVG - Smoother",
    settings: {
      traceMode: "layered",
      colorLayerCount: 4,
      layerMaxTraceSide: 1200,
      minRegionPercent: 0.55,
      layerOptTolerance: 0.65,
      layerTurdSize: 7,
      layerTurnPolicy: "majority",
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      invert: false,
    },
  },
  {
    id: "layered-color-detail",
    label: "Layered color SVG - More detail",
    settings: {
      traceMode: "layered",
      colorLayerCount: 8,
      layerMaxTraceSide: 2000,
      minRegionPercent: 0.2,
      layerOptTolerance: 0.32,
      layerTurdSize: 2,
      layerTurnPolicy: "majority",
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      invert: false,
    },
  },
  {
    id: "layered-color-fewer",
    label: "Layered color SVG - Fewer larger layers",
    settings: {
      traceMode: "layered",
      colorLayerCount: 3,
      layerMaxTraceSide: 1200,
      minRegionPercent: 0.8,
      layerOptTolerance: 0.75,
      layerTurdSize: 9,
      layerTurnPolicy: "majority",
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      invert: false,
    },
  },
  {
    id: "line-accurate",
    label: "Silhouette Cut  -  Accurate trace (default)",
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
    label: "Silhouette Vinyl  -  Bold outline",
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
    label: "Silhouette Detail  -  Fine lines",
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
    label: "Silhouette Logo  -  Clean shapes",
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
    label: "Silhouette Logo  -  Thin details",
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
  ...DEFAULT_TRACE_ADVANCED_SETTINGS,
  threshold: 224,
  turdSize: 2,
  optTolerance: 0.28,
  turnPolicy: "minority",
  lineColor: "#000000",
  invert: false,

  traceMode: "single",
  colorLayerCount: 5,
  layerMaxTraceSide: 1600,
  minRegionPercent: 0.35,
  layerOptTolerance: 0.45,
  layerTurdSize: 4,
  layerTurnPolicy: "majority",
  posterize: true,
  removeWhite: false,
  removeTransparent: true,

  transparent: true,
  bgColor: "#ffffff",

  preprocess: "none",
  blurSigma: 0.8,
  edgeBoost: 1.0,
};

const routeCapabilities = getRouteCapabilities("png-to-svg-for-silhouette");

type ServerResult = {
  svg?: string;
  layers?: SvgLayerMeta[];
  error?: string;
  width?: number;
  height?: number;
  retryAfterMs?: number;
  code?: string;
  gate?: { running: number; queued: number };
};

type HistoryItem = {
  svg: string;
  layers?: EditableSvgLayer[];
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
  }, [file, autoMode]);

  // When a new server SVG arrives, push to history
  React.useEffect(() => {
    if (fetcher.data?.svg) {
      const item: HistoryItem = {
        svg: fetcher.data.svg,
        width: fetcher.data.width ?? 0,
        height: fetcher.data.height ?? 0,
        stamp: Date.now(),
        layers: (fetcher.data.layers ?? []).map((layer) => ({ ...layer })),
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
    void submitConvert(chosen, DEFAULTS);
  }

  async function submitConvert(targetFile = file, targetSettings = settings) {
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
      if (targetSettings.traceMode === "layered" || !targetSettings.invert) return targetSettings;
      const bg =
        !targetSettings.bgColor ||
        targetSettings.bgColor.toLowerCase() === "#ffffff" ||
        targetSettings.bgColor.toLowerCase() === "#fff"
          ? DARK_BG_DEFAULT
          : targetSettings.bgColor;

      return {
        ...settings,
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
    fd.append("invert", String(effective.invert));
    fd.append("traceMode", effective.traceMode);
    fd.append("colorLayerCount", String(effective.colorLayerCount));
    fd.append("layerMaxTraceSide", String(effective.layerMaxTraceSide));
    fd.append("minRegionPercent", String(effective.minRegionPercent));
    fd.append("layerOptTolerance", String(effective.layerOptTolerance));
    fd.append("layerTurdSize", String(effective.layerTurdSize));
    fd.append("layerTurnPolicy", effective.layerTurnPolicy);
    fd.append("posterize", String(effective.posterize));
    fd.append("removeWhite", String(effective.removeWhite));
    fd.append("removeTransparent", String(effective.removeTransparent));
    fd.append("transparent", String(effective.transparent));
    fd.append("bgColor", effective.bgColor);
    fd.append("preprocess", effective.preprocess);
    fd.append("blurSigma", String(effective.blurSigma));
    fd.append("edgeBoost", String(effective.edgeBoost));
    appendAdvancedTraceSettings(fd, effective);
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
  }, [file, autoMode]);

  // Disable logic identical on SSR and first client render
  const buttonDisabled = isServer || !hydrated || busy || !file;

  // Apply preset without carrying user overrides except background choices
  function buildPresetSettings(preset: Preset): Settings {
    return {
      ...DEFAULTS,
      traceMode: preset.settings.traceMode ?? "single",
      ...preset.settings,
    } as Settings;
  }

  function applyPreset(preset: Preset) {
    const nextSettings = buildPresetSettings(preset);
    setActivePreset(preset.id);
    setSettings(nextSettings);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (file && autoMode !== "off") {
      void submitConvert(file, nextSettings);
    }
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

  function getHistoryItemSvg(item: HistoryItem): string {
    return item.layers?.length
      ? applyLayerEditsToSvg(item.svg, item.layers)
      : item.svg;
  }

  function setHistoryLayer(
    stamp: number,
    layerId: string,
    patch: Partial<Pick<EditableSvgLayer, "color" | "visible" | "opacity">>,
  ) {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp !== stamp
          ? item
          : {
              ...item,
              layers: item.layers?.map((layer) =>
                layer.id === layerId ? { ...layer, ...patch } : layer,
              ),
            },
      ),
    );
  }

  function resetHistoryLayer(stamp: number, layerId: string) {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp !== stamp
          ? item
          : {
              ...item,
              layers: item.layers?.map((layer) =>
                layer.id === layerId
                  ? { ...layer, color: layer.originalColor, visible: true }
                  : layer,
              ),
            },
      ),
    );
  }

  function resetAllHistoryLayers(stamp: number) {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp !== stamp
          ? item
          : {
              ...item,
              layers: item.layers?.map((layer) => ({
                ...layer,
                color: layer.originalColor,
                visible: true,
              })),
            },
      ),
    );
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
                PNG to SVG for Silhouette
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
                  <TraceAdvancedSettingsPanel
                    id="advanced-settings"
                    open={showAdvanced}
                    settings={settings}
                    setSettings={setSettings}
                    capabilities={routeCapabilities}
                    detectedColorItems={history}
                    sourceFile={file}
                    removeColorsEnabled={!(file && (file.type === "image/svg+xml" || /\.svg$/i.test(file.name || "")))}
                    buttonDisabled={buttonDisabled}
                    onUpdatePreview={() => void submitConvert()}
                  />
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
                  onClick={() => void submitConvert()}
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
                    className="w-full h-auto block transparent-checkerboard"
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
                            const b = new Blob([getHistoryItemSvg(item)], {
                              type: "image/svg+xml;charset=utf-8",
                            });
                            const u = URL.createObjectURL(b);
                            const a = document.createElement("a");
                            a.href = u;
                            a.download = "silhouette-cut-file.svg";
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
                          onClick={() => handleCopySvg(getHistoryItemSvg(item))}
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
                        <img
                          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(getHistoryItemSvg(item))}`}
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
                    : "Converted Silhouette SVG files appear here...  "}
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
                PNG/JPEG to SVG for Silhouette Studio
              </p>
              <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                PNG to SVG for Silhouette Cameo, vinyl decals, stickers, and cut
                files
              </h2>
              <p className="text-slate-600 ">
                Convert PNG or JPEG artwork into clean SVG paths for Silhouette
                Studio projects, vinyl decals, paper crafts, stickers, stencils,
                labels, and simple cut-file cleanup. The converter keeps the
                same fast live preview and advanced tracing controls, but the
                guidance is tuned around Silhouette cutting workflows.
              </p>

              <p className="text-slate-600">
                Upload a high-contrast PNG or JPG, choose a Silhouette-focused
                preset, adjust the trace, then download an SVG you can inspect
                and clean up before cutting.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { k: "Cut-file focused", v: "Clean paths for simple shapes" },
                  {
                    k: "Vinyl and stencil use",
                    v: "Tune bold outlines and gaps",
                  },
                  {
                    k: "Transparent output",
                    v: "Best for reusable design files",
                  },
                  { k: "Live preview", v: "Adjust before you download" },
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

          {/* Use cases */}
          <section className="">
            <h3 className="text-lg font-bold">Best for Silhouette projects</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Vinyl decals",
                "Sticker outlines",
                "Paper crafts",
                "Stencils",
                "Labels",
                "Simple logos",
                "Line art",
                "Cut-file cleanup",
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
                  Cut lines and vinyl shapes
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Use “Silhouette Cut - Accurate trace” for clean source art and
                  “Silhouette Vinyl - Bold outline” when the design needs
                  stronger edges for decals, labels, or stencil-style work.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold">
                  Logos, icons, and lettering
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Use “Silhouette Logo - Clean shapes” for simple marks and
                  icons. For small lettering or thin details, use the
                  fine-detail preset and inspect the result before cutting.
                </p>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="mt-12">
            <h3 className="text-lg font-bold">
              How this Silhouette SVG converter works
            </h3>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-700">
                This page traces dark and light areas in a PNG or JPEG and turns
                them into SVG path data. That makes it useful for simple
                cut-file preparation, but it is not the same as a hand-built
                layered SVG. After downloading, open the SVG in your design
                software, check the cut lines, remove unwanted islands, and
                resize the design for your mat or material.
              </p>
              <p className="mt-3 text-sm text-slate-700">
                For best results, start with clean, high-resolution art with
                strong contrast. Screenshots, blurry photos, textured
                backgrounds, and tiny lettering usually need manual cleanup
                after tracing.
              </p>
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
                How to convert PNG to SVG for Silhouette
              </h3>
              <span className="text-xs text-slate-500">
                Fast path: upload → preset → tweak → export
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload a PNG or JPEG",
                  body: "Drag and drop your Silhouette design, vinyl decal artwork, sticker graphic, stencil, logo, or line-art image. Large files may be compressed locally for smoother preview up to 25 MB.",
                },
                {
                  title: "Choose a Silhouette-focused preset",
                  body: "Start with Accurate trace for clean artwork, Vinyl bold outline for stronger cut shapes, Fine lines for delicate art, or Seal gaps when edges need to close.",
                },
                {
                  title: "Adjust the trace",
                  body: "Tune threshold, curve tolerance, turd size, and turn policy until the preview gives you clean shapes without too many specks or broken lines.",
                },
                {
                  title:
                    "Keep transparency unless you need a preview background",
                  body: "Transparent SVG output is usually best for designs you plan to place, resize, or cut inside design software.",
                },
                {
                  title: "Download and inspect the SVG",
                  body: "Open the file in your Silhouette workflow, confirm the cut lines, and clean up any small islands, filled-in letters, or disconnected details before cutting.",
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

          {/* Silhouette guidance */}
          <section className="mt-12">
            <h3 className="text-lg font-bold">
              Tips for better Silhouette SVG results
            </h3>
            <p className="mt-2 text-sm text-slate-600 max-w-[80ch]">
              Cutting machines expose problems that look harmless on screen.
              Check the SVG before wasting vinyl, cardstock, sticker paper, or
              heat-transfer material.
            </p>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Use simple source artwork",
                  body: "Flat black artwork, icons, silhouettes, lettering, and high-contrast graphics trace better than textured photos or shaded illustrations.",
                },
                {
                  title: "Watch for tiny islands",
                  body: "Small disconnected pieces may be hard to weed or cut cleanly. Raise turd size to remove dust and accidental specks.",
                },
                {
                  title: "Seal broken shapes",
                  body: "If a cut shape has small gaps, try the Seal gaps preset or adjust threshold and turn policy before exporting.",
                },
                {
                  title: "Check letters before cutting",
                  body: "Small text can fill in or break apart during tracing. Rebuild critical text manually if the converted paths are not clean.",
                },
                {
                  title: "Use Designer Edition or above for SVG import",
                  body: "Silhouette Studio Basic users may need a compatible upgrade to open SVG files directly. Check your edition before relying on SVG import.",
                },
                {
                  title: "Do a test cut",
                  body: "Before cutting a full sheet, test a small version to confirm line quality, scale, and material settings.",
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
              Small tweaks can be the difference between a clean Silhouette cut
              file and a messy trace.
            </p>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Preprocess",
                  body: "Use None for logos, lettering, icons, and clean line art. Use Edge mode for photos or painted art when you only want contour-style SVG output.",
                },
                {
                  title: "Threshold",
                  body: "Controls what becomes part of the traced shape. Raise it to include lighter areas; lower it to keep only stronger dark marks.",
                },
                {
                  title: "Curve tolerance",
                  body: "Lower preserves detail. Higher smooths curves and may reduce SVG complexity for easier handling.",
                },
                {
                  title: "Turd size",
                  body: "Removes tiny specks, scanner dust, and accidental texture that you probably do not want sent to a cutter.",
                },
                {
                  title: "Turn policy",
                  body: "Controls how ambiguous corners resolve. Try a different policy if corners, holes, or narrow gaps look wrong.",
                },
                {
                  title: "Line color, invert, background",
                  body: "Most Silhouette SVG cut files should stay transparent. Use line color and invert mainly for preview graphics or dark-background assets.",
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
                  "Not ready to cut",
                  "A traced SVG may still need cleanup before cutting. Inspect paths, gaps, overlaps, small islands, and scale before sending it to your machine.",
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
                  q: "Can I use this SVG converter for Silhouette Studio?",
                  a: "Yes. It is useful for converting clean PNG or JPEG artwork into SVG paths for Silhouette Studio projects, vinyl decals, stickers, labels, stencils, paper crafts, and simple cut-file preparation. Always inspect the SVG before cutting.",
                },
                {
                  q: "Do I need Silhouette Studio Designer Edition to open SVG files?",
                  a: "Silhouette says SVG files can be opened in Silhouette Studio Designer Edition or above. If you use the Basic Edition, confirm your import options before relying on SVG files.",
                },
                {
                  q: "Will this make a layered Silhouette cut file?",
                  a: "No. This tool creates traced SVG paths from one raster image. It can help with simple cut-file preparation, but complex layered files usually need manual cleanup in design software.",
                },
                {
                  q: "What type of PNG works best?",
                  a: "High-contrast artwork works best: black line art, transparent PNG designs, flat logos, icons, lettering, silhouettes, decals, and stencil-style graphics. Low-resolution screenshots and noisy photos usually trace poorly.",
                },
                {
                  q: "Should I use a transparent background?",
                  a: "For most Silhouette cut files, yes. Transparent SVG output is easier to place on a mat, resize, and combine with other design elements. Use a solid background only when you intentionally need one.",
                },
                {
                  q: "What file limits apply?",
                  a: "PNG/JPEG up to 30 MB, ~30 MP. Preview is fastest ≤10 MB and throttled up to 25 MB. Above 25 MB we try on-device compression.",
                },
                {
                  q: "Can this convert photos into Silhouette cut files?",
                  a: "It can create stylized edge traces from photos, but it will not automatically produce a clean layered cut file. Photo-based projects usually need manual design work after conversion.",
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
