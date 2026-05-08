import * as React from "react";
import type { Route } from "./+types/image-to-svg-outline";
import {
  json,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import {
  annotateSharedSingleTraceSvg as annotateSharedSingleTraceSvgShared,
  neutralizeTransparencyCheckerboard as neutralizeTransparencyCheckerboardShared,
  runSharedLayeredColorTrace as runSharedLayeredColorTraceShared,
  runSharedPotraceSvgTrace as runSharedPotraceSvgTraceShared,
  runSharedRasterNormalization as runSharedRasterNormalizationShared,
} from "~/shared/tracing/serverFallback";
import { Link, type ActionFunctionArgs } from "react-router";
import { CurrentRouteGuide, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";
import {
  LayerPaletteEditor,
  LayeredTraceControls,
  type EditableSvgLayer,
  type SvgLayerMeta,
  type TraceMode,
} from "~/client/components/svg/LayerPaletteEditor";
import { PresetPicker } from "~/client/components/converter/PresetSelector";
import {
  FullscreenOutputPreview,
} from "~/client/components/converter/FullscreenOutputPreview";
import { extendTracePresets } from "~/client/lib/converter/presetAdditions";
import {
  getTraceOutputSvg,
  replaceTraceOutputCurrent,
  stepTraceOutputVersion,
  TraceOutputPanel,
  type TraceOutputItem,
  type TraceOutputLayerPatch,
} from "~/client/components/converter/TraceOutputPanel";
import { getRouteCapabilities } from "~/client/lib/converter/routeCapabilities";
import { useHybridTraceFetcher } from "~/client/lib/tracing/useHybridTraceFetcher";
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
  const title = "Image to SVG Outline Converter - Photo and Line Art Outlines | iLoveSVG";
  const description =
    "Convert PNG or JPG images into outline-style SVG with edge, line art, cleanup, and trace presets. Useful for decals, laser cutting, CNC, and simplified artwork.";
  const canonical = "https://www.ilovesvg.com/image-to-svg-outline";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },

    { tagName: "link", rel: "canonical", href: canonical },

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
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB
const MAX_MP = 30; // ~30 megapixels
const MAX_SIDE = 8000; // max width or height in pixels
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

// Live preview tiers (client)
const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 450;
const LIVE_MED_MS = 1700;

const PAGE_RATE_LIMITS = {
  perMinute: 120,
  perFiveMinutes: 400,
  perHour: 1500,
  perDay: 3000,
};

type RateLimitWindowName = "minute" | "fiveMinutes" | "hour" | "day";
type RateLimitWindowState = { count: number; resetAt: number };
type RateLimitRecord = Record<RateLimitWindowName, RateLimitWindowState>;
type BackendRateLimitResult =
  | {
      allowed: true;
      headers: Headers;
    }
  | {
      allowed: false;
      headers: Headers;
      retryAfterMs: number;
      retryAfterText: string;
    };

const RATE_LIMIT_WINDOWS: Array<{
  name: RateLimitWindowName;
  ms: number;
  limit: number;
  limitHeader: string;
  remainingHeader: string;
}> = [
  {
    name: "minute",
    ms: 60 * 1000,
    limit: PAGE_RATE_LIMITS.perMinute,
    limitHeader: "X-RateLimit-Limit-Minute",
    remainingHeader: "X-RateLimit-Remaining-Minute",
  },
  {
    name: "fiveMinutes",
    ms: 5 * 60 * 1000,
    limit: PAGE_RATE_LIMITS.perFiveMinutes,
    limitHeader: "X-RateLimit-Limit-Five-Minutes",
    remainingHeader: "X-RateLimit-Remaining-Five-Minutes",
  },
  {
    name: "hour",
    ms: 60 * 60 * 1000,
    limit: PAGE_RATE_LIMITS.perHour,
    limitHeader: "X-RateLimit-Limit-Hour",
    remainingHeader: "X-RateLimit-Remaining-Hour",
  },
  {
    name: "day",
    ms: 24 * 60 * 60 * 1000,
    limit: PAGE_RATE_LIMITS.perDay,
    limitHeader: "X-RateLimit-Limit-Day",
    remainingHeader: "X-RateLimit-Remaining-Day",
  },
];

function getRateLimitStore(): Map<string, RateLimitRecord> {
  const g = globalThis as any;
  if (!g.__ilovesvg_action_rate_limits) {
    g.__ilovesvg_action_rate_limits = new Map<string, RateLimitRecord>();
  }
  return g.__ilovesvg_action_rate_limits as Map<string, RateLimitRecord>;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function normalizeKeyPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "_")
    .slice(0, 160);
}

function getBackendRateLimitKey(
  request: Request,
  routeName: string,
  actionName: string,
): string {
  const ip = normalizeKeyPart(getClientIp(request));
  const ua = normalizeKeyPart(request.headers.get("user-agent") || "unknown");
  return `${ip}:${ua}:${normalizeKeyPart(routeName)}:${normalizeKeyPart(
    actionName,
  )}`;
}

function createFreshRateLimitRecord(now: number): RateLimitRecord {
  return {
    minute: { count: 0, resetAt: now + 60 * 1000 },
    fiveMinutes: { count: 0, resetAt: now + 5 * 60 * 1000 },
    hour: { count: 0, resetAt: now + 60 * 60 * 1000 },
    day: { count: 0, resetAt: now + 24 * 60 * 60 * 1000 },
  };
}

function formatRetryAfter(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function checkBackendConversionRateLimit(
  request: Request,
  routeName: string,
  actionName: string,
): BackendRateLimitResult {
  const now = Date.now();
  const store = getRateLimitStore();
  const key = getBackendRateLimitKey(request, routeName, actionName);
  const record = store.get(key) ?? createFreshRateLimitRecord(now);

  for (const windowConfig of RATE_LIMIT_WINDOWS) {
    const state = record[windowConfig.name];
    if (now >= state.resetAt) {
      state.count = 0;
      state.resetAt = now + windowConfig.ms;
    }
  }

  const exceeded = RATE_LIMIT_WINDOWS.filter(
    (windowConfig) => record[windowConfig.name].count >= windowConfig.limit,
  );

  const headers = new Headers();
  for (const windowConfig of RATE_LIMIT_WINDOWS) {
    const state = record[windowConfig.name];
    headers.set(windowConfig.limitHeader, String(windowConfig.limit));
    headers.set(
      windowConfig.remainingHeader,
      String(Math.max(0, windowConfig.limit - state.count)),
    );
  }

  if (exceeded.length > 0) {
    const retryAfterMs = Math.max(
      1000,
      Math.min(
        ...exceeded.map(
          (windowConfig) => record[windowConfig.name].resetAt - now,
        ),
      ),
    );
    headers.set("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
    store.set(key, record);
    return {
      allowed: false,
      headers,
      retryAfterMs,
      retryAfterText: formatRetryAfter(retryAfterMs),
    };
  }

  for (const windowConfig of RATE_LIMIT_WINDOWS) {
    record[windowConfig.name].count += 1;
  }

  for (const windowConfig of RATE_LIMIT_WINDOWS) {
    const state = record[windowConfig.name];
    headers.set(
      windowConfig.remainingHeader,
      String(Math.max(0, windowConfig.limit - state.count)),
    );
  }

  store.set(key, record);
  return { allowed: true, headers };
}

// Concurrency gate (server)
type ReleaseFn = () => void;
type Gate = {
  acquireOrQueue: () => Promise<ReleaseFn>;
  running: number;
  queued: number;
};

async function getGate(): Promise<Gate> {
  const { getConversionGate } = await import("~/utils/conversionGate.server");
  return getConversionGate();
}

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

    // Early reject before parsing multipart
    const contentLength = Number(request.headers.get("content-length") || "0");
    const MAX_OVERHEAD = 5 * 1024 * 1024;
    if (contentLength && contentLength > MAX_UPLOAD_BYTES + MAX_OVERHEAD) {
      return json(
        { error: "Upload too large. Please resize and try again." },
        { status: 413 },
      );
    }

    const rateLimit = checkBackendConversionRateLimit(
      request,
      "image-to-svg-outline",
      "raster-trace",
    );
    if (!rateLimit.allowed) {
      return json(
        {
          error: `Too many conversions from this connection. Please try again in ${rateLimit.retryAfterText}.`,
          retryAfterMs: rateLimit.retryAfterMs,
          code: "RATE_LIMITED",
        },
        { status: 429, headers: rateLimit.headers },
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
    const requestId = String(form.get("requestId") ?? "").trim();
    const presetId = String(form.get("presetId") ?? "").trim();
    if (!ALLOWED_MIME.has(webFile.type)) {
      return json(
        { error: "Only PNG or JPEG images are allowed." },
        { status: 415 },
      );
    }
    if ((webFile.size || 0) > MAX_UPLOAD_BYTES) {
      return json(
        {
          error: `File too large. Max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
        },
        { status: 413 },
      );
    }

    // Acquire concurrency slot before reading bytes into RAM
    const gate = await getGate();
    let release: ReleaseFn | null = null;

    try {
      release = await gate.acquireOrQueue();
    } catch (e: any) {
      const retryAfterMs = Math.max(1000, Number(e?.retryAfterMs) || 1500);
      return json(
        {
          requestId,
          presetId,
          error:
            "Server is busy converting other images. We'll retry automatically.",
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
      let input: Buffer = Buffer.from(ab);

      const { validateFileSignature } = await import("~/utils/backendSecurity.server");
      const signatureError = validateFileSignature(input, webFile, ALLOWED_MIME);
      if (signatureError) return signatureError;

      // Authoritative dimension guard (cheap header decode via sharp)
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
        // best-effort only
      }

      // Settings with outline defaults
      const threshold = Number(form.get("threshold") ?? 232);
      const turdSize = Number(form.get("turdSize") ?? 2);
      const optTolerance = Number(form.get("optTolerance") ?? 0.45);
      const turnPolicy = String(form.get("turnPolicy") ?? "majority") as
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

      // Preprocess (outline page defaults to edge)
      const preprocess = String(form.get("preprocess") ?? "edge") as
        | "none"
        | "edge";
      const blurSigma = Number(form.get("blurSigma") ?? 0.9);
      const edgeBoost = Number(form.get("edgeBoost") ?? 1.2);
      const {
        applyTraceSvgOutputSettings,
        readAdvancedTraceFormSettings,
        shouldRemoveSelectedColors,
      } = await import("../utils/converterSettings.server");
      const advancedTraceSettings = readAdvancedTraceFormSettings(form);

      const traceMode = String(form.get("traceMode") ?? "single") as TraceMode;
      const routeLayeredTrace = runSharedLayeredColorTraceShared;
      const routeAnnotateSingleTrace = annotateSharedSingleTraceSvgShared;
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
        const routeLayeredTraceAdapter = runSharedLayeredColorTraceShared;
        const layered = await routeLayeredTraceAdapter(input, {
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
          fillStrokeWidth: advancedTraceSettings.fillStrokeWidth,
          fillStrokeColor: advancedTraceSettings.fillStrokeColor,
        });

        return json({
          requestId,
          presetId,
          svg: layered.svg,
          layers: layered.layers,
          width: layered.width,
          height: layered.height,
          engineUsed: "potrace",
          sourceKind: "raster",
          gate: { running: gate.running, queued: gate.queued },
        });
      }

      const routeRasterNormalize = runSharedRasterNormalizationShared;
      const prepped = await routeRasterNormalize(input, {
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

      const routePotraceTrace = runSharedPotraceSvgTraceShared;
      const opts: any = {
        color: lineColor,
        threshold,
        turdSize,
        optTolerance,
        turnPolicy,
        invert,
        blackOnWhite: !invert,
      };

      const svgRaw: string = await routePotraceTrace(prepped, opts);

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
      const editable = routeAnnotateSingleTrace(finalSVG, lineColor);

      return json({
        requestId,
        presetId,
        svg: editable.svg,
        layers: editable.layers,
        width: ensured.width,
        height: ensured.height,
        engineUsed: "potrace",
        sourceKind: "raster",
        gate: { running: gate.running, queued: gate.queued },
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

  transparent: boolean;
  bgColor: string;

  preprocess: "none" | "edge";
  blurSigma: number;
  edgeBoost: number;
};

type Preset = { id: string; label: string; settings: Partial<Settings> };

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
    id: "outline-clean",
    label: "Clean outline",
    settings: {
      preprocess: "edge",
      blurSigma: 0.85,
      edgeBoost: 1.2,
      threshold: 232,
      turdSize: 2,
      optTolerance: 0.42,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "photo-balanced",
    label: "Photo balanced",
    settings: {
      preprocess: "edge",
      blurSigma: 1.05,
      edgeBoost: 1.15,
      threshold: 224,
      turdSize: 3,
      optTolerance: 0.5,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "photo-soft-contours",
    label: "Photo soft contours",
    settings: {
      preprocess: "edge",
      blurSigma: 1.85,
      edgeBoost: 0.78,
      threshold: 208,
      turdSize: 6,
      optTolerance: 0.72,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "photo-bold-edges",
    label: "Photo bold edges",
    settings: {
      preprocess: "edge",
      blurSigma: 0.45,
      edgeBoost: 1.9,
      threshold: 242,
      turdSize: 2,
      optTolerance: 0.36,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "fine-detail",
    label: "Fine detail",
    settings: {
      preprocess: "edge",
      blurSigma: 0.25,
      edgeBoost: 2.15,
      threshold: 236,
      turdSize: 0,
      optTolerance: 0.22,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "minimal-outline",
    label: "Minimal outline",
    settings: {
      preprocess: "edge",
      blurSigma: 2.2,
      edgeBoost: 0.7,
      threshold: 202,
      turdSize: 10,
      optTolerance: 0.92,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "remove-grid-noise",
    label: "Remove grid/noise",
    settings: {
      preprocess: "edge",
      blurSigma: 2.55,
      edgeBoost: 0.62,
      threshold: 198,
      turdSize: 12,
      optTolerance: 0.82,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "screenshot-cleanup",
    label: "Screenshot cleanup",
    settings: {
      preprocess: "edge",
      blurSigma: 2.05,
      edgeBoost: 0.72,
      threshold: 212,
      turdSize: 9,
      optTolerance: 0.78,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "ui-wireframe",
    label: "UI wireframe",
    settings: {
      preprocess: "edge",
      blurSigma: 1.65,
      edgeBoost: 0.88,
      threshold: 246,
      turdSize: 11,
      optTolerance: 1.0,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "dark-ui-screenshot",
    label: "Dark UI screenshot",
    settings: {
      preprocess: "edge",
      blurSigma: 0.7,
      edgeBoost: 1.75,
      threshold: 246,
      turdSize: 5,
      optTolerance: 0.58,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "product-cutout",
    label: "Product cutout",
    settings: {
      preprocess: "edge",
      blurSigma: 1.35,
      edgeBoost: 1.05,
      threshold: 240,
      turdSize: 8,
      optTolerance: 0.86,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "sticker-cutline",
    label: "Sticker cutline",
    settings: {
      preprocess: "edge",
      blurSigma: 2.4,
      edgeBoost: 0.82,
      threshold: 250,
      turdSize: 14,
      optTolerance: 1.05,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "portrait-clean",
    label: "Portrait clean",
    settings: {
      preprocess: "edge",
      blurSigma: 1.45,
      edgeBoost: 0.96,
      threshold: 214,
      turdSize: 4,
      optTolerance: 0.62,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "portrait-feature-detail",
    label: "Portrait feature detail",
    settings: {
      preprocess: "edge",
      blurSigma: 0.75,
      edgeBoost: 1.55,
      threshold: 228,
      turdSize: 2,
      optTolerance: 0.4,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "pencil-sketch",
    label: "Pencil sketch",
    settings: {
      preprocess: "edge",
      blurSigma: 0.35,
      edgeBoost: 2.35,
      threshold: 218,
      turdSize: 0,
      optTolerance: 0.24,
      turnPolicy: "minority",
      lineColor: "#111827",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "comic-ink",
    label: "Comic ink",
    settings: {
      preprocess: "edge",
      blurSigma: 0.55,
      edgeBoost: 2.05,
      threshold: 248,
      turdSize: 3,
      optTolerance: 0.46,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "illustration-clean",
    label: "Illustration clean",
    settings: {
      preprocess: "edge",
      blurSigma: 0.95,
      edgeBoost: 1.35,
      threshold: 226,
      turdSize: 2,
      optTolerance: 0.44,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "line-art-original",
    label: "Line art original",
    settings: {
      preprocess: "none",
      threshold: 232,
      turdSize: 1,
      optTolerance: 0.28,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "ink-scan-clean",
    label: "Ink scan cleanup",
    settings: {
      preprocess: "none",
      threshold: 218,
      turdSize: 5,
      optTolerance: 0.38,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "ink-scan-heavy",
    label: "Ink scan heavy cleanup",
    settings: {
      preprocess: "none",
      threshold: 204,
      turdSize: 9,
      optTolerance: 0.7,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "logo-clean-shapes",
    label: "Logo clean shapes",
    settings: {
      preprocess: "none",
      threshold: 210,
      turdSize: 4,
      optTolerance: 0.58,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "logo-fine-details",
    label: "Logo fine details",
    settings: {
      preprocess: "none",
      threshold: 242,
      turdSize: 0,
      optTolerance: 0.2,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "wordmark-text",
    label: "Wordmark / text",
    settings: {
      preprocess: "none",
      threshold: 238,
      turdSize: 1,
      optTolerance: 0.34,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "laser-cnc-simple",
    label: "Laser/CNC simple",
    settings: {
      preprocess: "none",
      threshold: 200,
      turdSize: 10,
      optTolerance: 0.95,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "laser-cnc-detail",
    label: "Laser/CNC detail",
    settings: {
      preprocess: "none",
      threshold: 224,
      turdSize: 3,
      optTolerance: 0.52,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "low-contrast-boost",
    label: "Low contrast boost",
    settings: {
      preprocess: "edge",
      blurSigma: 0.65,
      edgeBoost: 2.6,
      threshold: 246,
      turdSize: 2,
      optTolerance: 0.4,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "faint-artwork-rescue",
    label: "Faint artwork rescue",
    settings: {
      preprocess: "edge",
      blurSigma: 0.35,
      edgeBoost: 3.0,
      threshold: 252,
      turdSize: 1,
      optTolerance: 0.32,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "white-outline-dark",
    label: "White outline on black",
    settings: {
      preprocess: "edge",
      blurSigma: 0.85,
      edgeBoost: 1.25,
      threshold: 232,
      turdSize: 2,
      optTolerance: 0.42,
      turnPolicy: "majority",
      invert: true,
      lineColor: "#ffffff",
      transparent: false,
      bgColor: "#0b1020",
    },
  },
  {
    id: "blueprint-lines",
    label: "Blueprint lines",
    settings: {
      preprocess: "edge",
      blurSigma: 0.75,
      edgeBoost: 1.55,
      threshold: 238,
      turdSize: 3,
      optTolerance: 0.5,
      turnPolicy: "black",
      invert: true,
      lineColor: "#38bdf8",
      transparent: false,
      bgColor: "#0f172a",
    },
  },
];

const PRESET_LABELS = Object.fromEntries(
  PRESETS.map((preset) => [preset.id, preset.label]),
) as Record<string, string>;

function getPresetLabel(presetId?: string | null): string {
  if (!presetId) return "Custom settings";
  return PRESET_LABELS[presetId] || "Custom settings";
}

const DISPLAY_PRESETS = extendTracePresets<Preset>(PRESETS);

const DEFAULTS: Settings = {
  ...DEFAULT_TRACE_ADVANCED_SETTINGS,
  threshold: 232,
  turdSize: 2,
  optTolerance: 0.45,
  turnPolicy: "majority",
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

  preprocess: "edge",
  blurSigma: 0.9,
  edgeBoost: 1.2,
};

const routeCapabilities = getRouteCapabilities("image-to-svg-outline");

type ServerResult = {
  requestId?: string;
  presetId?: string;
  svg?: string;
  layers?: SvgLayerMeta[];
  error?: string;
  width?: number;
  height?: number;
  engineUsed?: "vtracer" | "potrace" | "centerline";
  sourceKind?: "svg" | "raster";
  warnings?: string[];
  timings?: Record<string, number>;
  layerBuildMode?: string;
  requestedPaletteCount?: number;
  actualPaletteCount?: number;
  outputDetectedColors?: number;
  pathCount?: number;
  svgBytes?: number;
  retryAfterMs?: number;
  code?: string;
  gate?: { running: number; queued: number };
};

type HistoryItem = {
  requestId: string;
  presetId: string | null;
  presetLabel: string;
  svg: string;
  layers?: EditableSvgLayer[];
  width: number;
  height: number;
  engineUsed?: "vtracer" | "potrace" | "centerline";
  sourceKind?: "svg" | "raster";
  warnings?: string[];
  timings?: Record<string, number>;
  layerBuildMode?: string;
  requestedPaletteCount?: number;
  actualPaletteCount?: number;
  outputDetectedColors?: number;
  pathCount?: number;
  svgBytes?: number;
  stamp: number;
};

type SubmitReason = "upload" | "preset" | "manual" | "live" | "retry";

type SubmitPlan = {
  requestId: string;
  file: File;
  settings: Settings;
  presetId: string | null;
  presetLabel: string;
  reason: SubmitReason;
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
  return "";
}
function autoModeDetail(mode: AutoMode): string {
  if (mode === "medium")
    return "Large file; updates run less often to keep the page responsive.";
  return "";
}

function createClientRequestId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function ImageToSvgOutline({
  loaderData,
}: Route.ComponentProps) {
  const fetcher = useHybridTraceFetcher<ServerResult>({ routeId: "image-to-svg-outline" });

  const [file, setFile] = React.useState<File | null>(null);
  const [originalFileSize, setOriginalFileSize] = React.useState<number | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] =
    React.useState<string>("outline-clean");

  const busy = fetcher.state !== "idle";
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const [dims, setDims] = React.useState<{
    w: number;
    h: number;
    mp: number;
  } | null>(null);

  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [updatingOutputStamp, setUpdatingOutputStamp] = React.useState<
    number | null
  >(null);
  const pendingReplaceStampRef = React.useRef<number | null>(null);
  const pendingOutputSettingsRef = React.useRef<Settings | null>(null);
  const [fullscreenPreviewIndex, setFullscreenPreviewIndex] = React.useState<
    number | null
  >(null);
  const [autoMode, setAutoMode] = React.useState<AutoMode>("off");
  const retryTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const latestPlanRef = React.useRef<SubmitPlan | null>(null);
  const lastAcceptedRequestIdRef = React.useRef<string>("");

  React.useEffect(() => {
    const data = fetcher.data;
    if (!data) return;

    if (data.error) setErr(data.error);
    else setErr(null);

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (data.retryAfterMs && data.code === "BUSY") {
      const plan = latestPlanRef.current;
      if (!plan) return;

      const ms = Math.max(800, data.retryAfterMs);
      setInfo(`Server busy, retrying in ${(ms / 1000).toFixed(1)}s`);
      const requestIdForRetry = plan.requestId;
      retryTimeoutRef.current = setTimeout(() => {
        if (latestPlanRef.current?.requestId !== requestIdForRetry) return;
        void submitPlan(plan, false);
      }, ms);
      return;
    }

    if (data.svg) {
      const expectedRequestId = latestPlanRef.current?.requestId || "";
      if (data.requestId && expectedRequestId && data.requestId !== expectedRequestId) {
        return;
      }

      if (data.requestId && lastAcceptedRequestIdRef.current === data.requestId) {
        return;
      }

      const settingsSnapshot =
        pendingOutputSettingsRef.current ?? latestPlanRef.current?.settings ?? settings;
      const replaceStamp = pendingReplaceStampRef.current;
      const item: HistoryItem & TraceOutputItem<Settings> = {
        requestId: data.requestId || createClientRequestId(),
        presetId: data.presetId || latestPlanRef.current?.presetId || null,
        presetLabel: getPresetLabel(
          data.presetId || latestPlanRef.current?.presetId || null,
        ),
        svg: data.svg,
        layers: (data.layers ?? []).map((layer) => ({ ...layer })),
        width: data.width ?? 0,
        height: data.height ?? 0,
        engineUsed: data.engineUsed,
        sourceKind: data.sourceKind,
        warnings: data.warnings,
        timings: data.timings,
        stamp: Date.now(),
        settingsSnapshot,
        draftSettings: settingsSnapshot,
      };

      lastAcceptedRequestIdRef.current = item.requestId;
      setHistory((prev) => {
        if (replaceStamp) {
          return prev.map((existing) =>
            existing.stamp === replaceStamp
              ? (replaceTraceOutputCurrent(
                  existing as HistoryItem & TraceOutputItem<Settings>,
                  item,
                ) as HistoryItem)
              : existing,
          );
        }

        const withoutSameRequest = prev.filter(
          (entry) => entry.requestId !== item.requestId,
        );
        return [item, ...withoutSameRequest].slice(0, 10);
      });
      pendingReplaceStampRef.current = null;
      pendingOutputSettingsRef.current = null;
      setUpdatingOutputStamp(null);
      setInfo(null);
      return;
    }

    if (data.error && pendingReplaceStampRef.current) {
      const replaceStamp = pendingReplaceStampRef.current;
      setHistory((prev) =>
        prev.map((item) =>
          item.stamp === replaceStamp
            ? {
                ...item,
                updateError:
                  data.error ||
                  "Could not update this output. The current preview was preserved.",
              }
            : item,
        ),
      );
      pendingReplaceStampRef.current = null;
      pendingOutputSettingsRef.current = null;
      setUpdatingOutputStamp(null);
      return;
    }

    if (!data.error) setInfo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  React.useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

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
    const input = e.currentTarget;
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    await handleNewFile(f);
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
    setHistory([]);
    latestPlanRef.current = null;
    lastAcceptedRequestIdRef.current = "";
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    let chosen = f;

    // Over server max: attempt immediate compress (block if impossible)
    if (f.size > MAX_UPLOAD_BYTES) {
      setInfo("Huge file detected, compressing on your device");
      try {
        chosen = await compressToTarget25MB(f);
      } catch (e: any) {
        setInfo(null);
        setErr(
          e?.message || "This image is too large. Please resize and try again.",
        );
        setFile(null);
        setPreviewUrl(null);
        setAutoMode("off");
        setOriginalFileSize(null);
        return;
      }
    } else if (f.size > LIVE_MED_MAX) {
      setInfo("Large file detected, compressing on your device for preview");
      try {
        const shrunk = await compressToTarget25MB(f);
        chosen = shrunk;
        setInfo(`Compressed on-device to ${prettyBytes(shrunk.size)}.`);
      } catch (e: any) {
        setErr(
          e?.message ||
            "Could not compress below 25 MB. Live preview will be disabled.",
        );
        setInfo(null);
        chosen = f;
      }
    }

    if (chosen.size > MAX_UPLOAD_BYTES) {
      setErr(
        `File too large. Max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
      );
      setInfo(null);
      setFile(null);
      setPreviewUrl(null);
      setAutoMode("off");
      setOriginalFileSize(null);
      return;
    }

    const nextAutoMode = getAutoMode(chosen.size);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    skipNextAutoSubmitRef.current = true;
    setFile(chosen);
    setAutoMode(nextAutoMode);
    const url = URL.createObjectURL(chosen);
    setPreviewUrl(url);
    await measureAndSet(chosen);

    if (nextAutoMode !== "off") {
      await submitConvertWith(chosen, settings, {
        presetId: activePreset,
        presetLabel: getPresetLabel(activePreset),
        reason: "upload",
      });
    }
  }

  function normalizeSettingsForSubmit(targetSettings: Settings): Settings {
    if (targetSettings.traceMode === "layered" || !targetSettings.invert) {
      return targetSettings;
    }

    return {
      ...targetSettings,
      transparent: false,
      bgColor:
        !targetSettings.bgColor ||
        targetSettings.bgColor.toLowerCase() === "#ffffff" ||
        targetSettings.bgColor.toLowerCase() === "#fff"
          ? "#0b1020"
          : targetSettings.bgColor,
      lineColor:
        targetSettings.lineColor?.toLowerCase() === "#000000"
          ? "#ffffff"
          : targetSettings.lineColor,
    };
  }

  async function submitPlan(plan: SubmitPlan, makeLatest = true) {
    if (!plan.file) {
      setErr("Choose an image first.");
      return;
    }

    try {
      await validateBeforeSubmit(plan.file);
    } catch (e: any) {
      setErr(e?.message || "Image is too large.");
      return;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (makeLatest) {
      latestPlanRef.current = plan;
      setInfo(null);
    }

    const effective = normalizeSettingsForSubmit(plan.settings);

    const fd = new FormData();
    fd.append("requestId", plan.requestId);
    if (plan.presetId) fd.append("presetId", plan.presetId);
    fd.append("file", plan.file);
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

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action: `${window.location.pathname}?index`,
    });
  }

  async function submitConvertWith(
    targetFile: File | null,
    targetSettings: Settings,
    opts?: {
      presetId?: string | null;
      presetLabel?: string;
      reason?: SubmitReason;
      requestId?: string;
    },
  ) {
    if (!targetFile) {
      setErr("Choose an image first.");
      return;
    }

    const plan: SubmitPlan = {
      requestId: opts?.requestId || createClientRequestId(),
      file: targetFile,
      settings: targetSettings,
      presetId: opts?.presetId ?? null,
      presetLabel: opts?.presetLabel || getPresetLabel(opts?.presetId ?? null),
      reason: opts?.reason || "manual",
    };

    await submitPlan(plan, true);
  }

  async function submitConvert() {
    await submitConvertWith(file, settings, {
      presetId: activePreset || null,
      presetLabel: getPresetLabel(activePreset),
      reason: "manual",
    });
  }

  // Tiered live preview. Advanced settings are manual-only; uploads and
  // presets submit exact payloads directly to avoid stale React state.
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutoSubmitRef = React.useRef(false);

  React.useEffect(() => {
    if (!file) return;
    if (skipNextAutoSubmitRef.current) {
      skipNextAutoSubmitRef.current = false;
      return;
    }
    if (autoMode === "off") return;

    const delay = autoMode === "fast" ? LIVE_FAST_MS : LIVE_MED_MS;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      submitConvertWith(file, settings, {
        presetId: activePreset || null,
        presetLabel: getPresetLabel(activePreset),
        reason: "live",
      });
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Only file/auto-mode changes may trigger this fallback. Presets submit
    // computed settings directly, and advanced controls wait for Convert or
    // Update preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, autoMode]);

  const buttonDisabled = isServer || !hydrated || busy || !file;

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
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (file && getAutoMode(file.size) !== "off") {
      void submitConvertWith(file, nextSettings, {
        presetId: preset.id,
        presetLabel: preset.label,
        reason: "preset",
      });
      return;
    }

    if (file) {
      setInfo(`Preset selected: ${preset.label}. Click Convert to apply it.`);
    }
  }

  const [toast, setToast] = React.useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }
  function handleCopySvg(svg: string) {
    navigator.clipboard.writeText(svg).then(() => showToast("SVG copied"));
  }

  function getHistoryItemSvg(item: HistoryItem): string {
    return getTraceOutputSvg(item as HistoryItem & TraceOutputItem<Settings>);
  }

  function toggleOutputSettings(stamp: number) {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp === stamp
          ? {
              ...item,
              settingsOpen: !(item as HistoryItem & TraceOutputItem<Settings>)
                .settingsOpen,
            }
          : item,
      ),
    );
  }

  function updateOutputDraftSettings(
    stamp: number,
    updater: React.SetStateAction<Settings>,
  ) {
    setHistory((prev) =>
      prev.map((item) => {
        if (item.stamp !== stamp) return item;

        const outputItem = item as HistoryItem & TraceOutputItem<Settings>;
        const current =
          outputItem.draftSettings ?? outputItem.settingsSnapshot ?? settings;
        const next =
          typeof updater === "function"
            ? (updater as (value: Settings) => Settings)(current)
            : updater;

        return {
          ...item,
          draftSettings: next,
        };
      }),
    );
  }

  function submitOutputUpdate(stamp: number) {
    const item = history.find((candidate) => candidate.stamp === stamp) as
      | (HistoryItem & TraceOutputItem<Settings>)
      | undefined;
    if (!item) return;

    const nextSettings =
      item.draftSettings ?? item.settingsSnapshot ?? settings;
    pendingReplaceStampRef.current = stamp;
    pendingOutputSettingsRef.current = nextSettings;
    setUpdatingOutputStamp(stamp);
    void submitConvertWith(file, nextSettings, {
      presetId: item.presetId ?? activePreset ?? null,
      presetLabel: item.presetLabel || getPresetLabel(item.presetId ?? activePreset ?? null),
      reason: "manual",
    });
  }

  function stepOutputVersion(stamp: number, direction: "previous" | "next") {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp === stamp
          ? (stepTraceOutputVersion(
              item as HistoryItem & TraceOutputItem<Settings>,
              direction,
            ) as HistoryItem)
          : item,
      ),
    );
  }

  function setHistoryLayer(
    stamp: number,
    layerId: string,
    patch: TraceOutputLayerPatch,
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
                  ? {
                      ...layer,
                      color: layer.originalColor,
                      visible: true,
                      opacity: layer.originalOpacity ?? 1,
                    }
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
                opacity: layer.originalOpacity ?? 1,
              })),
            },
      ),
    );
  }

  function setHistorySize(
    stamp: number,
    size: { width: number; height: number },
  ) {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp === stamp
          ? {
              ...item,
              width: size.width,
              height: size.height,
            }
          : item,
      ),
    );
  }

  return (
    <>
      <main className="bg-slate-50 text-[#0f2537]">
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

          <section className="grid grid-cols-1 gap-4 items-start sm:pt-5 md:grid-cols-2 lg:pt-0 lg:pb-8">
            {/* INPUT */}
            <div className="order-1 min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] sm:border sm:border-slate-200">
              <h1 className="flex mb-3 text-sky-800 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none m-0">
                Image to SVG Outline
              </h1>

              {/* Presets */}
              <PresetPicker
                presets={DISPLAY_PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />


              {!file ? (
                <DragArea
                  onPick={onPick}
                  onDrop={onDrop}
                  MAX_MP={MAX_MP}
                  MAX_SIDE={MAX_SIDE}
                  MAX_UPLOAD_BYTES={MAX_UPLOAD_BYTES}
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
                        {originalFileSize && originalFileSize > file.size
                          ? ` (shrunk from ${prettyBytes(originalFileSize)})`
                          : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (debounceRef.current)
                          clearTimeout(debounceRef.current);
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setFile(null);
                        setPreviewUrl(null);
                        setAutoMode("off");
                        setDims(null);
                        setErr(null);
                        setInfo(null);
                        setOriginalFileSize(null);
                        latestPlanRef.current = null;
                        lastAcceptedRequestIdRef.current = "";
                        if (retryTimeoutRef.current) {
                          clearTimeout(retryTimeoutRef.current);
                          retryTimeoutRef.current = null;
                        }
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

              {/* Convert button + status */}
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
                  <Icons name="convert" size={16} className="mr-2" />
                  {busy ? "Converting…" : "Convert to outline"}
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

            </div>

            {previewUrl && (
              <div className="order-4 hidden min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:col-start-1 md:row-start-3 md:flex">
                <p className="m-0 border-b border-slate-100 px-3 py-2 text-[13px] font-semibold text-slate-700">
                  Original image
                </p>
                <img
                  src={previewUrl}
                  alt="Input"
                  className="relative block h-auto w-full transparent-checkerboard"
                />
              </div>
            )}

            <TraceOutputPanel
              history={history}
              busy={busy}
              buttonDisabled={buttonDisabled}
              updatingStamp={updatingOutputStamp}
              file={file}
              fallbackSettings={settings}
              routeCapabilities={routeCapabilities}
              downloadLabel="Download SVG"
              downloadFileName="image-to-svg-outline.svg"
              emptyTitle="Converted outline SVG files appear here..."
              emptyDescription="Convert your image to preview, copy, or download the outline SVG."
              fullscreenPreviewIndex={fullscreenPreviewIndex}
              setFullscreenPreviewIndex={setFullscreenPreviewIndex}
              onCopySvg={handleCopySvg}
              onToggleSettings={toggleOutputSettings}
              onDraftSettingsChange={updateOutputDraftSettings}
              onUpdatePreview={submitOutputUpdate}
              onStepVersion={stepOutputVersion}
              onOutputLayerChange={setHistoryLayer}
              onResetOutputLayer={resetHistoryLayer}
              onResetAllOutputLayers={resetAllHistoryLayers}
              onOutputSizeChange={setHistorySize}
            />
          </section>
        </div>

        <FullscreenOutputPreview
          items={history}
          activeIndex={fullscreenPreviewIndex}
          setActiveIndex={setFullscreenPreviewIndex}
          getPreviewImage={(item, index) => ({
            id: String(item.stamp),
            label: `Output ${index + 1}`,
            svg: getHistoryItemSvg(item),
            width: item.width,
            height: item.height,
            kind: "SVG",
          })}
        />

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

/* ===== Client-side helpers (dimension precheck + compression <=25MB) ===== */
async function getImageSize(file: File): Promise<{ w: number; h: number }> {
  if ("createImageBitmap" in window) {
    const bmp = await createImageBitmap(file);
    try {
      return { w: bmp.width, h: bmp.height };
    } finally {
      bmp.close?.();
    }
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

/** Compress to <=25MB (best effort). Converts PNG -> JPEG if needed. */
async function compressToTarget25MB(file: File): Promise<File> {
  const TARGET = LIVE_MED_MAX; // 25MB
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

  const qualities = [0.9, 0.8, 0.7, 0.6, 0.5];
  for (const q of qualities) {
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
    "This image cannot be reduced below 25 MB without heavy quality loss.",
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
      className="w-[110px] px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 hover:border-sky-300"
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

/* ===== SEO sections (outline-specific copy) ===== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-8 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-8">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              PNG/JPG to SVG outline
            </p>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">
              Convert images into clean SVG outlines
            </h2>
            <p className="text-slate-600 max-w-[80ch]">
              This page focuses on outline extraction, not full photo
              vectorization. It is built for contour-style linework so you can
              create stickers, icons, simplified drawings, and stylized edge
              vectors quickly.
            </p>
            {/* Outline-specific tips */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold">Outline tuning tips</div>
              <ul className="mt-2 text-sm text-slate-600 list-disc pl-5">
                <li>
                  Too many tiny edges or square artifacts: try the Remove
                  grid/noise preset, increase <b>blur σ</b>, and increase{" "}
                  <b>turd size</b>.
                </li>
                <li>
                  Edges are too faint: increase <b>edge boost</b> or raise{" "}
                  <b>threshold</b>.
                </li>
                <li>
                  Curves look wobbly: increase <b>curve tolerance</b> a bit.
                </li>
                <li>
                  If your input is already line art, switch preprocess to{" "}
                  <b>None</b>.
                </li>
              </ul>
            </div>
            <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { k: "Outline-first", v: "Edge mode optimized for contours" },
                { k: "Noise control", v: "Blur and turd size reduce speckles" },
                { k: "Editable SVG", v: "Responsive viewBox and paths" },
                { k: "In-memory", v: "No uploads stored on disk" },
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
          <section>
            <h3 className="text-lg font-bold">Best for</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Photo contours",
                "Paintings",
                "Sketches",
                "Screenshots",
                "Stickers",
                "Simple icons",
                "Screenshots with artifacts",
                "Sticker cutlines",
                "Ink scans",
                "Laser/CNC outlines",
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
              {[
                {
                  title: "Start with Clean",
                  body: "Use Outline Clean first. Then tweak blur and edge boost until the contour matches what you want.",
                },
                {
                  title: "Kill background noise",
                  body: "If you see lots of dots, increase blur and turd size. It usually fixes most noisy photos.",
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
              Server stability and usage limits
            </h3>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-700">
                This image to SVG outline conversion page only rate limits
                backend raster tracing and server-side image processing. Preview
                rendering, copy, local download generation, and setting changes
                that only update React state are not rate limited.
              </p>
              <p className="mt-3 text-sm text-slate-700">
                Backend outline conversions allow up to 120 conversions per
                minute, 400 conversions every 5 minutes, 1500 conversions per
                hour, and 3000 conversions per day for the same connection and
                browser profile.
              </p>
            </div>
          </section>

          <CurrentRouteGuide />

          <section
            className="mt-12"
            itemScope
            itemType="https://schema.org/FAQPage"
          >
            <h3 className="text-lg font-bold">FAQ</h3>

            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "Why do I get lots of tiny edges and speckles?",
                  a: "Increase blur and turd size. If the photo is very noisy, use Outline Soft first.",
                },
                {
                  q: "Why are edges missing?",
                  a: "Increase edge boost or raise threshold. If the image is low contrast, boost edges more.",
                },
                {
                  q: "Why does it look too chunky?",
                  a: "Lower threshold and reduce edge boost. If needed, increase blur slightly to avoid harsh edges.",
                },
                {
                  q: "Why does the result show a square grid or block pattern?",
                  a: "That usually comes from compression artifacts, screenshots, textured backgrounds, or hard pixel edges being amplified during outline extraction. Use the Remove grid/noise or Screenshot cleanup preset first, then increase blur and turd size if small square artifacts remain.",
                },
                {
                  q: "Does this outline converter have usage limits?",
                  a: "Only backend outline conversion work is rate limited. Preview rendering, copy, local download generation, and advanced setting changes that only update React state are not rate limited. Backend conversions allow up to 120 conversions per minute, 400 conversions every 5 minutes, 1500 conversions per hour, and 3000 conversions per day for the same connection and browser profile.",
                },
                {
                  q: "Can I use this for logos?",
                  a: "Yes, but the Logo to SVG page is tuned for fewer nodes and smoother shapes on clean logo sources.",
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
