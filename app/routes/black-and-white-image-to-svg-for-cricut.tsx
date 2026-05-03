import * as React from "react";
import type { Route } from "./+types/black-and-white-image-to-svg-for-cricut";
import {
  json,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { Link, useFetcher, type ActionFunctionArgs } from "react-router";
import { CurrentRouteGuide, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { useState } from "react";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
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
  const title =
    "Black and White Image to SVG for Cricut - Free Converter | iLoveSVG";
  const description =
    "Convert black and white images to clean SVG files for Cricut. Make cut-friendly SVGs, colored cut files, vinyl decals, sticker outlines, labels, and craft designs.";
  const canonical =
    "https://www.ilovesvg.com/black-and-white-image-to-svg-for-cricut";

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
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/svg+xml"]);

// Dark background default for invert "white on dark"
const DARK_BG_DEFAULT = "#0b1020";

type TraceMode = "single" | "layered";
type SvgLayerKind = "fill" | "stroke";
type PotraceTurnPolicy =
  | "black"
  | "white"
  | "left"
  | "right"
  | "minority"
  | "majority";

type SvgLayerMeta = {
  id: string;
  label: string;
  color: string;
  originalColor: string;
  visible: boolean;
  kind?: SvgLayerKind;
};

type EditableSvgLayer = SvgLayerMeta;

// -------- Live preview tiers (client) --------
// ≤10MB: fast,  10-25MB: throttled. >25MB → attempt client auto-compress to ≤25MB; if not possible, block with message.
const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 400;
const LIVE_MED_MS = 1500;

const PAGE_RATE_LIMITS = {
  perMinute: 120,
  perFiveMinutes: 400,
  perHour: 1500,
  perDay: 3000,
};

type RateLimitWindowName = "minute" | "fiveMinutes" | "hour" | "day";
type RateLimitWindowState = { windowStart: number; count: number };
type RateLimitRecord = Record<RateLimitWindowName, RateLimitWindowState>;
type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: Record<RateLimitWindowName, number>;
};

const RATE_LIMIT_WINDOWS: Record<
  RateLimitWindowName,
  { ms: number; limit: number }
> = {
  minute: { ms: 60 * 1000, limit: PAGE_RATE_LIMITS.perMinute },
  fiveMinutes: { ms: 5 * 60 * 1000, limit: PAGE_RATE_LIMITS.perFiveMinutes },
  hour: { ms: 60 * 60 * 1000, limit: PAGE_RATE_LIMITS.perHour },
  day: { ms: 24 * 60 * 60 * 1000, limit: PAGE_RATE_LIMITS.perDay },
};

function getRateLimitStore(): Map<string, RateLimitRecord> {
  const g = globalThis as any;
  if (!g.__iheartsvg_page_rate_limits) {
    g.__iheartsvg_page_rate_limits = new Map<string, RateLimitRecord>();
  }
  return g.__iheartsvg_page_rate_limits as Map<string, RateLimitRecord>;
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

function getBackendRateLimitKey(
  request: Request,
  routeSlug: string,
  actionName: string,
): string {
  const ip = getClientIp(request);
  const ua = (request.headers.get("user-agent") || "unknown").slice(0, 180);
  return `${routeSlug}:${actionName}:${ip}:${ua}`;
}

function createRateLimitRecord(now: number): RateLimitRecord {
  return {
    minute: { windowStart: now, count: 0 },
    fiveMinutes: { windowStart: now, count: 0 },
    hour: { windowStart: now, count: 0 },
    day: { windowStart: now, count: 0 },
  };
}

function checkBackendRateLimit(
  request: Request,
  routeSlug: string,
  actionName: string,
): RateLimitResult {
  const now = Date.now();
  const store = getRateLimitStore();
  const key = getBackendRateLimitKey(request, routeSlug, actionName);
  const record = store.get(key) || createRateLimitRecord(now);
  const windowNames = Object.keys(RATE_LIMIT_WINDOWS) as RateLimitWindowName[];

  for (const name of windowNames) {
    const cfg = RATE_LIMIT_WINDOWS[name];
    if (now - record[name].windowStart >= cfg.ms) {
      record[name] = { windowStart: now, count: 0 };
    }
  }

  const exceeded = windowNames.filter(
    (name) => record[name].count >= RATE_LIMIT_WINDOWS[name].limit,
  );

  if (exceeded.length > 0) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        Math.max(
          ...exceeded.map((name) => {
            const cfg = RATE_LIMIT_WINDOWS[name];
            return record[name].windowStart + cfg.ms - now;
          }),
        ) / 1000,
      ),
    );

    store.set(key, record);
    return {
      allowed: false,
      retryAfterSeconds,
      remaining: {
        minute: Math.max(0, PAGE_RATE_LIMITS.perMinute - record.minute.count),
        fiveMinutes: Math.max(
          0,
          PAGE_RATE_LIMITS.perFiveMinutes - record.fiveMinutes.count,
        ),
        hour: Math.max(0, PAGE_RATE_LIMITS.perHour - record.hour.count),
        day: Math.max(0, PAGE_RATE_LIMITS.perDay - record.day.count),
      },
    };
  }

  for (const name of windowNames) record[name].count++;
  store.set(key, record);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: {
      minute: Math.max(0, PAGE_RATE_LIMITS.perMinute - record.minute.count),
      fiveMinutes: Math.max(
        0,
        PAGE_RATE_LIMITS.perFiveMinutes - record.fiveMinutes.count,
      ),
      hour: Math.max(0, PAGE_RATE_LIMITS.perHour - record.hour.count),
      day: Math.max(0, PAGE_RATE_LIMITS.perDay - record.day.count),
    },
  };
}

function formatRetryAfterText(seconds: number): string {
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "Retry-After": String(Math.max(1, result.retryAfterSeconds)),
    "X-RateLimit-Limit-Minute": String(PAGE_RATE_LIMITS.perMinute),
    "X-RateLimit-Limit-Five-Minutes": String(PAGE_RATE_LIMITS.perFiveMinutes),
    "X-RateLimit-Limit-Hour": String(PAGE_RATE_LIMITS.perHour),
    "X-RateLimit-Limit-Day": String(PAGE_RATE_LIMITS.perDay),
    "X-RateLimit-Remaining-Minute": String(result.remaining.minute),
    "X-RateLimit-Remaining-Five-Minutes": String(result.remaining.fiveMinutes),
    "X-RateLimit-Remaining-Hour": String(result.remaining.hour),
    "X-RateLimit-Remaining-Day": String(result.remaining.day),
  };
}

// -------- Concurrency gate (server) --------
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

    const rateLimit = checkBackendRateLimit(
      request,
      "black-and-white-image-to-svg-for-cricut",
      "raster-trace",
    );
    if (!rateLimit.allowed) {
      const retryAfterText = formatRetryAfterText(rateLimit.retryAfterSeconds);
      return json(
        {
          error: `Too many conversions from this connection. Please try again in ${retryAfterText}.`,
        },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
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
        { error: "Only PNG, JPEG, or SVG images are allowed." },
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

      const { validateFileSignature } = await import("~/utils/backendSecurity.server");
      const signatureError = validateFileSignature(input, webFile, ALLOWED_MIME);
      if (signatureError) return signatureError;

      if (webFile.type === "image/svg+xml") {
        const svgText = new TextDecoder().decode(input);
        const annotated = annotateEditableSvgLayers(svgText);
        const ensured = ensureViewBoxResponsive(coerceSvg(annotated.svg));
        return json({
          svg: ensured.svg,
          width: ensured.width,
          height: ensured.height,
          layers: annotated.layers,
          gate: {
            running: gate.running,
            queued: gate.queued,
          },
        });
      }

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

      const traceMode = String(form.get("traceMode") ?? "single") as TraceMode;

      // Potrace params
      const threshold = Number(form.get("threshold") ?? 224);
      const turdSize = Number(form.get("turdSize") ?? 2);
      const optTolerance = Number(form.get("optTolerance") ?? 0.28);
      const turnPolicy = String(
        form.get("turnPolicy") ?? "minority",
      ) as PotraceTurnPolicy;

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

      if (traceMode === "layered") {
        const layered = await traceLayeredRaster(input, {
          colorLayerCount: clampInt(
            Number(form.get("colorLayerCount") ?? 5),
            2,
            12,
          ),
          layerMaxTraceSide: clampInt(
            Number(form.get("layerMaxTraceSide") ?? 1600),
            300,
            2400,
          ),
          minRegionPercent: clampNumber(
            Number(form.get("minRegionPercent") ?? 0.35),
            0,
            15,
          ),
          layerOptTolerance: clampNumber(
            Number(form.get("layerOptTolerance") ?? 0.45),
            0.05,
            1.5,
          ),
          layerTurdSize: clampInt(
            Number(form.get("layerTurdSize") ?? 4),
            0,
            30,
          ),
          layerTurnPolicy: String(
            form.get("layerTurnPolicy") ?? "majority",
          ) as PotraceTurnPolicy,
          posterize:
            String(form.get("posterize") ?? "true").toLowerCase() === "true",
          removeWhite:
            String(form.get("removeWhite") ?? "false").toLowerCase() === "true",
          removeTransparent:
            String(form.get("removeTransparent") ?? "true").toLowerCase() ===
            "true",
          transparent,
          bgColor,
        });

        return json({
          svg: layered.svg,
          width: layered.width,
          height: layered.height,
          layers: layered.layers,
          gate: {
            running: gate.running,
            queued: gate.queued,
          },
        });
      }

      // We interpret invert as output "white on dark"
      const whiteOnDark =
        String(form.get("invert") ?? "false").toLowerCase() === "true";

      // Force sensible output for white-on-dark only in the single-color path
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

      const svgRaw = await runPotrace(prepped, opts);

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
      const layers: EditableSvgLayer[] = [
        {
          id: "trace-color",
          label: "Trace color",
          color: lineColor,
          originalColor: lineColor,
          visible: true,
          kind: "fill",
        },
      ];
      const annotatedSVG = annotateSingleTracePaths(finalSVG, "trace-color");

      return json({
        svg: annotatedSVG,
        width: ensured.width,
        height: ensured.height,
        layers,
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

async function runPotrace(input: Buffer, opts: any): Promise<string> {
  const { traceBitmapToSvg: traceBitmapToSvgWithPotrace } = await import("~/utils/potraceCompat");
  return await traceBitmapToSvgWithPotrace(input, opts);
}

function clampNumber(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function clampInt(v: number, min: number, max: number) {
  return Math.round(clampNumber(v, min, max));
}

function normalizeHexColor(hex: string) {
  const raw = hex.trim().replace("#", "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(raw)) {
    return `#${raw
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
  return "#000000";
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((v) => clampInt(v, 0, 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

function hexToRgb(hex: string) {
  const h = normalizeHexColor(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function colorDistanceSq(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function sanitizeLayerIdPart(color: string) {
  return normalizeHexColor(color).replace("#", "");
}

type RGB = { r: number; g: number; b: number };

type TraceLayerBuildItem = {
  id: string;
  label: string;
  color: string;
  pixelPercent: number;
  pathTags: string;
};

async function traceLayeredRaster(
  input: Buffer,
  opts: {
    colorLayerCount: number;
    layerMaxTraceSide: number;
    minRegionPercent: number;
    layerOptTolerance: number;
    layerTurdSize: number;
    layerTurnPolicy: PotraceTurnPolicy;
    posterize: boolean;
    removeWhite: boolean;
    removeTransparent: boolean;
    transparent: boolean;
    bgColor: string;
  },
): Promise<{
  svg: string;
  width: number;
  height: number;
  layers: EditableSvgLayer[];
}> {
  const { getSharp } = await import("~/utils/conversionModules.server");
      const sharp = await getSharp();

  try {
    (sharp as any).concurrency?.(1);
    (sharp as any).cache?.({ files: 0, memory: 48 });
  } catch {}

  const { neutralizeTransparencyCheckerboard } = await import(
    "../utils/imagePreprocess.server"
  );
  const sourceInput = await neutralizeTransparencyCheckerboard(input);

  const { data, info } = await sharp(sourceInput)
    .rotate()
    .resize({
      width: opts.layerMaxTraceSide,
      height: opts.layerMaxTraceSide,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width | 0;
  const height = info.height | 0;

  if (!width || !height) {
    throw new Error("Could not decode image for layered SVG conversion.");
  }

  const raw = data as Buffer;
  const pixels = collectLayerPixels(raw, width, height, {
    removeTransparent: opts.removeTransparent,
    removeWhite: opts.removeWhite,
    posterize: opts.posterize,
  });

  if (pixels.length < 20) {
    throw new Error(
      "Not enough visible image data to build layers. Try disabling white or transparent background removal.",
    );
  }

  const palette = buildLayerPalette(pixels, opts.colorLayerCount);
  const assignments = assignAllPixelsToLayerPalette(raw, width, height, {
    palette,
    removeTransparent: opts.removeTransparent,
    removeWhite: opts.removeWhite,
    posterize: opts.posterize,
  });

  const totalAssignable = assignments.assignableCount || 1;
  const rawLayerItems = palette
    .map((rgb, index) => {
      const count = assignments.counts[index] || 0;
      const percent = (count / totalAssignable) * 100;
      return {
        index,
        rgb,
        color: rgbToHex(rgb.r, rgb.g, rgb.b),
        count,
        percent,
      };
    })
    .filter((x) => x.count > 0 && x.percent >= opts.minRegionPercent)
    .sort((a, b) => {
      const lumDiff = luminance(b.rgb) - luminance(a.rgb);
      if (Math.abs(lumDiff) > 8) return lumDiff;
      return b.count - a.count;
    });

  if (rawLayerItems.length === 0) {
    throw new Error(
      "No usable color layers were found. Try lowering the minimum region size or disabling white/transparent removal.",
    );
  }

  const builtLayers: TraceLayerBuildItem[] = [];

  for (const item of rawLayerItems) {
    const mask = Buffer.alloc(width * height, 255);

    for (let px = 0; px < assignments.layerForPixel.length; px++) {
      if (assignments.layerForPixel[px] === item.index) mask[px] = 0;
    }

    if (!maskHasInk(mask)) continue;

    const maskPng = await sharp(mask, {
      raw: { width, height, channels: 1 },
    })
      .png()
      .toBuffer();

    const pathTags = await traceMaskToPathTags(maskPng, {
      turdSize: opts.layerTurdSize,
      optTolerance: opts.layerOptTolerance,
      turnPolicy: opts.layerTurnPolicy,
    });

    if (!pathTags.trim()) continue;

    const label = `Layer ${builtLayers.length + 1}`;
    const id = sanitizeLayerId(
      `layer-${builtLayers.length + 1}-${item.color.replace("#", "")}`,
    );

    builtLayers.push({
      id,
      label,
      color: item.color,
      pixelPercent: Number(item.percent.toFixed(2)),
      pathTags,
    });
  }

  if (builtLayers.length === 0) {
    throw new Error(
      "The image did not produce traceable layers. Try fewer layers, lower speckle removal, or a higher-contrast image.",
    );
  }

  const svg = buildLayeredSvgString({
    width,
    height,
    layers: builtLayers,
    transparent: opts.transparent,
    bgColor: opts.bgColor,
  });

  return {
    svg,
    width,
    height,
    layers: builtLayers.map((layer) => ({
      id: layer.id,
      label: layer.label,
      color: layer.color,
      originalColor: layer.color,
      visible: true,
      kind: "fill",
    })),
  };
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
): {
  layerForPixel: Int16Array;
  counts: number[];
  assignableCount: number;
} {
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
  const k = clampInt(requestedCount, 2, 12);
  const uniqueMap = new Map<string, RGB>();

  for (const p of pixels) {
    uniqueMap.set(`${p.r},${p.g},${p.b}`, p);
    if (uniqueMap.size >= 4096) break;
  }

  const unique = Array.from(uniqueMap.values());
  if (unique.length <= k) return unique;

  const centroids = seedLayerCentroids(unique, k);

  for (let iter = 0; iter < 12; iter++) {
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

    for (const p of pixels) {
      const idx = nearestPaletteIndex(p, centroids);
      sums[idx].r += p.r;
      sums[idx].g += p.g;
      sums[idx].b += p.b;
      sums[idx].count++;
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
    const idx = Math.round((i * (sorted.length - 1)) / Math.max(1, k - 1));
    seeds.push({ ...sorted[idx] });
  }

  return dedupeLayerPalette(seeds, 1);
}

function dedupeLayerPalette(palette: RGB[], minDistanceSq = 1800): RGB[] {
  const out: RGB[] = [];
  for (const color of palette) {
    if (
      out.every((existing) => colorDistanceSq(color, existing) > minDistanceSq)
    ) {
      out.push(color);
    }
  }
  return out.length ? out : palette.slice(0, 1);
}

function nearestPaletteIndex(rgb: RGB, palette: RGB[]): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < palette.length; i++) {
    const dist = colorDistanceSq(rgb, palette[i]);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

function luminance(rgb: RGB): number {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function blendChannel(channel: number, alpha: number, bg: number): number {
  const a = clampNumber(alpha, 0, 255) / 255;
  return Math.round(channel * a + bg * (1 - a));
}

function posterizeChannel(value: number): number {
  const step = 32;
  return clampInt(Math.round(value / step) * step, 0, 255);
}

function isNearWhite(rgb: RGB): boolean {
  return rgb.r >= 245 && rgb.g >= 245 && rgb.b >= 245;
}

function maskHasInk(mask: Buffer): boolean {
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < 250) return true;
  }
  return false;
}

async function traceMaskToPathTags(
  maskPng: Buffer,
  opts: {
    turdSize: number;
    optTolerance: number;
    turnPolicy: PotraceTurnPolicy;
  },
): Promise<string> {
  const traced = await runPotrace(maskPng, {
    color: "#000000",
    threshold: 128,
    turdSize: opts.turdSize,
    optTolerance: opts.optTolerance,
    turnPolicy: opts.turnPolicy,
    invert: false,
    blackOnWhite: true,
  });

  return extractPathTags(traced)
    .map((path) => stripPaintAttrs(path))
    .join("");
}

function sanitizeLayerId(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "layer";
}

function buildLayeredSvgString(args: {
  width: number;
  height: number;
  layers: TraceLayerBuildItem[];
  transparent: boolean;
  bgColor: string;
}): string {
  const groups = args.layers
    .map(
      (layer) =>
        `<g id="${layer.id}" data-layer-id="${layer.id}" data-layer-label="${escapeAttr(
          layer.label,
        )}" data-layer-color="${layer.color}" fill="${layer.color}">${layer.pathTags}</g>`,
    )
    .join("");

  const background = args.transparent
    ? ""
    : `<rect x="0" y="0" width="${args.width}" height="${args.height}" fill="${escapeAttr(
        normalizeHexColor(args.bgColor),
      )}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${args.width} ${args.height}">${background}${groups}</svg>`;
}

function extractPathTags(svg: string) {
  return Array.from(svg.matchAll(/<path\b[^>]*\/?>/gi)).map((m) => m[0]);
}

function stripPaintAttrs(tag: string) {
  return tag
    .replace(/\sfill\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\sstroke\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\sstyle\s*=\s*["'][^"']*["']/gi, "");
}

function annotateSingleTracePaths(svg: string, layerId: string) {
  return svg.replace(/<path\b([^>]*?)(\/?)>/gi, (match, attrs, slash) => {
    if (/data-fill-layer-id\s*=/.test(attrs)) return match;
    const cleanAttrs = attrs.replace(
      /\sdata-fill-layer-id\s*=\s*["'][^"']*["']/i,
      "",
    );
    return `<path${cleanAttrs} data-fill-layer-id="${layerId}"${slash}>`;
  });
}

const NAMED_SVG_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  pink: "#ffc0cb",
  gray: "#808080",
  grey: "#808080",
  brown: "#a52a2a",
  cyan: "#00ffff",
  magenta: "#ff00ff",
};

const NON_EDITABLE_PAINT =
  /^(none|transparent|currentcolor|inherit|context-fill|context-stroke|url\()/i;
const STRUCTURAL_SVG_TAGS = new Set([
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

function parsePaintValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw || NON_EDITABLE_PAINT.test(raw.toLowerCase())) return null;

  if (/^#[0-9a-f]{3}$/i.test(raw) || /^#[0-9a-f]{6}$/i.test(raw)) {
    return normalizeHexColor(raw);
  }

  const rgb = raw.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i,
  );
  if (rgb) {
    const alpha = rgb[4] == null ? 1 : Number(rgb[4]);
    if (alpha <= 0) return null;
    return rgbToHex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  }

  const named = NAMED_SVG_COLORS[raw.toLowerCase()];
  return named || null;
}

function parseStyleRules(svg: string) {
  const classRules = new Map<string, { fill?: string; stroke?: string }>();
  const idRules = new Map<string, { fill?: string; stroke?: string }>();
  const styleBlocks = Array.from(
    svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi),
  );

  for (const block of styleBlocks) {
    const css = block[1] || "";
    for (const rule of css.matchAll(/([.#][A-Za-z0-9_-]+)\s*\{([^}]*)\}/g)) {
      const selector = rule[1];
      const body = rule[2];
      const fill = parsePaintValue(
        (body.match(/fill\s*:\s*([^;]+)/i) || [])[1],
      );
      const stroke = parsePaintValue(
        (body.match(/stroke\s*:\s*([^;]+)/i) || [])[1],
      );
      if (!fill && !stroke) continue;
      const target = selector.startsWith(".") ? classRules : idRules;
      target.set(selector.slice(1), {
        fill: fill || undefined,
        stroke: stroke || undefined,
      });
    }
  }

  return { classRules, idRules };
}

function getAttr(attrs: string, name: string) {
  const m = attrs.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1] : null;
}

function upsertAttr(attrs: string, name: string, value: string) {
  const re = new RegExp(`\\s${name}\\s*=\\s*["'][^"']*["']`, "i");
  if (re.test(attrs))
    return attrs.replace(re, ` ${name}="${escapeAttr(value)}"`);
  return `${attrs} ${name}="${escapeAttr(value)}"`;
}

function escapeAttr(value: string) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function annotateEditableSvgLayers(svgRaw: string): {
  svg: string;
  layers: EditableSvgLayer[];
} {
  const { classRules, idRules } = parseStyleRules(svgRaw);
  const layers: EditableSvgLayer[] = [];
  const seen = new Set<string>();

  const svg = svgRaw.replace(
    /<([a-zA-Z][\w:-]*)\b([^>]*?)(\/?)>/g,
    (match, tagName, attrs, slash) => {
      const tag = String(tagName).toLowerCase();
      if (STRUCTURAL_SVG_TAGS.has(tag)) return match;

      const id = getAttr(attrs, "id");
      const className = getAttr(attrs, "class");
      const style = getAttr(attrs, "style") || "";

      let fill =
        parsePaintValue(getAttr(attrs, "fill")) ||
        parsePaintValue((style.match(/fill\s*:\s*([^;]+)/i) || [])[1]);
      let stroke =
        parsePaintValue(getAttr(attrs, "stroke")) ||
        parsePaintValue((style.match(/stroke\s*:\s*([^;]+)/i) || [])[1]);

      if (!fill && className) {
        for (const cls of className.split(/\s+/)) {
          fill = classRules.get(cls)?.fill || fill;
          stroke = classRules.get(cls)?.stroke || stroke;
        }
      }

      if (!fill && id) fill = idRules.get(id)?.fill || fill;
      if (!stroke && id) stroke = idRules.get(id)?.stroke || stroke;

      const paint = fill || stroke;
      if (!paint) return match;

      const kind: SvgLayerKind = fill ? "fill" : "stroke";
      const layerId = `${kind}-${layers.length + 1}-${sanitizeLayerIdPart(paint)}`;
      let nextAttrs = attrs;

      if (tag === "g") {
        nextAttrs = upsertAttr(nextAttrs, "data-layer-id", layerId);
      } else if (kind === "fill") {
        nextAttrs = upsertAttr(nextAttrs, "data-fill-layer-id", layerId);
      } else {
        nextAttrs = upsertAttr(nextAttrs, "data-stroke-layer-id", layerId);
      }

      if (!seen.has(layerId)) {
        layers.push({
          id: layerId,
          label: `Layer ${layers.length + 1}`,
          color: paint,
          originalColor: paint,
          visible: true,
          kind,
        });
        seen.add(layerId);
      }

      return `<${tagName}${nextAttrs}${slash}>`;
    },
  );

  return { svg: coerceSvg(svg), layers };
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
  traceMode: TraceMode;

  threshold: number;
  turdSize: number;
  optTolerance: number;
  turnPolicy: PotraceTurnPolicy;
  lineColor: string;
  invert: boolean;

  // background
  transparent: boolean;
  bgColor: string;

  // preprocess
  preprocess: "none" | "edge";
  blurSigma: number;
  edgeBoost: number;

  // layered color tracing
  colorLayerCount: number;
  layerMaxTraceSide: number;
  minRegionPercent: number;
  layerOptTolerance: number;
  layerTurdSize: number;
  layerTurnPolicy: PotraceTurnPolicy;
  posterize: boolean;
  removeWhite: boolean;
  removeTransparent: boolean;
};

type Preset = {
  id: string;
  label: string;
  settings: Partial<Settings>;
};

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
    id: "bw-clean-cut",
    label: "B/W - Clean Cricut cut",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 224,
      turdSize: 3,
      optTolerance: 0.32,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "bw-bold-vinyl",
    label: "Vinyl - Bold black cut",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 208,
      turdSize: 5,
      optTolerance: 0.46,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "bw-fine-detail",
    label: "Fine detail - Thin lines",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 238,
      turdSize: 1,
      optTolerance: 0.18,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "bw-remove-speckles",
    label: "Cleanup - Remove speckles",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 226,
      turdSize: 7,
      optTolerance: 0.36,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "bw-close-gaps",
    label: "Cleanup - Close gaps",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 216,
      turdSize: 4,
      optTolerance: 0.42,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "bw-sticker-outline",
    label: "Sticker - Clean outline",
    settings: {
      traceMode: "single",
      preprocess: "edge",
      blurSigma: 0.85,
      edgeBoost: 1.3,
      threshold: 230,
      turdSize: 3,
      optTolerance: 0.42,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "colored-red-vinyl",
    label: "Color - Red vinyl",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 224,
      turdSize: 3,
      optTolerance: 0.34,
      turnPolicy: "majority",
      lineColor: "#dc2626",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "colored-blue-vinyl",
    label: "Color - Blue vinyl",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 224,
      turdSize: 3,
      optTolerance: 0.34,
      turnPolicy: "majority",
      lineColor: "#2563eb",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "colored-pink-decal",
    label: "Color - Pink decal",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 224,
      turdSize: 3,
      optTolerance: 0.34,
      turnPolicy: "majority",
      lineColor: "#db2777",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "colored-gold-label",
    label: "Color - Gold label",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 224,
      turdSize: 3,
      optTolerance: 0.34,
      turnPolicy: "majority",
      lineColor: "#b45309",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "white-vinyl-dark-preview",
    label: "White vinyl - Dark preview",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 224,
      turdSize: 3,
      optTolerance: 0.34,
      turnPolicy: "majority",
      invert: true,
      lineColor: "#ffffff",
      transparent: false,
      bgColor: DARK_BG_DEFAULT,
    },
  },
  {
    id: "inverted-negative",
    label: "Invert - Negative stencil",
    settings: {
      traceMode: "single",
      preprocess: "none",
      threshold: 225,
      turdSize: 3,
      optTolerance: 0.34,
      turnPolicy: "minority",
      invert: true,
      lineColor: "#ffffff",
      transparent: false,
      bgColor: "#111827",
    },
  },
];

const DISPLAY_PRESETS = extendTracePresets<Preset>(PRESETS);

const DEFAULTS: Settings = {
  ...DEFAULT_TRACE_ADVANCED_SETTINGS,
  traceMode: "layered",

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

const routeCapabilities = getRouteCapabilities("black-and-white-image-to-svg-for-cricut");

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
    React.useState<string>("layered-color-svg");
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
  const [fullscreenPreviewIndex, setFullscreenPreviewIndex] = React.useState<
    number | null
  >(null);

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
        layers: fetcher.data.layers?.map((layer) => ({
          ...layer,
          color: layer.color || layer.originalColor,
          visible: layer.visible !== false,
        })),
      };
      setHistory((prev) => [item, ...prev].slice(0, 10));
    }
  }, [
    fetcher.data?.svg,
    fetcher.data?.layers,
    fetcher.data?.width,
    fetcher.data?.height,
  ]);

  React.useEffect(() => {
    if (fetcher.data?.error) {
      setErr(fetcher.data.error);
    }
  }, [fetcher.data?.error]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function measureAndSet(f: File) {
    if (f.type === "image/svg+xml") {
      setDims(null);
      return;
    }
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
      setErr("Please choose a PNG, JPEG, or SVG.");
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
    setActivePreset("layered-color-svg");
    setHistory([]); // optional, remove if you want to keep old results

    setErr(null);
    setInfo(null);
    setDims(null);
    setOriginalFileSize(f.size);

    let chosen = f;

    if (chosen.size > LIVE_MED_MAX && chosen.type !== "image/svg+xml") {
      try {
        chosen = await compressToTarget25MB(chosen);
        setInfo(
          `Large image compressed for live preview from ${prettyBytes(
            f.size,
          )} to ${prettyBytes(chosen.size)}.`,
        );
      } catch (e: any) {
        setErr(
          e?.message ||
            "This image is too large for live preview. Please resize it and try again.",
        );
        suppressLiveRef.current = false;
        return;
      }
    }

    setFile(chosen);
    setAutoMode(getAutoMode(chosen.size));
    const url = URL.createObjectURL(chosen);
    setPreviewUrl(url);
    await measureAndSet(chosen);

    // Re-enable live preview and submit the selected file directly so the first upload
    // never depends on stale React state or generated output state.
    suppressLiveRef.current = false;
    void submitConvertWith(chosen, DEFAULTS);
  }

  async function submitConvert() {
    await submitConvertWith(file, settings);
  }

  async function submitConvertWith(
    sourceFile: File | null,
    sourceSettings: Settings,
  ) {
    if (!sourceFile) {
      setErr("Choose an image first.");
      return;
    }

    // Client-side precheck
    try {
      await validateBeforeSubmit(sourceFile);
    } catch (e: any) {
      setErr(e?.message || "Image is too large.");
      return;
    }

    // Ensure invert always produces visible output only for single-color output.
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
    fd.append("traceMode", effective.traceMode);
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
  // Backend conversions are triggered directly by uploads, preset clicks, and explicit
  // Convert / Update preview actions. Advanced setting changes update local state only.

  // Disable logic identical on SSR and first client render
  const buttonDisabled = isServer || !hydrated || busy || !file;

  function buildPresetSettings(
    _currentSettings: Settings,
    preset: Preset,
  ): Settings {
    return {
      ...DEFAULTS,
      ...preset.settings,
    } as Settings;
  }

  // Apply preset from a clean baseline so presets stay deterministic.
  function applyPreset(preset: Preset) {
    const nextSettings = buildPresetSettings(settings, preset);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setActivePreset(preset.id);
    setSettings(nextSettings);
    if (file) void submitConvertWith(file, nextSettings);
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

  function setHistoryLayer(
    stamp: number,
    layerId: string,
    patch: Partial<EditableSvgLayer>,
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
              })),
            },
      ),
    );
  }

  function getHistoryItemSvg(item: HistoryItem) {
    return item.layers?.length
      ? applyLayerEditsToSvg(item.svg, item.layers)
      : item.svg;
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

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start sm:pt-6 lg:pt-0 lg:pb-8">
            {/* INPUT */}
            <div className="order-1 min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] sm:border sm:border-slate-200">
              <h1 className="inline-flex text-center w-full justify-center mb-3 text-sky-950 items-center gap-2 text-xl sm:text-3xl font-extrabold leading-none m-0">
                Black and White Image to SVG for Cricut
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
                  {busy ? "Converting…" : "Convert B/W Image to Cricut SVG"}
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
                            a.download = "black-and-white-cricut-cut-file.svg";
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
                          Download Cricut SVG
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

                      {item.layers?.length ? (
                        <LayerPaletteEditor
                          layers={item.layers}
                          onLayerChange={(layerId, patch) =>
                            setHistoryLayer(item.stamp, layerId, patch)
                          }
                          onLayerReset={(layerId) =>
                            resetHistoryLayer(item.stamp, layerId)
                          }
                          onResetAll={() => resetAllHistoryLayers(item.stamp)}
                        />
                      ) : null}

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

        {/* Toast */}
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

function applyLayerEditsToSvg(svg: string, layers: EditableSvgLayer[]) {
  let out = svg;

  for (const layer of layers) {
    const color = normalizeHexColor(
      layer.color || layer.originalColor || "#000000",
    );
    const escapedId = escapeReg(layer.id);
    const displayAttr = layer.visible
      ? ""
      : ' display="none" data-editor-hidden="true"';

    out = out.replace(
      new RegExp(
        `<g\\b([^>]*data-layer-id\\s*=\\s*["']${escapedId}["'][^>]*)>`,
        "gi",
      ),
      (_match, attrs) => {
        let next = removeEditorDisplayAttrs(attrs);
        if (layer.kind === "stroke") {
          next = setSvgAttr(next, "stroke", color);
        } else {
          next = setSvgAttr(next, "fill", color);
        }
        if (!layer.visible) next += displayAttr;
        return `<g${next}>`;
      },
    );

    out = out.replace(
      new RegExp(
        `(<g\\b[^>]*data-layer-id\\s*=\\s*["']${escapedId}["'][^>]*>)([\\s\\S]*?)(<\\/g>)`,
        "gi",
      ),
      (_match, open, body, close) => {
        const cleanedBody = body.replace(
          /<path\b[^>]*\/?>/gi,
          (pathTag: string) =>
            layer.kind === "stroke"
              ? removeSvgAttr(pathTag, "stroke")
              : removeSvgAttr(pathTag, "fill"),
        );
        return `${open}${cleanedBody}${close}`;
      },
    );

    out = out.replace(
      new RegExp(
        `<([a-zA-Z][\\w:-]*)\\b([^>]*data-fill-layer-id\\s*=\\s*["']${escapedId}["'][^>]*)(\\/?)>`,
        "gi",
      ),
      (_match, tag, attrs, slash) => {
        let next = removeEditorDisplayAttrs(attrs);
        next = setSvgAttr(next, "fill", color);
        if (!layer.visible) next += displayAttr;
        return `<${tag}${next}${slash}>`;
      },
    );

    out = out.replace(
      new RegExp(
        `<([a-zA-Z][\\w:-]*)\\b([^>]*data-stroke-layer-id\\s*=\\s*["']${escapedId}["'][^>]*)(\\/?)>`,
        "gi",
      ),
      (_match, tag, attrs, slash) => {
        let next = removeEditorDisplayAttrs(attrs);
        next = setSvgAttr(next, "stroke", color);
        if (!layer.visible) next += displayAttr;
        return `<${tag}${next}${slash}>`;
      },
    );
  }

  return out;
}

function setSvgAttr(attrsOrTag: string, name: string, value: string) {
  const re = new RegExp(`\\s${name}\\s*=\\s*["'][^"']*["']`, "i");
  if (re.test(attrsOrTag)) {
    return attrsOrTag.replace(re, ` ${name}="${escapeAttr(value)}"`);
  }
  return `${attrsOrTag} ${name}="${escapeAttr(value)}"`;
}

function removeSvgAttr(tagOrAttrs: string, name: string) {
  return tagOrAttrs.replace(
    new RegExp(`\\s${name}\\s*=\\s*["'][^"']*["']`, "ig"),
    "",
  );
}

function removeEditorDisplayAttrs(attrs: string) {
  if (!/data-editor-hidden\s*=/.test(attrs)) return attrs;
  return attrs
    .replace(/\sdisplay\s*=\s*["']none["']/gi, "")
    .replace(/\sdata-editor-hidden\s*=\s*["']true["']/gi, "");
}

function LayerPaletteEditor({
  layers,
  onLayerChange,
  onLayerReset,
  onResetAll,
}: {
  layers: EditableSvgLayer[];
  onLayerChange: (layerId: string, patch: Partial<EditableSvgLayer>) => void;
  onLayerReset: (layerId: string) => void;
  onResetAll: () => void;
}) {
  return (
    <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-700">Layers</div>
        <button
          type="button"
          onClick={onResetAll}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 cursor-pointer transition-colors hover:bg-slate-100"
        >
          Reset all
        </button>
      </div>
      <div className="grid gap-1.5">
        {layers.map((layer) => (
          <LayerPaletteRow
            key={layer.id}
            layer={layer}
            onLayerChange={onLayerChange}
            onLayerReset={onLayerReset}
          />
        ))}
      </div>
    </div>
  );
}

function LayerPaletteRow({
  layer,
  onLayerChange,
  onLayerReset,
}: {
  layer: EditableSvgLayer;
  onLayerChange: (layerId: string, patch: Partial<EditableSvgLayer>) => void;
  onLayerReset: (layerId: string) => void;
}) {
  const [localColor, setLocalColor] = React.useState(layer.color);
  const latestColorRef = React.useRef(layer.color);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setLocalColor((current) => (current === layer.color ? current : layer.color));
    latestColorRef.current = layer.color;
  }, [layer.color]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function scheduleColor(nextColor: string) {
    setLocalColor((current) => (current === nextColor ? current : nextColor));
    latestColorRef.current = nextColor;

    if (timeoutRef.current) return;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onLayerChange(layer.id, { color: latestColorRef.current });
    }, 100);
  }

  function commitColor() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onLayerChange(layer.id, { color: latestColorRef.current });
  }

  return (
    <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
      <input
        type="checkbox"
        checked={layer.visible}
        onChange={(e) => onLayerChange(layer.id, { visible: e.target.checked })}
        className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
        title="Show layer"
      />
      <input
        type="color"
        value={localColor}
        onChange={(e) => scheduleColor(e.target.value)}
        onPointerUp={commitColor}
        onMouseUp={commitColor}
        onTouchEnd={commitColor}
        onBlur={commitColor}
        className="h-7 w-9 rounded-md border border-slate-200 bg-white cursor-pointer"
        title="Layer color"
      />
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-slate-800">
          {layer.label}
        </div>
        <div className="truncate text-[11px] text-slate-500">
          Original {layer.originalColor}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onLayerReset(layer.id)}
        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 cursor-pointer transition-colors hover:bg-slate-100"
      >
        Reset
      </button>
    </div>
  );
}

function ThrottledColorInput({
  value,
  onChange,
  disabled,
  className,
  title,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const [localValue, setLocalValue] = React.useState(value);
  const latestValueRef = React.useRef(value);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setLocalValue(value);
    latestValueRef.current = value;
  }, [value]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function schedule(next: string) {
    setLocalValue(next);
    latestValueRef.current = next;
    if (timeoutRef.current) return;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onChange(latestValueRef.current);
    }, 100);
  }

  function commit() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onChange(latestValueRef.current);
  }

  return (
    <input
      type="color"
      value={localValue}
      disabled={disabled}
      onChange={(e) => schedule(e.target.value)}
      onPointerUp={commit}
      onMouseUp={commit}
      onTouchEnd={commit}
      onBlur={commit}
      className={className}
      title={title}
    />
  );
}

function ThrottledRange({
  value,
  min,
  max,
  step,
  onChange,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const [localValue, setLocalValue] = React.useState(value);
  const latestValueRef = React.useRef(value);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setLocalValue(value);
    latestValueRef.current = value;
  }, [value]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function schedule(next: number) {
    setLocalValue(next);
    latestValueRef.current = next;
    if (timeoutRef.current) return;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onChange(latestValueRef.current);
    }, 100);
  }

  function commit() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onChange(latestValueRef.current);
  }

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={localValue}
      onChange={(e) => schedule(Number(e.target.value))}
      onPointerUp={commit}
      onMouseUp={commit}
      onTouchEnd={commit}
      onBlur={commit}
      className={className}
    />
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
    throw new Error("Only PNG, JPEG, or SVG images are allowed.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File too large. Max 30 MB per image.");
  }
  if (file.type === "image/svg+xml") return;
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
  const [localValue, setLocalValue] = React.useState(String(value));

  React.useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  function commit() {
    const parsed = Number(localValue);
    if (!Number.isFinite(parsed)) {
      setLocalValue(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    setLocalValue(String(clamped));
    onChange(clamped);
  }

  return (
    <input
      type="number"
      value={localValue}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
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
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Black and white image to Cricut SVG converter
              </p>
              <h2 className="text-2xl md:text-3xl font-bold leading-tight text-sky-950">
                Convert black and white artwork into Cricut-ready SVG cut files
              </h2>
              <p className="text-slate-600">
                Turn a black and white image into a clean SVG for Cricut Design
                Space. This page is tuned for silhouettes, line art, scanned
                drawings, printable sticker outlines, decals, labels, stencils,
                and simple craft graphics.
              </p>
              <p className="text-slate-600">
                Black and white images are often the best starting point for
                Cricut SVG conversion because the design already has clear light
                and dark areas. Use the black presets for standard cut files, or
                pick a color preset when you want the exported SVG path to match
                vinyl, sticker, label, or HTV material colors.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    k: "B/W cut presets",
                    v: "Clean cut, bold vinyl, fine detail, and stencil modes",
                  },
                  {
                    k: "Color SVG presets",
                    v: "Red, blue, pink, gold, white vinyl, and custom color output",
                  },
                  {
                    k: "Cleaner craft paths",
                    v: "Remove speckles, close gaps, and simplify rough edges",
                  },
                  {
                    k: "Cricut-focused output",
                    v: "Simple path-based SVGs for decals, stickers, and labels",
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

          <section>
            <h3 className="text-lg font-bold text-sky-950">
              Best uses for this black and white image to Cricut SVG converter
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Black vinyl decals",
                "White vinyl decals",
                "Sticker outlines",
                "Silhouettes",
                "Stencils",
                "Labels",
                "Line art",
                "Scanned drawings",
                "HTV designs",
                "Simple signs",
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
                  Best when the image is already high contrast
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  A clean black design on a white background, or a white design
                  on a dark background, usually traces better than a full color
                  photo. This route is built for users who already have a nearly
                  cut-ready black and white design and want a cleaner SVG.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold">
                  Color presets recolor the exported SVG path
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  The color presets do not create multiple layers. They convert
                  the black and white shape into one colored SVG path, useful
                  when you want a red decal, blue label, pink sticker graphic,
                  gold-style preview, or white vinyl preview.
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
                How to convert a black and white image to SVG for Cricut
              </h3>
              <span className="text-xs text-slate-500">
                Upload → choose B/W or color preset → clean up → download SVG
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload your black and white image",
                  body: "Start with a PNG or JPEG that has clear dark and light areas. Simple silhouettes, scanned drawings, and clean line art usually work best.",
                },
                {
                  title: "Choose a preset based on the craft result",
                  body: "Use Clean Cricut Cut for a general SVG, Bold Black Cut for vinyl, Fine Detail for line art, or a color preset when you want the SVG path exported in a specific color.",
                },
                {
                  title: "Clean up speckles or broken lines",
                  body: "Use Remove Speckles for dusty scans and Close Gaps when the image has weak or broken black areas.",
                },
                {
                  title: "Preview before downloading",
                  body: "Check the converted SVG for unwanted dots, overly thin details, missing holes, or rough edges before you save it.",
                },
                {
                  title: "Download and upload to Cricut Design Space",
                  body: "Save the SVG and import it into Cricut Design Space. Use it as a simple cut-style vector for vinyl decals, sticker designs, labels, stencils, and craft projects.",
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
            <h3 className="text-lg font-bold text-sky-950">
              Which preset should you use?
            </h3>
            <p className="mt-2 text-sm text-slate-600 max-w-[80ch]">
              Black and white Cricut projects are usually about getting the
              right cut shape. Use layered color presets when you want separated
              color layers, or use the older color presets for one-color SVG
              output.
            </p>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "B/W - Clean Cricut cut",
                  body: "Best default for black and white graphics that already look close to a cut file.",
                },
                {
                  title: "Vinyl - Bold black cut",
                  body: "Use this when you want a simpler, stronger decal that is easier to cut and weed.",
                },
                {
                  title: "Fine detail - Thin lines",
                  body: "Use this for crisp line art, handwriting, icons, and drawings where thin strokes matter.",
                },
                {
                  title: "Cleanup - Remove speckles",
                  body: "Use this for scanned drawings, compressed images, or older artwork with small unwanted dots.",
                },
                {
                  title: "Cleanup - Close gaps",
                  body: "Use this when black lines are cracked, faint, or disconnected and the trace is breaking apart.",
                },
                {
                  title: "Sticker - Clean outline",
                  body: "Use this when the goal is a clean outside edge or contour-style SVG instead of every internal detail.",
                },
                {
                  title: "Layered and single-color presets",
                  body: "Use layered color presets for separated color SVGs, or use red, blue, pink, and gold presets when you want one traced path in a material-matched color.",
                },
                {
                  title: "White vinyl - Dark preview",
                  body: "Use this for white vinyl projects so the white SVG shape stays visible against a dark preview background.",
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
            <h3 className="text-lg font-bold text-sky-950">
              Tips for cleaner Cricut SVGs from black and white images
            </h3>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Use true black and white when possible",
                  body: "Gray shadows and soft gradients can turn into rough paths. A strong black and white source usually cuts cleaner.",
                },
                {
                  title: "Remove paper texture first",
                  body: "Scans often include dust, shadows, and paper grain. Use the speckle cleanup preset or clean the image before uploading.",
                },
                {
                  title: "Use bold paths for vinyl",
                  body: "Tiny black areas can become tiny SVG paths that are hard to weed. Use the bold vinyl preset for simpler decals.",
                },
                {
                  title: "Use color presets for material planning",
                  body: "A red, blue, pink, or gold SVG can help preview the final material color before importing or arranging the design.",
                },
                {
                  title: "Keep transparent backgrounds for Cricut",
                  body: "Transparent SVG output is usually easier to layer, arrange, and reuse in Cricut Design Space.",
                },
                {
                  title: "Avoid using this for full photos",
                  body: "This page is for black and white artwork, silhouettes, and line art. Use a photo-specific route when starting from a real photo.",
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
            <h3 className="text-lg font-bold text-sky-950">
              Troubleshooting black and white SVG results
            </h3>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                [
                  "The SVG has lots of tiny dots",
                  "Use Cleanup - Remove Speckles or raise turd size in advanced settings.",
                ],
                [
                  "The design is too thin for vinyl",
                  "Use Vinyl - Bold Black Cut or increase curve tolerance to simplify the cut path.",
                ],
                [
                  "The SVG lost fine details",
                  "Use Fine Detail - Thin Lines and lower turd size so small strokes are preserved.",
                ],
                [
                  "The wrong areas became solid",
                  "Adjust threshold. Higher includes lighter gray pixels; lower keeps only darker parts of the image.",
                ],
                [
                  "White vinyl is invisible in preview",
                  "Use White Vinyl - Dark Preview so the SVG stays visible while you inspect the result.",
                ],
                [
                  "I expected multiple colors",
                  "Use one of the layered color SVG presets if you want separated color layers. The older red, blue, pink, and gold presets recolor a single traced path.",
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
            <h3 className="text-lg font-bold text-sky-950">
              Frequently asked questions
            </h3>

            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "Can I convert a black and white image to SVG for Cricut?",
                  a: "Yes. Upload a black and white PNG or JPEG, choose a cut-focused preset, then download a simple SVG that can be used for Cricut projects.",
                },
                {
                  q: "Can this create layered color SVG files?",
                  a: "Yes. Use the Layered color SVG presets when you want separated color layers. The older red, blue, pink, and gold presets still create one-color SVG paths for material previewing.",
                },
                {
                  q: "What image type works best?",
                  a: "A sharp black design on a white background usually works best. Simple silhouettes, icons, line art, and scanned drawings are better candidates than photos or shaded artwork.",
                },
                {
                  q: "Can I make a white vinyl SVG?",
                  a: "Yes. Use the White Vinyl - Dark Preview preset. It exports white paths on a dark preview background so the result remains visible while you inspect it.",
                },
                {
                  q: "Why are there small dots in my SVG?",
                  a: "Small dots usually come from scan dust, JPEG compression, or paper texture. Use the cleanup preset or increase turd size to remove more tiny artifacts.",
                },
                {
                  q: "Does this tool have usage limits?",
                  a: "Only backend conversion work is rate limited. Preview rendering, copy, download, and layer color edits are not rate limited because they run in your browser. Backend raster tracing allows up to 120 conversions per minute, 400 conversions every 5 minutes, 1500 conversions per hour, and 3000 conversions per day for the same connection and browser profile.",
                },
                {
                  q: "What file limits apply?",
                  a: "PNG, JPEG, or SVG files can be up to 30 MB. Raster images can be up to about 30 megapixels, and preview is fastest at 10 MB or below.",
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
