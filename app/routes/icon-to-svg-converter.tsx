import * as React from "react";
import type { Route } from "./+types/icon-to-svg-converter";
import {
  json,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { Link, useFetcher, type ActionFunctionArgs } from "react-router";
import { CurrentRouteGuide, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";
import { PresetPicker } from "~/client/components/converter/PresetSelector";
import {
  FullscreenOutputPreview,
  FullscreenPreviewButton,
} from "~/client/components/converter/FullscreenOutputPreview";
import { extendTracePresets } from "~/client/lib/converter/presetAdditions";
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
  const title = "Icon to SVG Converter - Vector Icon Cleanup | iLoveSVG";
  const description =
    "Convert PNG or JPG icon images into scalable SVG for UI glyphs, app marks, website assets, and icon systems with editable output and preview.";
  const canonical = "https://www.ilovesvg.com/icon-to-svg-converter";

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
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB
const MAX_MP = 30; // ~30 megapixels
const MAX_SIDE = 8000; // max width or height in pixels
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/tiff",
  "image/svg+xml",
]);
const ALLOWED_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "avif",
  "bmp",
  "tif",
  "tiff",
  "svg",
]);
const ACCEPTED_IMAGE_LABEL = "PNG, JPG, WebP, GIF, AVIF, BMP, TIFF, or SVG";

// Dark background default for invert "white on dark"
const DARK_BG_DEFAULT = "#0b1020";

// -------- Live preview tiers (client) --------
// ≤10MB: fast,  10-25MB: throttled. >25MB → attempt client auto-compress to ≤25MB; if not possible, block with message.
const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
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

/* ========================
   Concurrency gate (server)
======================== */
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

    const rateLimit = checkBackendConversionRateLimit(
      request,
      "icon-to-svg-converter",
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
        { error: `Only ${ACCEPTED_IMAGE_LABEL} images are allowed.` },
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

    if (isSvgFile(webFile)) {
      const svgText = await webFile.text();
      const layeredSvg = buildEditableSvgFromUploadedSvg(svgText);

      return json({
        svg: layeredSvg.svg,
        layers: layeredSvg.layers,
        width: layeredSvg.width,
        height: layeredSvg.height,
        sourceKind: "svg",
      });
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

      const { validateFileSignature } = await import("~/utils/backendSecurity.server");
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
      const colorLayerCount = clampNumber(
        Number(
          form.get("colorLayerCount") ?? BASE_LAYERED_COLOR_DEFAULTS.layerCount,
        ),
        MIN_LAYER_COUNT,
        MAX_LAYER_COUNT,
      );
      const layerMaxTraceSide = clampNumber(
        Number(
          form.get("layerMaxTraceSide") ??
            BASE_LAYERED_COLOR_DEFAULTS.maxTraceSide,
        ),
        600,
        2400,
      );
      const minRegionPercent = clampNumber(
        Number(
          form.get("minRegionPercent") ??
            BASE_LAYERED_COLOR_DEFAULTS.minRegionPercent,
        ),
        0,
        5,
      );
      const layerOptTolerance = clampNumber(
        Number(
          form.get("layerOptTolerance") ??
            BASE_LAYERED_COLOR_DEFAULTS.optTolerance,
        ),
        0.05,
        1.2,
      );
      const layerTurdSize = clampNumber(
        Number(
          form.get("layerTurdSize") ?? BASE_LAYERED_COLOR_DEFAULTS.turdSize,
        ),
        0,
        20,
      );
      const layerTurnPolicy = readTurnPolicy(
        String(
          form.get("layerTurnPolicy") ?? BASE_LAYERED_COLOR_DEFAULTS.turnPolicy,
        ),
      );
      const posterize =
        String(
          form.get("posterize") ??
            String(BASE_LAYERED_COLOR_DEFAULTS.posterize),
        ).toLowerCase() === "true";
      const removeWhite =
        String(
          form.get("removeWhite") ??
            String(BASE_LAYERED_COLOR_DEFAULTS.removeWhite),
        ).toLowerCase() === "true";
      const removeTransparent =
        String(
          form.get("removeTransparent") ??
            String(BASE_LAYERED_COLOR_DEFAULTS.removeTransparent),
        ).toLowerCase() === "true";

      // Force sensible output for white-on-dark
      if (whiteOnDark && traceMode !== "layered") {
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
          gate: {
            running: gate.running,
            queued: gate.queued,
          },
        });
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

      const editableSingle = buildEditableSingleTraceSvg(finalSVG, lineColor);
      const adjustedSingle = applyTraceSvgOutputSettings(
        editableSingle.svg,
        advancedTraceSettings,
        { width: ensured.width, height: ensured.height },
      );

      return json({
        svg: adjustedSingle.svg,
        layers: editableSingle.layers,
        width: adjustedSingle.width,
        height: adjustedSingle.height,
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

const MIN_LAYER_COUNT = 2;
const MAX_LAYER_COUNT = 10;
const MAX_TRACE_SIDE_DEFAULT = 1600;

const BASE_LAYERED_COLOR_DEFAULTS: LayeredColorSvgOptions = {
  layerCount: 5,
  maxTraceSide: MAX_TRACE_SIDE_DEFAULT,
  minRegionPercent: 0.35,
  optTolerance: 0.45,
  turdSize: 4,
  posterize: true,
  removeWhite: false,
  removeTransparent: true,
  transparent: true,
  bgColor: "#ffffff",
  turnPolicy: "majority",
};

type RGB = { r: number; g: number; b: number };

type LayeredColorSvgOptions = {
  layerCount: number;
  maxTraceSide: number;
  minRegionPercent: number;
  optTolerance: number;
  turdSize: number;
  posterize: boolean;
  removeWhite: boolean;
  removeTransparent: boolean;
  transparent: boolean;
  bgColor: string;
  turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  removeColors?: string[];
  removeColorTolerance?: number;
  layerAlpha?: number;
  backgroundAlpha?: number;
  colorMergeTolerance?: number;
  posterizeStrength?: number;
  sortLayersBy?: "luminance" | "area" | "original";
  brightness?: number;
  contrast?: number;
  outputWidth?: number;
  outputHeight?: number;
  preserveAspectRatio?: boolean;
};

type TraceLayerBuildItem = {
  id: string;
  label: string;
  color: string;
  pixelPercent: number;
  pathTags: string;
};

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.round(Math.max(min, Math.min(max, value)));
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) => clampByte(v).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbObjectToHex(color: RGB): string {
  return rgbToHex(color.r, color.g, color.b);
}

function sanitizeHexColor(input: string, fallback: string): string {
  const value = String(input || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }
  return fallback;
}

function readTurnPolicy(
  value: string,
): "black" | "white" | "left" | "right" | "minority" | "majority" {
  if (
    ["black", "white", "left", "right", "minority", "majority"].includes(value)
  ) {
    return value as
      | "black"
      | "white"
      | "left"
      | "right"
      | "minority"
      | "majority";
  }
  return "minority";
}

function sanitizeLayerId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function traceBitmapToSvg(input: Buffer, opts: any): Promise<string> {
  const { traceBitmapToSvg: traceBitmapToSvgWithPotrace } = await import("~/utils/potraceCompat");
  return await traceBitmapToSvgWithPotrace(input, opts);
}

function extractPathTags(svg: string): string {
  const matches = String(svg).match(/<path\b[^>]*>/gi) || [];
  return matches
    .map((tag) => {
      let clean = tag;
      clean = clean.replace(/\sfill\s*=\s*["'][^"']*["']/gi, "");
      clean = clean.replace(/\sstroke\s*=\s*["'][^"']*["']/gi, "");
      clean = clean.replace(/\s\/?>$/i, " />");
      return clean;
    })
    .join("");
}

function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function createLayeredColorSvg(
  input: Buffer,
  opts: LayeredColorSvgOptions,
): Promise<{
  svg: string;
  width: number;
  height: number;
  layers: SvgLayerMeta[];
}>{
  throw new Error("Layered SVG tracing is handled by the server action.");
}

function collectLayerPixels(
  raw: Buffer,
  width: number,
  height: number,
  options: {
    removeTransparent: boolean;
    removeWhite: boolean;
    posterize: boolean;
  },
): RGB[] {
  const total = width * height;
  const pixels: RGB[] = [];
  const sampleStep = Math.max(1, Math.floor(total / 16000));
  for (let i = 0; i < total; i += sampleStep) {
    const off = i * 4;
    const a = raw[off + 3];
    if (options.removeTransparent && a < 18) continue;
    let r = raw[off];
    let g = raw[off + 1];
    let b = raw[off + 2];
    if (a < 255 && !options.removeTransparent) {
      r = blendChannel(r, a, 255);
      g = blendChannel(g, a, 255);
      b = blendChannel(b, a, 255);
    }
    if (options.posterize) {
      r = posterizeChannel(r);
      g = posterizeChannel(g);
      b = posterizeChannel(b);
    }
    if (options.removeWhite && isNearWhite({ r, g, b })) continue;
    pixels.push({ r, g, b });
  }
  return pixels;
}

function assignAllPixelsToLayerPalette(
  raw: Buffer,
  width: number,
  height: number,
  options: {
    palette: RGB[];
    removeTransparent: boolean;
    removeWhite: boolean;
    posterize: boolean;
  },
): { layerForPixel: Int16Array; counts: number[]; assignableCount: number } {
  const total = width * height;
  const layerForPixel = new Int16Array(total);
  layerForPixel.fill(-1);
  const counts = new Array(options.palette.length).fill(0);
  let assignableCount = 0;
  for (let i = 0; i < total; i++) {
    const off = i * 4;
    const a = raw[off + 3];
    if (options.removeTransparent && a < 18) continue;
    let r = raw[off];
    let g = raw[off + 1];
    let b = raw[off + 2];
    if (a < 255 && !options.removeTransparent) {
      r = blendChannel(r, a, 255);
      g = blendChannel(g, a, 255);
      b = blendChannel(b, a, 255);
    }
    if (options.posterize) {
      r = posterizeChannel(r);
      g = posterizeChannel(g);
      b = posterizeChannel(b);
    }
    const rgb = { r, g, b };
    if (options.removeWhite && isNearWhite(rgb)) continue;
    const nearest = nearestPaletteIndex(rgb, options.palette);
    layerForPixel[i] = nearest;
    counts[nearest]++;
    assignableCount++;
  }
  return { layerForPixel, counts, assignableCount };
}

function buildLayerPalette(pixels: RGB[], requestedCount: number): RGB[] {
  const k = clampInt(requestedCount, MIN_LAYER_COUNT, MAX_LAYER_COUNT);
  const uniqueMap = new Map<string, RGB>();
  for (const pixel of pixels) {
    uniqueMap.set(`${pixel.r},${pixel.g},${pixel.b}`, pixel);
    if (uniqueMap.size >= 4096) break;
  }
  const unique = Array.from(uniqueMap.values());
  if (unique.length <= k) return unique;
  const centroids = seedLayerCentroids(unique, k);
  for (let iter = 0; iter < 12; iter++) {
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
    for (const pixel of pixels) {
      const index = nearestPaletteIndex(pixel, centroids);
      sums[index].r += pixel.r;
      sums[index].g += pixel.g;
      sums[index].b += pixel.b;
      sums[index].count++;
    }
    for (let i = 0; i < centroids.length; i++) {
      const sum = sums[i];
      if (!sum.count) continue;
      centroids[i] = {
        r: Math.round(sum.r / sum.count),
        g: Math.round(sum.g / sum.count),
        b: Math.round(sum.b / sum.count),
      };
    }
  }
  return dedupeLayerPalette(centroids).slice(0, k);
}

function seedLayerCentroids(pixels: RGB[], k: number): RGB[] {
  const sorted = [...pixels].sort((a, b) => {
    const lumDiff = luminance(a) - luminance(b);
    if (Math.abs(lumDiff) > 1) return lumDiff;
    return a.r + a.g + a.b - (b.r + b.g + b.b);
  });
  const seeds: RGB[] = [];
  for (let i = 0; i < k; i++) {
    const index = Math.round((i / Math.max(1, k - 1)) * (sorted.length - 1));
    seeds.push(sorted[index]);
  }
  return dedupeLayerPalette(seeds);
}

function dedupeLayerPalette(palette: RGB[]): RGB[] {
  const seen = new Set<string>();
  const out: RGB[] = [];
  for (const color of palette) {
    const key = `${color.r},${color.g},${color.b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(color);
  }
  return out;
}

async function traceMaskToPathTags(
  maskPng: Buffer,
  options: {
    turdSize: number;
    optTolerance: number;
    turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  },
): Promise<string> {
  const traced = await traceBitmapToSvg(maskPng, {
    color: "#000000",
    threshold: 128,
    turdSize: options.turdSize,
    optTolerance: options.optTolerance,
    turnPolicy: options.turnPolicy,
    invert: false,
    blackOnWhite: true,
  });
  return extractPathTags(traced);
}

function buildLayeredSvgString({
  width,
  height,
  layers,
  transparent,
  bgColor,
}: {
  width: number;
  height: number;
  layers: TraceLayerBuildItem[];
  transparent: boolean;
  bgColor: string;
}): string {
  const background = transparent
    ? ""
    : `<rect x="0" y="0" width="${width}" height="${height}" fill="${sanitizeHexColor(bgColor, "#ffffff")}" />`;
  const body = layers
    .map((layer) => {
      const fill = sanitizeHexColor(layer.color, "#000000");
      const safeId = escapeAttr(layer.id);
      const safeLabel = escapeAttr(layer.label);
      return `<g id="${safeId}" data-layer-id="${safeId}" data-layer-label="${safeLabel}" data-layer-color="${fill}" fill="${fill}">${layer.pathTags}</g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Layered SVG from image">${background}${body}</svg>`;
}

function buildEditableSingleTraceSvg(
  svg: string,
  color: string,
): { svg: string; layers: SvgLayerMeta[] } {
  const id = "trace-color";
  const fill = sanitizeHexColor(color, "#000000");
  let pathCount = 0;

  const annotatedSvg = String(svg).replace(
    /<path\b([^>]*?)(\s*\/?)>/gi,
    (match, attrs = "", selfClose = "") => {
      const currentAttrs = String(attrs || "");
      if (/\bdata-fill-layer-id\s*=/i.test(currentAttrs)) {
        pathCount += 1;
        return match;
      }

      pathCount += 1;
      return `<path${currentAttrs} data-fill-layer-id="${id}"${selfClose}>`;
    },
  );

  return {
    svg: annotatedSvg,
    layers:
      pathCount > 0
        ? [
            {
              id,
              label: "Trace color",
              color: fill,
              originalColor: fill,
              visible: true,
              kind: "fill",
            },
          ]
        : [],
  };
}

function maskHasInk(mask: Buffer): boolean {
  for (let i = 0; i < mask.length; i++) if (mask[i] < 250) return true;
  return false;
}

function nearestPaletteIndex(color: RGB, palette: RGB[]): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < palette.length; i++) {
    const distance = colorDistance(color, palette[i]);
    if (distance < bestDist) {
      bestDist = distance;
      best = i;
    }
  }
  return best;
}

function colorDistance(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr * 0.32 + dg * dg * 0.52 + db * db * 0.16;
}

function luminance(color: RGB): number {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

function blendChannel(channel: number, alpha: number, bg: number): number {
  return Math.round((channel * alpha + bg * (255 - alpha)) / 255);
}

function posterizeChannel(value: number): number {
  return Math.round(value / 32) * 32;
}

function isNearWhite(color: RGB): boolean {
  return color.r >= 244 && color.g >= 244 && color.b >= 244;
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
function getFileExtension(name?: string): string {
  const cleaned = String(name || "")
    .toLowerCase()
    .split("?")[0];
  const parts = cleaned.split(".");
  return parts.length > 1 ? parts[parts.length - 1] || "" : "";
}

function isAllowedImageFile(file: { type?: string; name?: string }): boolean {
  const mime = String(file.type || "").toLowerCase();
  if (ALLOWED_MIME.has(mime)) return true;
  const extension = getFileExtension(file.name);
  return ALLOWED_EXTENSIONS.has(extension);
}

function isSvgFile(file: { type?: string; name?: string }): boolean {
  const mime = String(file.type || "").toLowerCase();
  return mime === "image/svg+xml" || getFileExtension(file.name) === "svg";
}

function buildEditableSvgFromUploadedSvg(svgRaw: string): {
  svg: string;
  width: number;
  height: number;
  layers: SvgLayerMeta[];
} {
  const safeSvg = coerceSvg(svgRaw);
  const ensured = ensureViewBoxResponsive(safeSvg);
  const annotated = annotateUploadedSvgLayers(ensured.svg);
  return {
    svg: annotated.svg,
    width: ensured.width,
    height: ensured.height,
    layers: annotated.layers,
  };
}

function annotateUploadedSvgLayers(svg: string): {
  svg: string;
  layers: SvgLayerMeta[];
} {
  const excludedTags = new Set([
    "svg",
    "defs",
    "style",
    "title",
    "desc",
    "metadata",
    "lineargradient",
    "radialgradient",
    "pattern",
    "clippath",
    "mask",
    "filter",
    "marker",
    "symbol",
    "use",
    "image",
    "foreignobject",
    "stop",
  ]);

  const stylePaintMap = parseSvgStylePaintMap(svg);
  const layers: SvgLayerMeta[] = [];
  const layerIds = new Map<string, string>();
  let fillCount = 0;
  let strokeCount = 0;

  function getOrCreateLayerId(kind: SvgLayerKind, color: string): string {
    const key = `${kind}:${color}`;
    const existing = layerIds.get(key);
    if (existing) return existing;

    const count = kind === "fill" ? ++fillCount : ++strokeCount;
    const id = sanitizeLayerId(`${kind}-${count}-${color.replace("#", "")}`);
    layers.push({
      id,
      label: `${kind === "fill" ? "Fill" : "Stroke"} ${count}`,
      color,
      originalColor: color,
      visible: true,
      kind,
    });
    layerIds.set(key, id);
    return id;
  }

  const annotatedSvg = svg.replace(
    /<([a-zA-Z][\w:.-]*)(\s[^<>]*?)?(\s*\/?)>/g,
    (match, rawTagName, rawAttrs = "", rawSelfClose = "") => {
      const tagName = String(rawTagName || "").toLowerCase();
      if (excludedTags.has(tagName)) return match;

      let attrs = String(rawAttrs || "");
      if (
        /\bdata-layer-id\s*=|\bdata-fill-layer-id\s*=|\bdata-stroke-layer-id\s*=/i.test(
          attrs,
        )
      ) {
        return match;
      }

      const fillColor = extractSvgPaintColor(attrs, "fill", stylePaintMap);
      const strokeColor = extractSvgPaintColor(attrs, "stroke", stylePaintMap);

      if (!fillColor && !strokeColor) return match;

      if (fillColor) {
        const fillId = getOrCreateLayerId("fill", fillColor);
        attrs +=
          tagName === "g"
            ? ` data-layer-id="${fillId}"`
            : ` data-fill-layer-id="${fillId}"`;
      }
      if (strokeColor) {
        const strokeId = getOrCreateLayerId("stroke", strokeColor);
        attrs +=
          tagName === "g" && !fillColor
            ? ` data-layer-id="${strokeId}"`
            : ` data-stroke-layer-id="${strokeId}"`;
      }

      return `<${rawTagName}${attrs}${rawSelfClose}>`;
    },
  );

  return { svg: annotatedSvg, layers };
}

type SvgStylePaintMap = {
  fillByClass: Map<string, string>;
  strokeByClass: Map<string, string>;
  fillById: Map<string, string>;
  strokeById: Map<string, string>;
};

function parseSvgStylePaintMap(svg: string): SvgStylePaintMap {
  const fillByClass = new Map<string, string>();
  const strokeByClass = new Map<string, string>();
  const fillById = new Map<string, string>();
  const strokeById = new Map<string, string>();

  const styleBlocks = Array.from(
    svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi),
  );
  for (const block of styleBlocks) {
    const css = block[1] || "";
    const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
    let ruleMatch: RegExpExecArray | null;
    while ((ruleMatch = ruleRegex.exec(css))) {
      const selectors = String(ruleMatch[1] || "")
        .split(",")
        .map((selector) => selector.trim())
        .filter(Boolean);
      const declarations = String(ruleMatch[2] || "");
      const fillColor = extractCssDeclarationColor(declarations, "fill");
      const strokeColor = extractCssDeclarationColor(declarations, "stroke");
      if (!fillColor && !strokeColor) continue;

      for (const selector of selectors) {
        if (/^[.]([a-zA-Z_][\w-]*)$/.test(selector)) {
          const key = selector.slice(1);
          if (fillColor) fillByClass.set(key, fillColor);
          if (strokeColor) strokeByClass.set(key, strokeColor);
        } else if (/^#([a-zA-Z_][\w-]*)$/.test(selector)) {
          const key = selector.slice(1);
          if (fillColor) fillById.set(key, fillColor);
          if (strokeColor) strokeById.set(key, strokeColor);
        }
      }
    }
  }

  return { fillByClass, strokeByClass, fillById, strokeById };
}

function extractCssDeclarationColor(
  declarations: string,
  property: SvgLayerKind,
): string | null {
  const pattern = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i");
  return normalizeSvgEditableColor(
    String(declarations).match(pattern)?.[1] || "",
  );
}

function extractSvgPaintColor(
  attrs: string,
  property: SvgLayerKind,
  stylePaintMap: SvgStylePaintMap,
): string | null {
  const attrPattern = new RegExp(
    `\\b${property}\\s*=\\s*["']([^"']+)["']`,
    "i",
  );
  const attrMatch = String(attrs).match(attrPattern);
  const directColor = normalizeSvgEditableColor(attrMatch?.[1] || "");
  if (directColor) return directColor;

  const styleMatch = String(attrs).match(/\bstyle\s*=\s*["']([^"']*)["']/i);
  if (styleMatch?.[1]) {
    const stylePattern = new RegExp(
      `(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`,
      "i",
    );
    const styleColor = normalizeSvgEditableColor(
      styleMatch[1].match(stylePattern)?.[1] || "",
    );
    if (styleColor) return styleColor;
  }

  const idValue = getSvgAttrValue(attrs, "id");
  if (idValue) {
    const idColor =
      property === "fill"
        ? stylePaintMap.fillById.get(idValue)
        : stylePaintMap.strokeById.get(idValue);
    if (idColor) return idColor;
  }

  const classValue = getSvgAttrValue(attrs, "class");
  if (classValue) {
    const classNames = classValue.split(/\s+/).filter(Boolean);
    for (let i = classNames.length - 1; i >= 0; i -= 1) {
      const classColor =
        property === "fill"
          ? stylePaintMap.fillByClass.get(classNames[i])
          : stylePaintMap.strokeByClass.get(classNames[i]);
      if (classColor) return classColor;
    }
  }

  return null;
}

function getSvgAttrValue(attrs: string, name: string): string {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i");
  return String(String(attrs).match(pattern)?.[1] || "").trim();
}

function normalizeSvgEditableColor(value: string): string | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (
    raw === "none" ||
    raw === "transparent" ||
    raw === "currentcolor" ||
    raw === "inherit" ||
    raw === "context-fill" ||
    raw === "context-stroke" ||
    raw.startsWith("url(")
  ) {
    return null;
  }

  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return raw;
  }
  if (/^#[0-9a-f]{8}$/i.test(raw)) {
    return `#${raw.slice(1, 7)}`;
  }

  const rgbMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map((part) => part.trim());
    if (parts.length >= 3) {
      const nums = parts.slice(0, 3).map((part) => {
        if (part.endsWith("%")) {
          return clampByte((parseFloat(part) / 100) * 255);
        }
        return clampByte(Number(part));
      });
      return rgbToHex(nums[0], nums[1], nums[2]);
    }
  }

  const named: Record<string, string> = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    navy: "#000080",
    teal: "#008080",
    aqua: "#00ffff",
    cyan: "#00ffff",
    lime: "#00ff00",
    yellow: "#ffff00",
    olive: "#808000",
    maroon: "#800000",
    purple: "#800080",
    fuchsia: "#ff00ff",
    magenta: "#ff00ff",
    orange: "#ffa500",
    pink: "#ffc0cb",
    brown: "#a52a2a",
    gray: "#808080",
    grey: "#808080",
    silver: "#c0c0c0",
  };

  return named[raw] || null;
}

/* ========================
   UI (types)
======================== */
type TraceMode = "single" | "layered";

type SvgLayerKind = "fill" | "stroke";

type SvgLayerMeta = {
  id: string;
  label: string;
  color: string;
  originalColor: string;
  visible: boolean;
  kind?: SvgLayerKind;
};

type EditableSvgLayer = SvgLayerMeta;

type Settings = TraceAdvancedSettings & {
  traceMode: "single" | "layered";

  threshold: number;
  turdSize: number;
  optTolerance: number;
  turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  lineColor: string;

  /**
   * IMPORTANT:
   * We now treat `invert` as OUTPUT "white on dark" mode.
   * (This avoids potrace invert producing blank results.)
   */
  invert: boolean;

  transparent: boolean;
  bgColor: string;

  preprocess: "none" | "edge";
  blurSigma: number;
  edgeBoost: number;

  colorLayerCount: number;
  layerMaxTraceSide: number;
  minRegionPercent: number;
  layerOptTolerance: number;
  layerTurdSize: number;
  layerTurnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  posterize: boolean;
  removeWhite: boolean;
  removeTransparent: boolean;
};

type Preset = {
  id: string;
  label: string;
  settings: Partial<Settings>;
};

// Icon-focused presets
const PRESETS: Preset[] = [
  {
    id: "layered-color-svg",
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
    id: "layered-color-svg-smoother",
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
    id: "layered-color-svg-more-detail",
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
    id: "layered-color-svg-fewer-larger-layers",
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
    id: "icon-crisp",
    label: "Icon - Crisp (default)",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 210,
      turdSize: 2,
      optTolerance: 0.35,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "icon-thin",
    label: "Icon - Preserve thin strokes",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 235,
      turdSize: 1,
      optTolerance: 0.22,
      turnPolicy: "minority",
    },
  },
  {
    id: "icon-bold",
    label: "Icon - Bold fill",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 198,
      turdSize: 3,
      optTolerance: 0.42,
      turnPolicy: "black",
    },
  },
  {
    id: "logo-clean",
    label: "Logo - Clean shapes (few nodes)",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 210,
      turdSize: 2,
      optTolerance: 0.55,
      turnPolicy: "majority",
    },
  },
  {
    id: "glyph-ui",
    label: "UI Glyph - Simplify",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 220,
      turdSize: 2,
      optTolerance: 0.75,
      turnPolicy: "majority",
    },
  },
  {
    id: "photo-icon-edge",
    label: "Icon from photo - Edge extract",
    settings: {
      traceMode: "single",
      preprocess: "edge",
      blurSigma: 0.9,
      edgeBoost: 1.2,
      threshold: 228,
      turdSize: 2,
      optTolerance: 0.4,
      turnPolicy: "majority",
    },
  },
  {
    id: "invert-white",
    label: "White on dark",
    settings: {
      traceMode: "single",
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
];

const DISPLAY_PRESETS = extendTracePresets<Preset>(PRESETS);

const DEFAULTS: Settings = {
  ...DEFAULT_TRACE_ADVANCED_SETTINGS,
  traceMode: "layered",

  threshold: 210,
  turdSize: 2,
  optTolerance: 0.35,
  turnPolicy: "majority",
  lineColor: "#000000",
  invert: false,

  transparent: true,
  bgColor: "#ffffff",

  preprocess: "none",
  blurSigma: 0.8,
  edgeBoost: 1.0,

  colorLayerCount: 5,
  layerMaxTraceSide: 1600,
  minRegionPercent: 0.35,
  layerOptTolerance: 0.45,
  layerTurdSize: 4,
  layerTurnPolicy: "majority",
  posterize: true,
  removeWhite: false,
  removeTransparent: true,
};

const routeCapabilities = getRouteCapabilities("icon-to-svg-converter");

type ServerResult = {
  svg?: string;
  error?: string;
  width?: number;
  height?: number;
  layers?: EditableSvgLayer[];
  retryAfterMs?: number;
  code?: string;
  gate?: { running: number; queued: number };
};

type HistoryItem = {
  svg: string;
  width: number;
  height: number;
  stamp: number;
  layers?: EditableSvgLayer[];
};

/* ---- tiering helpers (client) ---- */
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

export default function IconToSvgConverter({
  loaderData,
}: Route.ComponentProps) {
  const fetcher = useFetcher<ServerResult>();
  const [file, setFile] = React.useState<File | null>(null);
  const [originalFileSize, setOriginalFileSize] = React.useState<number | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] = React.useState<string>("layered-color-svg");

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
  const [fullscreenPreviewIndex, setFullscreenPreviewIndex] = React.useState<
    number | null
  >(null);
  const [autoMode, setAutoMode] = React.useState<AutoMode>("off");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestFileRef = React.useRef<File | null>(null);
  const latestSettingsRef = React.useRef<Settings>(DEFAULTS);

  React.useEffect(() => {
    latestFileRef.current = file;
  }, [file]);

  React.useEffect(() => {
    latestSettingsRef.current = settings;
  }, [settings]);

  React.useEffect(() => {
    if (fetcher.data?.error) setErr(fetcher.data.error);
    else setErr(null);

    if (fetcher.data?.retryAfterMs && fetcher.data?.code === "BUSY") {
      const ms = Math.max(800, fetcher.data.retryAfterMs);
      setInfo(
        `Server busy… retrying automatically in ${(ms / 1000).toFixed(1)}s`,
      );
      const t = setTimeout(() => {
        const currentFile = latestFileRef.current;
        if (currentFile) {
          void submitConvert({
            targetFile: currentFile,
            targetSettings: latestSettingsRef.current,
          });
        }
      }, ms);
      return () => clearTimeout(t);
    } else {
      setInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data]);

  React.useEffect(() => {
    if (fetcher.data?.svg) {
      const item: HistoryItem = {
        svg: fetcher.data.svg,
        width: fetcher.data.width ?? 0,
        height: fetcher.data.height ?? 0,
        stamp: Date.now(),
        layers: fetcher.data.layers,
      };
      setHistory((prev) => [item, ...prev].slice(0, 10));
    }
  }, [
    fetcher.data?.svg,
    fetcher.data?.width,
    fetcher.data?.height,
    fetcher.data?.layers,
  ]);

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
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (!isAllowedImageFile(f)) {
      setErr(`Please choose a ${ACCEPTED_IMAGE_LABEL} image.`);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setErr(null);
    setInfo(null);
    setDims(null);
    setOriginalFileSize(f.size);

    let chosen = f;

    if (f.size > MAX_UPLOAD_BYTES) {
      setInfo("Huge file detected - compressing on your device…");
      try {
        chosen = await compressToTarget25MB(f);
      } catch (e: any) {
        setInfo(null);
        setErr(
          e?.message ||
            "This image is too large. Please resize it and try again.",
        );
        setFile(null);
        setPreviewUrl(null);
        setAutoMode("off");
        setOriginalFileSize(null);
        return;
      }
    } else if (f.size > LIVE_MED_MAX) {
      setInfo("Large file detected - compressing on your device for preview…");
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

    setFile(chosen);
    setAutoMode(getAutoMode(chosen.size));
    const url = URL.createObjectURL(chosen);
    setPreviewUrl(url);
    await measureAndSet(chosen);
    void submitConvert({ targetFile: chosen, targetSettings: settings });
  }

  async function submitConvert(options?: {
    targetFile?: File | null;
    targetSettings?: Settings;
  }) {
    const sourceFile = options?.targetFile ?? latestFileRef.current ?? file;
    const sourceSettings = options?.targetSettings ?? latestSettingsRef.current;

    if (!sourceFile) {
      setErr("Choose an image first.");
      return;
    }

    try {
      await validateBeforeSubmit(sourceFile);
    } catch (e: any) {
      setErr(e?.message || "Image is too large.");
      return;
    }

    // client-side sanity: if "white on dark" is enabled, force visible bg
    const effective = (() => {
      if (sourceSettings.traceMode === "layered" || !sourceSettings.invert) {
        return sourceSettings;
      }
      const bg =
        !sourceSettings.bgColor ||
        sourceSettings.bgColor.toLowerCase() === "#ffffff" ||
        sourceSettings.bgColor.toLowerCase() === "#fff"
          ? DARK_BG_DEFAULT
          : sourceSettings.bgColor;
      return {
        ...sourceSettings,
        transparent: false,
        bgColor: bg,
        lineColor:
          sourceSettings.lineColor?.toLowerCase() === "#000000"
            ? "#ffffff"
            : sourceSettings.lineColor,
      };
    })();

    const fd = new FormData();
    fd.append("file", sourceFile);
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
    appendAdvancedTraceSettings(fd, effective);
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

    setErr(null);

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action: `${window.location.pathname}?index`,
    });
  }

  const buttonDisabled = isServer || !hydrated || busy || !file;

  function applyPreset(preset: Preset) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const nextSettings = {
      ...DEFAULTS,
      ...preset.settings,
    } as Settings;

    setActivePreset(preset.id);
    setSettings(nextSettings);

    const currentFile = latestFileRef.current;
    if (currentFile) {
      void submitConvert({
        targetFile: currentFile,
        targetSettings: nextSettings,
      });
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

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const settingsCommitTimersRef = React.useRef<
    Partial<Record<keyof Settings, ReturnType<typeof setTimeout>>>
  >({});

  React.useEffect(() => {
    return () => {
      Object.values(settingsCommitTimersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer as ReturnType<typeof setTimeout>);
      });
    };
  }, []);

  function setSettingNow<K extends keyof Settings>(key: K, value: Settings[K]) {
    const existing = settingsCommitTimersRef.current[key];
    if (existing) {
      clearTimeout(existing);
      delete settingsCommitTimersRef.current[key];
    }

    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function setSettingThrottled<K extends keyof Settings>(
    key: K,
    value: Settings[K],
    delay = 90,
  ) {
    const existing = settingsCommitTimersRef.current[key];
    if (existing) clearTimeout(existing);

    settingsCommitTimersRef.current[key] = setTimeout(() => {
      delete settingsCommitTimersRef.current[key];
      setSettings((current) => ({
        ...current,
        [key]: value,
      }));
    }, delay);
  }

  function getHistoryItemSvg(item: HistoryItem): string {
    return item.layers?.length
      ? applyLayerEditsToSvg(item.svg, item.layers)
      : item.svg;
  }

  function setHistoryLayer(
    stamp: number,
    layerId: string,
    patch: Partial<Pick<EditableSvgLayer, "color" | "visible">>,
  ) {
    setHistory((prev) =>
      prev.map((item) => {
        if (item.stamp !== stamp || !item.layers) return item;
        return {
          ...item,
          layers: item.layers.map((layer) =>
            layer.id === layerId ? { ...layer, ...patch } : layer,
          ),
        };
      }),
    );
  }

  function resetHistoryLayer(stamp: number, layerId: string) {
    setHistory((prev) =>
      prev.map((item) => {
        if (item.stamp !== stamp || !item.layers) return item;
        return {
          ...item,
          layers: item.layers.map((layer) =>
            layer.id === layerId
              ? {
                  ...layer,
                  color: layer.originalColor,
                  visible: true,
                }
              : layer,
          ),
        };
      }),
    );
  }

  function resetAllHistoryLayers(stamp: number) {
    setHistory((prev) =>
      prev.map((item) => {
        if (item.stamp !== stamp || !item.layers) return item;
        return {
          ...item,
          layers: item.layers.map((layer) => ({
            ...layer,
            color: layer.originalColor,
            visible: true,
          })),
        };
      }),
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
              <h1 className="inline-flex w-full text-sky-800 text-center justify-center items-center gap-2 text-xl sm:text-3xl font-extrabold leading-none mb-2">
                Icon to SVG
              </h1>

              <PresetPicker
                presets={DISPLAY_PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />


              {/* Dropzone */}
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

                  {dims && (dims.w > 2048 || dims.h > 2048) && (
                    <div className="mt-2 text-[13px] text-amber-700">
                      Icon tip: If this is a true icon, consider exporting it
                      closer to 512–1024px. You will get a simpler SVG.
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
                    "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0]",
                    "disabled:opacity-70 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  <Icons name="convert" size={16} className="mr-1" />
                  {busy ? "Converting…" : "Convert to SVG"}
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

            <div className="order-3 min-w-0 rounded-2xl border border-sky-200 bg-sky-50/80 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:col-start-1 md:row-start-2">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full inline-flex items-center justify-between rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-sky-950 cursor-pointer transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1"
                aria-expanded={showAdvanced}
                aria-controls="advanced-settings"
              >
                <span className="inline-flex min-w-0 items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-600 text-white shadow-sm">
                    <Icons name="settings" size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold leading-5">
                      Advanced settings
                    </span>
                    <span className="block truncate text-[12px] font-medium leading-4 text-sky-700">
                      Trace detail, cleanup, layers, and export
                    </span>
                  </span>
                </span>

                <svg
                  className={[
                    "h-4 w-4 shrink-0 text-sky-700 transition-transform",
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

            {previewUrl && !showAdvanced && (
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

            {/* RESULTS */}
            <div className="order-2 min-w-0 overflow-auto rounded-2xl border border-slate-300/40 bg-[#43546b] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:sticky md:top-4 md:row-span-3 md:max-h-[calc(100vh-2rem)] md:self-start">
              {busy && (
                <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
              )}
              {history.length > 0 ? (
                <div className="grid gap-3">
                  {history.map((item, index) => (
                    <div
                      key={item.stamp}
                      className="rounded-xl border border-slate-200 bg-white p-2"
                    >
                      <div className="relative rounded-xl border border-slate-200 bg-white transparent-checkerboard min-h-[240px] flex items-center justify-center p-2">
                        <FullscreenPreviewButton onOpen={() => setFullscreenPreviewIndex(index)} />
                        <img
                          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                            getHistoryItemSvg(item),
                          )}`}
                          alt="SVG result"
                          className="max-w-full h-auto"
                        />
                      </div>

                      <LayerPaletteEditor
                        item={item}
                        onColorChange={(layerId, color) =>
                          setHistoryLayer(item.stamp, layerId, { color })
                        }
                        onVisibilityChange={(layerId, visible) =>
                          setHistoryLayer(item.stamp, layerId, { visible })
                        }
                        onResetLayer={(layerId) =>
                          resetHistoryLayer(item.stamp, layerId)
                        }
                        onResetAll={() => resetAllHistoryLayers(item.stamp)}
                      />

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
                              const b = new Blob([getHistoryItemSvg(item)], {
                                type: "image/svg+xml;charset=utf-8",
                              });
                              const u = URL.createObjectURL(b);
                              const a = document.createElement("a");
                              a.href = u;
                              a.download = "icon.svg";
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              URL.revokeObjectURL(u);
                            }}
                            className="flex items-center justify-center px-3 py-2 rounded-lg font-semibold border bg-sky-500 hover:bg-sky-600 text-white border-sky-600 cursor-pointer"
                          >
                            <Icons name="download" size={16} className="mr-1" />
                            Download SVG
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopySvg(getHistoryItemSvg(item))}
                            className="flex items-center justify-center px-3 py-2 rounded-lg font-medium border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                          >
                            <Icons name="copy" size={16} className="mr-1" />
                            Copy SVG
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="converter-empty-output-state">
                  {!busy && (
                    <Icons
                      name="success"
                      size={20}
                      className="inline-block mr-1"
                    />
                  )}
                  {busy ? "Converting…" : "Converted files appear here...  "}
                </p>
              )}
            </div>
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

function escapeLayerRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyLayerEditsToSvg(svg: string, layers: EditableSvgLayer[]): string {
  let out = svg;
  for (const layer of layers) {
    const id = escapeLayerRegExp(layer.id);

    const groupPattern = new RegExp(
      `(<g\\b(?=[^>]*data-layer-id=["']${id}["'])([^>]*)>)([\\s\\S]*?)(<\\/g>)`,
      "i",
    );

    out = out.replace(groupPattern, (_match, _open, attrs, inner, close) => {
      const groupPaintProp =
        (layer.kind || "fill") === "stroke" ? "stroke" : "fill";
      let nextAttrs = String(attrs)
        .replace(
          new RegExp(`\\s${groupPaintProp}\\s*=\\s*["'][^"']*["']`, "gi"),
          "",
        )
        .replace(/\sdisplay\s*=\s*["'][^"']*["']/gi, "");
      nextAttrs = rewriteStyleProperty(nextAttrs, groupPaintProp, layer.color);
      nextAttrs = rewriteStyleProperty(
        nextAttrs,
        "display",
        layer.visible ? null : "none",
      );
      nextAttrs += ` ${groupPaintProp}="${layer.color}"`;
      if (!layer.visible) nextAttrs += ` display="none"`;
      return `<g${nextAttrs}>${inner}${close}`;
    });

    const attrName =
      (layer.kind || "fill") === "stroke"
        ? "data-stroke-layer-id"
        : "data-fill-layer-id";
    const paintProp = (layer.kind || "fill") === "stroke" ? "stroke" : "fill";
    const elementPattern = new RegExp(
      `(<(?!g\\b)([a-zA-Z][\\w:.-]*)(?=[^>]*${attrName}=["']${id}["'])([^>]*?))(\\/?>)`,
      "gi",
    );

    out = out.replace(
      elementPattern,
      (_match, _start, tagName, attrs, endTag) => {
        let nextAttrs = String(attrs)
          .replace(
            new RegExp(`\\s${paintProp}\\s*=\\s*["'][^"']*["']`, "gi"),
            "",
          )
          .replace(/\sdisplay\s*=\s*["'][^"']*["']/gi, "");
        nextAttrs = rewriteStyleProperty(nextAttrs, paintProp, layer.color);
        nextAttrs = rewriteStyleProperty(
          nextAttrs,
          "display",
          layer.visible ? null : "none",
        );
        nextAttrs += ` ${paintProp}="${layer.color}"`;
        if (!layer.visible) nextAttrs += ` display="none"`;
        return `<${tagName}${nextAttrs}${endTag}`;
      },
    );
  }
  return out;
}

function LayerPaletteEditor({
  item,
  onColorChange,
  onVisibilityChange,
  onResetLayer,
  onResetAll,
}: {
  item: HistoryItem;
  onColorChange: (layerId: string, color: string) => void;
  onVisibilityChange: (layerId: string, visible: boolean) => void;
  onResetLayer: (layerId: string) => void;
  onResetAll: () => void;
}) {
  if (!item.layers?.length) return null;

  return (
    <div className="my-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[12px] font-semibold text-slate-700">
          Layer colors
        </span>
        <button
          type="button"
          onClick={onResetAll}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-semibold text-slate-700 cursor-pointer transition-colors hover:bg-slate-100"
        >
          Reset all
        </button>
      </div>

      <div className="grid gap-2">
        {item.layers.map((layer) => (
          <LayerPaletteRow
            key={layer.id}
            layer={layer}
            onColorChange={onColorChange}
            onVisibilityChange={onVisibilityChange}
            onResetLayer={onResetLayer}
          />
        ))}
      </div>
    </div>
  );
}

function LayerPaletteRow({
  layer,
  onColorChange,
  onVisibilityChange,
  onResetLayer,
}: {
  layer: EditableSvgLayer;
  onColorChange: (layerId: string, color: string) => void;
  onVisibilityChange: (layerId: string, visible: boolean) => void;
  onResetLayer: (layerId: string) => void;
}) {
  const COLOR_COMMIT_THROTTLE_MS = 90;

  const [localColor, setLocalColor] = React.useState(layer.color);
  const latestColorRef = React.useRef(layer.color);
  const lastCommitAtRef = React.useRef(0);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setLocalColor((current) => (current === layer.color ? current : layer.color));
    latestColorRef.current = layer.color;
  }, [layer.color]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function commitColorNow(color = latestColorRef.current) {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    lastCommitAtRef.current =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    onColorChange(layer.id, color);
  }

  function queueColorCommit(nextColor: string) {
    latestColorRef.current = nextColor;
    setLocalColor((current) => (current === nextColor ? current : nextColor));

    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const elapsed = now - lastCommitAtRef.current;
    const remaining = COLOR_COMMIT_THROTTLE_MS - elapsed;

    if (remaining <= 0) {
      commitColorNow(nextColor);
      return;
    }

    if (timeoutRef.current) {
      return;
    }

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      commitColorNow(latestColorRef.current);
    }, remaining);
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
      <input
        type="checkbox"
        checked={layer.visible}
        onChange={(e) => onVisibilityChange(layer.id, e.target.checked)}
        title={`Show ${layer.label}`}
        className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
      />

      <input
        type="color"
        value={localColor}
        onChange={(e) => queueColorCommit(e.target.value)}
        onPointerUp={() => commitColorNow()}
        onMouseUp={() => commitColorNow()}
        onTouchEnd={() => commitColorNow()}
        onBlur={() => commitColorNow()}
        title={`Change ${layer.label} color`}
        className="h-7 w-10 rounded-md border border-slate-200 bg-white cursor-pointer"
      />

      <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700">
        {layer.label} {layer.originalColor}
      </span>

      <button
        type="button"
        onClick={() => onResetLayer(layer.id)}
        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] font-medium text-slate-700 cursor-pointer transition-colors hover:bg-slate-100"
      >
        Reset
      </button>
    </div>
  );
}
function rewriteStyleProperty(
  attrs: string,
  property: string,
  value: string | null,
): string {
  const styleMatch = String(attrs).match(/\bstyle\s*=\s*(["'])([^"']*)\1/i);
  if (!styleMatch) {
    if (value == null) return attrs;
    return `${attrs} style="${property}:${value}"`;
  }

  const quote = styleMatch[1];
  const styleBody = styleMatch[2];
  const parts = styleBody
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !new RegExp(`^${property}\s*:`, "i").test(part));

  if (value != null) {
    parts.push(`${property}:${value}`);
  }

  if (parts.length === 0) {
    return attrs.replace(/\sstyle\s*=\s*(["'])[^"']*\1/i, "");
  }

  const nextStyle = parts.join("; ");
  return attrs.replace(
    /\bstyle\s*=\s*(["'])[^"']*\1/i,
    `style=${quote}${nextStyle}${quote}`,
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
    throw new Error(`Only ${ACCEPTED_IMAGE_LABEL} images are allowed.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File too large. Max 30 MB per image.");
  }
  if (isSvgFile(file)) {
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
  } catch (error: any) {
    if (error?.message?.startsWith("Image too large:")) throw error;
    return;
  }
}

/** Compress to ≤25MB (best effort). Converts PNG→JPEG if necessary for size.
 *  Strategy: try JPEG quality steps; if still large, progressively scale down. */
async function compressToTarget25MB(file: File): Promise<File> {
  const TARGET = LIVE_MED_MAX; // 25MB
  if (file.size <= TARGET || isSvgFile(file)) return file;
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
          <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-8">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              App icon and UI glyph vectorizer
            </p>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight mt-2">
              Convert icons to SVG paths you can recolor, resize, and ship
            </h2>
            <p className="text-slate-600  mt-2">
              Icons usually need clean shapes and predictable curves. This page
              uses icon-tuned presets so your SVG is simple, scalable, and easy
              to edit in Figma, Illustrator, or code.
            </p>
            <p className="mt-1 text-slate-600">
              Turn app icons, UI glyphs, and small logos into clean SVG paths.
              Presets are tuned for flat shapes and crisp edges, with live
              preview and droplet-safe limits.
            </p>

            <div className=" mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-700">
              <div className="font-semibold mb-1">Icon-specific tips</div>
              <ul className="list-disc ml-5 space-y-1">
                <li>
                  Want fewer nodes? Increase Curve tolerance (try 0.55–0.85).
                </li>
                <li>
                  Thin strokes disappearing? Raise Threshold and lower Turd
                  size.
                </li>
                <li>
                  Blobby edges? Lower Threshold or switch Turn policy to
                  minority.
                </li>
              </ul>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { k: "Icon presets", v: "Crisp, thin, bold, glyph simplify" },
                { k: "Live preview", v: "Fast ≤10 MB, throttled ≤25 MB" },
                { k: "Droplet safe", v: "RAM-only + backend safeguards" },
                { k: "Editable output", v: "Responsive viewBox paths" },
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
                "App icons",
                "Favicons",
                "UI glyphs",
                "Flat logos",
                "Badges",
                "Stickers",
                "Buttons",
                "Simple marks",
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
            <div className="flex items-end justify-between gap-4">
              <h3 itemProp="name" className="text-lg font-bold">
                How to convert an icon image to SVG
              </h3>
              <span className="text-xs text-slate-500">
                Upload → preset → adjust → export
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload your icon PNG/JPEG",
                  body: "Transparent PNG works well. If your file is large, preview may be throttled or locally compressed.",
                },
                {
                  title: "Choose an icon preset",
                  body: "Crisp is the default. Thin preserves light strokes. Glyph Simplify reduces node count.",
                },
                {
                  title: "Tune for clean shapes",
                  body: "Increase curve tolerance to reduce nodes. Adjust threshold to keep or drop light pixels.",
                },
                {
                  title: "Export SVG",
                  body: "Download the SVG or copy the raw markup for use in CSS, React, or design tools.",
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
                      <div className="mt-1 text-sm text-slate-600">
                        <span itemProp="itemListElement">{s.body}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold">Troubleshooting</h3>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {[
                [
                  "Icon looks too thick",
                  "Increase threshold or pick Icon - Preserve thin strokes.",
                ],
                [
                  "Too many nodes",
                  "Raise curve tolerance (0.55–0.85) and use Logo - Clean shapes.",
                ],
                ["Speckles", "Increase turd size to remove tiny dots."],
                [
                  "Edges are jagged",
                  "Increase curve tolerance slightly, or try majority turn policy.",
                ],
                [
                  "429 response",
                  "If backend conversion limits or server workload controls are reached, the app shows the Retry-After timing and retries when appropriate.",
                ],
                [
                  "Photo icon",
                  "Switch preprocess to Edge and adjust blur/boost.",
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
                  q: "Is this different from the general PNG to SVG converter?",
                  a: "Yes. This page is tuned for icons: cleaner curves, fewer nodes, and presets aimed at flat shapes and glyphs.",
                },
                {
                  q: "What limits apply?",
                  a: "PNG/JPEG up to 30 MB and about 30 MP. Preview is fastest up to 10 MB and throttled up to 25 MB. Backend icon-to-SVG conversion is limited to 120 conversions per minute, 400 per five minutes, 1,500 per hour, and 3,000 per day from the same connection and browser profile. Local preview, copy, download, and layer edits are not counted.",
                },
                {
                  q: "Do you store my icon?",
                  a: "No. Conversion runs in memory and results are returned immediately. There are no accounts.",
                },
                {
                  q: "How do I get fewer path points?",
                  a: "Increase curve tolerance and use Logo - Clean shapes or UI Glyph - Simplify.",
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
