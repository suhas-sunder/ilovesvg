import * as React from "react";
import type { Route } from "./+types/home";
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
import { Link, useFetcher, type ActionFunctionArgs } from "react-router";
import { CurrentRouteGuide, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import {
  FullscreenOutputPreview,
  FullscreenPreviewButton,
  PreviewHistoryArrowButton,
} from "~/client/components/converter/FullscreenOutputPreview";
import {
  LayerPaletteEditor,
  applyLayerEditsToSvg,
} from "~/client/components/svg/LayerPaletteEditor";
import { ensureSvgRootNamespace } from "~/client/components/svg/EditedSvgPreviewImage";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";
import {
  ChevronDownIcon,
  PresetPicker,
} from "~/client/components/converter/PresetSelector";
import { extendTracePresets } from "~/client/lib/converter/presetAdditions";
import {
  inferPresetBackendIntensity,
  type PresetBackendIntensity,
} from "~/client/lib/converter/presetIntensity";
import {
  getBatchMaxForPreview,
  getBatchMaxForSpeedTier,
  getBatchSpeedTierForPreview,
  getBatchSpeedTierForPresetIntensity,
  getBatchSpeedTierForSettings,
  type BatchSpeedTier,
} from "~/client/lib/converter/batchLimits";
import { TraceAdvancedSettingsPanel } from "~/client/components/converter/AdvancedSettingsPanel";
import {
  FocusedEditorPreviewComparison,
  getSvgByteSize,
  OutputAppearanceControls,
} from "~/client/components/converter/TraceOutputPanel";
import { getRouteCapabilities } from "~/client/lib/converter/routeCapabilities";
import {
  DEFAULT_OUTPUT_APPEARANCE,
  applyOutputAppearanceToSvg,
  detectOutputAppearanceSupport,
  hasOutputAppearanceChanges,
  normalizeOutputAppearance,
  type OutputAppearanceSettings,
} from "~/client/lib/converter/outputAppearance";
import {
  DEFAULT_TRACE_ADVANCED_SETTINGS,
  appendAdvancedTraceSettings,
  type TraceAdvancedSettings,
} from "~/client/lib/converter/settings";
import { tryTraceRasterInClient } from "~/client/lib/tracing/vtracerWorkerClient";
import { AdvancedSettingsHelpSection } from "~/client/components/converter/AdvancedSettingsHelpSection";
import { logAppError } from "~/client/lib/errorLogging";
export { ChevronDownIcon, PresetPicker };

/** Stable server flag: true on SSR render, false in client bundle */
const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "iLoveSVG | PNG to SVG Converter - Free Online Image to SVG";
  const description =
    "Convert PNG, JPG, WebP, GIF, AVIF, BMP, TIFF, and SVG images to scalable SVG with presets, speed tags, advanced trace controls, editable layers, copy, download, and full-screen preview.";
  const canonical = "https://www.ilovesvg.com";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#2563eb" },

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
// Client uploads are capped and may be compressed before backend conversion.
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB
const MAX_MP = 30; // ~30 megapixels
const MAX_SIDE = 8000; // max width or height in pixels
const MIN_TRACE_SIDE = 2; // Potrace/Jimp can crash on 1x1 rasters.
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

// -------- Auto-conversion tiers (client) --------
// <=10MB: quick submit, 10-25MB: slower submit. >25MB -> attempt client auto-compress to <=25MB; if not possible, block with message.
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

const BATCH_RATE_LIMITS = {
  perMinute: 4,
  perFiveMinutes: 10,
  perHour: 30,
  perDay: 80,
};

const BATCH_PRO_INTEREST_STORAGE_KEY =
  "ilovesvg:pro-interest:batch-100:v1";
const PRO_INTEREST_LOG_URL =
  "https://script.google.com/macros/s/AKfycbw0anrpo5a_6gxXjfrEln-1o_pNcaSjj21-0xJB6qds4cuOrP4FPblqM2Rpb_9JUFClZA/exec";
const BATCH_SESSION_TTL_MS = 20 * 60 * 1000;

type BackendRateLimits = typeof PAGE_RATE_LIMITS;
type BackendRateLimitKey = keyof BackendRateLimits;
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
  limitKey: BackendRateLimitKey;
  limitHeader: string;
  remainingHeader: string;
}> = [
  {
    name: "minute",
    ms: 60 * 1000,
    limitKey: "perMinute",
    limitHeader: "X-RateLimit-Limit-Minute",
    remainingHeader: "X-RateLimit-Remaining-Minute",
  },
  {
    name: "fiveMinutes",
    ms: 5 * 60 * 1000,
    limitKey: "perFiveMinutes",
    limitHeader: "X-RateLimit-Limit-Five-Minutes",
    remainingHeader: "X-RateLimit-Remaining-Five-Minutes",
  },
  {
    name: "hour",
    ms: 60 * 60 * 1000,
    limitKey: "perHour",
    limitHeader: "X-RateLimit-Limit-Hour",
    remainingHeader: "X-RateLimit-Remaining-Hour",
  },
  {
    name: "day",
    ms: 24 * 60 * 60 * 1000,
    limitKey: "perDay",
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
  limits: BackendRateLimits = PAGE_RATE_LIMITS,
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

  const exceeded = RATE_LIMIT_WINDOWS.filter((windowConfig) => {
    const limit = limits[windowConfig.limitKey];
    return record[windowConfig.name].count >= limit;
  });

  const headers = new Headers();
  for (const windowConfig of RATE_LIMIT_WINDOWS) {
    const state = record[windowConfig.name];
    const limit = limits[windowConfig.limitKey];
    headers.set(windowConfig.limitHeader, String(limit));
    headers.set(
      windowConfig.remainingHeader,
      String(Math.max(0, limit - state.count)),
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
    const limit = limits[windowConfig.limitKey];
    headers.set(
      windowConfig.remainingHeader,
      String(Math.max(0, limit - state.count)),
    );
  }

  store.set(key, record);
  return { allowed: true, headers };
}

type BatchSessionRecord = {
  count: number;
  max: number;
  speedTier: BatchSpeedTier;
  expiresAt: number;
};

type BatchSessionResult =
  | {
      allowed: true;
      max: number;
      speedTier: BatchSpeedTier;
    }
  | {
      allowed: false;
      status: number;
      headers?: Headers;
      retryAfterMs?: number;
      error: string;
    };

function getBatchSessionStore(): Map<string, BatchSessionRecord> {
  const g = globalThis as any;
  if (!g.__ilovesvg_batch_sessions) {
    g.__ilovesvg_batch_sessions = new Map<string, BatchSessionRecord>();
  }
  return g.__ilovesvg_batch_sessions as Map<string, BatchSessionRecord>;
}

function getBatchSessionKey(request: Request, sessionId: string): string {
  const ip = normalizeKeyPart(getClientIp(request));
  const ua = normalizeKeyPart(request.headers.get("user-agent") || "unknown");
  return `${ip}:${ua}:${normalizeKeyPart(sessionId)}`;
}

function getBatchSettingsSnapshotFromForm(form: FormData): Record<string, unknown> {
  return {
    traceMode: form.get("traceMode"),
    preprocess: form.get("preprocess"),
    maxTraceSide: form.get("maxTraceSide"),
    turdSize: form.get("turdSize"),
    optTolerance: form.get("optTolerance"),
    blurSigma: form.get("blurSigma"),
    edgeBoost: form.get("edgeBoost"),
    removeColors: form.get("removeColors"),
    brightness: form.get("brightness"),
    contrast: form.get("contrast"),
    edgeThreshold: form.get("edgeThreshold"),
    edgeThickness: form.get("edgeThickness"),
    noiseReduction: form.get("noiseReduction"),
    gapCloseStrength: form.get("gapCloseStrength"),
    minIslandPx: form.get("minIslandPx"),
    holeFillPx: form.get("holeFillPx"),
    colorLayerCount: form.get("colorLayerCount"),
    layerMaxTraceSide: form.get("layerMaxTraceSide"),
    colorMergeTolerance: form.get("colorMergeTolerance"),
    posterizeStrength: form.get("posterizeStrength"),
  };
}

function getServerBatchSpeedFromForm(form: FormData): BatchSpeedTier {
  const presetId = String(form.get("presetId") || "");
  const presetTier = getBatchSpeedTierForPresetIntensity(
    getPresetBackendIntensityById(presetId),
  );
  return presetTier ?? getBatchSpeedTierForSettings(getBatchSettingsSnapshotFromForm(form));
}

function checkBatchConversionSession(
  request: Request,
  form: FormData,
): BatchSessionResult {
  const rawSessionId = String(form.get("batchSessionId") || "");
  const sessionId = normalizeKeyPart(rawSessionId);
  if (!sessionId) {
    return {
      allowed: false,
      status: 400,
      error: "Batch session is missing. Please start the batch again.",
    };
  }

  const now = Date.now();
  const store = getBatchSessionStore();
  for (const [key, record] of store) {
    if (record.expiresAt <= now) store.delete(key);
  }

  const key = getBatchSessionKey(request, sessionId);
  let session = store.get(key);
  const isNewSession =
    !session || String(form.get("batchIndex") || "0") === "0";

  if (isNewSession) {
    const rateLimit = checkBackendConversionRateLimit(
      request,
      "png-to-svg-converter",
      "batch-raster-trace",
      BATCH_RATE_LIMITS,
    );
    if (!rateLimit.allowed) {
      return {
        allowed: false,
        status: 429,
        headers: rateLimit.headers,
        retryAfterMs: rateLimit.retryAfterMs,
        error: `Too many batch conversions from this connection. Please try again in ${rateLimit.retryAfterText}.`,
      };
    }

    const speedTier = getServerBatchSpeedFromForm(form);
    session = {
      count: 0,
      max: getBatchMaxForSpeedTier(speedTier),
      speedTier,
      expiresAt: now + BATCH_SESSION_TTL_MS,
    };
    store.set(key, session);
  }

  if (!session) {
    return {
      allowed: false,
      status: 400,
      error: "Batch session could not be created. Please start the batch again.",
    };
  }

  if (session.expiresAt <= now) {
    store.delete(key);
    return {
      allowed: false,
      status: 429,
      error: "Batch session expired. Please start the batch again.",
    };
  }

  if (session.count >= session.max) {
    return {
      allowed: false,
      status: 429,
      error: `This selected preview allows up to ${session.max} batch conversions.`,
    };
  }

  session.count += 1;
  session.expiresAt = now + BATCH_SESSION_TTL_MS;
  store.set(key, session);

  return {
    allowed: true,
    max: session.max,
    speedTier: session.speedTier,
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
    const intent = String(form.get("intent") || "single");
    const isBatchFile = intent === "batch-file";
    if (isBatchFile) {
      const batchSession = checkBatchConversionSession(request, form);
      if (!batchSession.allowed) {
        return json(
          {
            error: batchSession.error,
            retryAfterMs: batchSession.retryAfterMs,
            code: "BATCH_RATE_LIMITED",
          },
          { status: batchSession.status, headers: batchSession.headers },
        );
      }
    } else {
      const rateLimit = checkBackendConversionRateLimit(
        request,
        "png-to-svg-converter",
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
    }
    const clientRunId = sanitizeClientRunId(form.get("clientRunId"));

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
      const { sanitizeSvgMarkup } = await import("~/utils/svgSanitize.server");
      const sanitizedSvg = sanitizeSvgMarkup(svgText);
      if (!sanitizedSvg.ok) {
        return json(
          { error: sanitizedSvg.message, code: sanitizedSvg.code },
          { status: 415 },
        );
      }
      const layeredSvg = buildEditableSvgFromUploadedSvg(sanitizedSvg.svg);

      return json({
        svg: layeredSvg.svg,
        layers: layeredSvg.layers,
        width: layeredSvg.width,
        height: layeredSvg.height,
        sourceKind: "svg",
        clientRunId,
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
          clientRunId,
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

        if (w < MIN_TRACE_SIDE || h < MIN_TRACE_SIDE) {
          return json(
            {
              error:
                "Image is too small to trace safely. Please upload an image at least 2×2 pixels.",
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
        2600,
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
        });

        return json({
          svg: layered.svg,
          layers: layered.layers,
          width: layered.width,
          height: layered.height,
          engineUsed: "potrace",
          clientRunId,
          gate: {
            running: gate.running,
            queued: gate.queued,
          },
        });
      }

      // Normalize for Potrace
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

      // Potrace (CJS API)
      const routePotraceTrace = runSharedPotraceSvgTraceShared;

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

      const svgRaw: string = await routePotraceTrace(prepped, opts);

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
        engineUsed: "potrace",
        clientRunId,
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
    void err;
    return json(
      {
        error:
          "Conversion failed. Please try a smaller image or adjust the output settings.",
        code: "CONVERSION_FAILED",
      },
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

function sanitizeClientRunId(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 80);
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

async function routePotraceTrace(input: Buffer, opts: any): Promise<string> {
  const routePotraceTraceAdapter = runSharedPotraceSvgTraceShared;
  return await routePotraceTraceAdapter(input, opts);
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

async function routeLayeredTrace(
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
  const traced = await routePotraceTrace(maskPng, {
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
  opacity?: number;
  originalOpacity?: number;
  kind?: SvgLayerKind;
};

type EditableSvgLayer = SvgLayerMeta;

type Settings = TraceAdvancedSettings & {
  threshold: number;
  turdSize: number;
  optTolerance: number;
  turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  lineColor: string;
  invert: boolean;

  // layered color tracing
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
  category?: "lineart" | "photo-edge" | "scan" | "logo" | "diagram" | "layered";
  backendIntensity?: PresetBackendIntensity;
};

const PRESET_DEFINITIONS: Preset[] = [
  {
    id: "layered-color",
    label: "Layered color SVG",
    settings: {
      traceMode: "layered",
      colorLayerCount: 5,
      layerMaxTraceSide: MAX_TRACE_SIDE_DEFAULT,
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
    label: "Lineart  -  Accurate (default)",
    settings: {
      traceMode: "single",
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
      traceMode: "single",
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
      traceMode: "single",
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
      traceMode: "single",
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
      traceMode: "single",
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
      traceMode: "single",
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
      traceMode: "single",
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
      traceMode: "single",
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
      traceMode: "single",
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
      traceMode: "single",
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
      traceMode: "single",
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
      traceMode: "single",
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
      traceMode: "single",
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
      traceMode: "single",
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
  {
    id: "comics-inks",
    label: "Comics  -  Inks (chunky)",
    settings: {
      traceMode: "single",
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
      traceMode: "single",
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
      traceMode: "single",
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

const PRESETS: Preset[] = preparePresetList(PRESET_DEFINITIONS);
const DISPLAY_PRESETS = extendTracePresets<Preset>(PRESETS);
const DEFAULT_PRESET_ID = PRESETS[0]?.id ?? "line-accurate";

function getPresetBackendIntensityById(
  presetId?: string | null,
): PresetBackendIntensity | undefined {
  if (!presetId) return undefined;
  const preset = DISPLAY_PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset) return undefined;
  return preset.backendIntensity ?? inferPresetBackendIntensity(preset.settings);
}

function preparePresetList(presets: Preset[]): Preset[] {
  return presets
    .map((preset) => {
      const category = preset.category ?? inferPresetCategory(preset);
      return {
        ...preset,
        category,
      };
    })
    .sort((left, right) => presetCategoryRank(left.category) - presetCategoryRank(right.category));
}

function inferPresetCategory(preset: Preset): NonNullable<Preset["category"]> {
  if (preset.settings.traceMode === "layered") return "layered";
  if (preset.id.startsWith("line-")) return "lineart";
  if (preset.id.startsWith("photo-") || preset.id === "edge-clean" || preset.id === "noisy-denoise" || preset.id === "low-contrast") {
    return "photo-edge";
  }
  if (preset.id.startsWith("scan-")) return "scan";
  if (preset.id.startsWith("logo-")) return "logo";
  return "diagram";
}

function presetCategoryRank(category?: Preset["category"]) {
  switch (category) {
    case "lineart":
      return 0;
    case "photo-edge":
      return 1;
    case "scan":
      return 2;
    case "logo":
      return 3;
    case "diagram":
      return 4;
    case "layered":
      return 5;
    default:
      return 6;
  }
}

const DEFAULTS: Settings = {
  ...DEFAULT_TRACE_ADVANCED_SETTINGS,
  threshold: 224,
  turdSize: 2,
  optTolerance: 0.28,
  turnPolicy: "minority",
  lineColor: "#000000",
  invert: false,

  traceMode: "single",
  colorLayerCount: BASE_LAYERED_COLOR_DEFAULTS.layerCount,
  layerMaxTraceSide: BASE_LAYERED_COLOR_DEFAULTS.maxTraceSide,
  minRegionPercent: BASE_LAYERED_COLOR_DEFAULTS.minRegionPercent,
  layerOptTolerance: BASE_LAYERED_COLOR_DEFAULTS.optTolerance,
  layerTurdSize: BASE_LAYERED_COLOR_DEFAULTS.turdSize,
  layerTurnPolicy: BASE_LAYERED_COLOR_DEFAULTS.turnPolicy,
  posterize: BASE_LAYERED_COLOR_DEFAULTS.posterize,
  removeWhite: BASE_LAYERED_COLOR_DEFAULTS.removeWhite,
  removeTransparent: BASE_LAYERED_COLOR_DEFAULTS.removeTransparent,

  transparent: true,
  bgColor: "#ffffff",

  preprocess: "none",
  blurSigma: 0.8,
  edgeBoost: 1.0,
};

const routeCapabilities = getRouteCapabilities("home");

type ServerResult = {
  svg?: string;
  layers?: SvgLayerMeta[];
  error?: string;
  width?: number;
  height?: number;
  retryAfterMs?: number;
  code?: string;
  clientRunId?: string;
  engineUsed?: "vtracer" | "potrace";
  sourceKind?: "svg" | "raster";
  warnings?: string[];
  timings?: Record<string, number>;
  layerBuildMode?: string;
  requestedPaletteCount?: number;
  actualPaletteCount?: number;
  outputDetectedColors?: number;
  pathCount?: number;
  svgBytes?: number;
  gate?: { running: number; queued: number };
};

type OutputVersion = {
  svg: string;
  layers?: EditableSvgLayer[];
  width: number;
  height: number;
  originalWidth?: number;
  originalHeight?: number;
  presetId?: string;
  presetLabel?: string;
  presetBackendIntensity?: PresetBackendIntensity;
  settingsSnapshot?: Settings;
  layerBuildMode?: string;
  requestedPaletteCount?: number;
  actualPaletteCount?: number;
  outputDetectedColors?: number;
  pathCount?: number;
  svgBytes?: number;
};

type HistoryItem = {
  svg: string;
  layers?: EditableSvgLayer[];
  width: number;
  height: number;
  engineUsed?: "vtracer" | "potrace";
  sourceKind?: "svg" | "raster";
  warnings?: string[];
  timings?: Record<string, number>;
  layerBuildMode?: string;
  requestedPaletteCount?: number;
  actualPaletteCount?: number;
  outputDetectedColors?: number;
  pathCount?: number;
  svgBytes?: number;
  originalWidth?: number;
  originalHeight?: number;
  stamp: number;
  name: string;
  parentStamp?: number | null;
  presetId?: string;
  presetLabel?: string;
  presetBackendIntensity?: PresetBackendIntensity;
  settingsSnapshot?: Settings;
  draftSettings?: Settings;
  settingsOpen?: boolean;
  batchOpen?: boolean;
  batch?: OutputBatchState;
  updateError?: string | null;
  previousVersion?: OutputVersion | null;
  nextVersion?: OutputVersion | null;
  jobId?: string;
  jobStatus?: "queued" | "running" | "succeeded" | "failed" | "canceled";
  jobStartedAt?: number;
  jobCompletedAt?: number;
  jobError?: string | null;
  sourceFileName?: string;
  enginePathLabel?: string;
  canCancel?: boolean;
  appearance?: OutputAppearanceSettings;
};

type HistoryPreviewData = {
  svg: string;
  src: string;
};

type BatchZipResult = {
  filename: string;
  blob: Blob;
  count: number;
  failed: number;
  errors: string[];
  speedTier: BatchSpeedTier;
  dynamicMax: number;
};

type OutputBatchState = {
  files: File[];
  running: boolean;
  progress: { done: number; total: number };
  error: string | null;
  info: string | null;
  zip: BatchZipResult | null;
};

const OUTPUT_HISTORY_LIMIT = 10;

function trimOutputHistory(items: HistoryItem[]): HistoryItem[] {
  return items.slice(0, OUTPUT_HISTORY_LIMIT);
}

function outputMatchesActiveSource(
  item: Pick<HistoryItem, "sourceFileName">,
  currentFile: File | null,
): boolean {
  return !item.sourceFileName || currentFile?.name === item.sourceFileName;
}

// ---- tiering helpers (client) ----
type AutoMode = "fast" | "medium" | "off";
function getAutoMode(bytes?: number | null): AutoMode {
  if (bytes == null) return "off";
  if (bytes <= LIVE_FAST_MAX) return "fast";
  if (bytes <= LIVE_MED_MAX) return "medium";
  return "off";
}
function autoModeHint(mode: AutoMode): string {
  if (mode === "medium") return "Larger file detected.";
  return "";
}
function autoModeDetail(mode: AutoMode): string {
  if (mode === "medium")
    return "Conversion updates run less frequently to keep the editor responsive.";
  return "";
}

function createOutputBatchState(): OutputBatchState {
  return {
    files: [],
    running: false,
    progress: { done: 0, total: 0 },
    error: null,
    info: null,
    zip: null,
  };
}

function cloneEditableLayers(
  layers?: EditableSvgLayer[],
): EditableSvgLayer[] | undefined {
  return layers?.map((layer) => ({ ...layer }));
}

function snapshotOutputVersion(item: HistoryItem): OutputVersion {
  return {
    svg: item.svg,
    layers: cloneEditableLayers(item.layers),
    width: item.width,
    height: item.height,
    originalWidth: item.originalWidth,
    originalHeight: item.originalHeight,
    presetId: item.presetId,
    presetLabel: item.presetLabel,
    presetBackendIntensity: item.presetBackendIntensity,
    settingsSnapshot: item.settingsSnapshot,
    layerBuildMode: item.layerBuildMode,
    requestedPaletteCount: item.requestedPaletteCount,
    actualPaletteCount: item.actualPaletteCount,
    outputDetectedColors: item.outputDetectedColors,
    pathCount: item.pathCount,
    svgBytes: item.svgBytes,
  };
}

function mergeLayerEditsIntoResultLayers(
  resultLayers: SvgLayerMeta[] | undefined,
  sourceLayerEdits?: EditableSvgLayer[],
): EditableSvgLayer[] | undefined {
  if (!resultLayers?.length) return undefined;
  const sourceById = new Map(
    (sourceLayerEdits || []).map((layer) => [layer.id, layer]),
  );
  return resultLayers.map((layer) => {
    const source = sourceById.get(layer.id);
    return {
      ...layer,
      color: source?.color || layer.color || layer.originalColor,
      visible: source?.visible ?? (layer.visible !== false),
      opacity: source?.opacity ?? layer.opacity,
    };
  });
}

function clearOutputBatchResult(batch?: OutputBatchState): OutputBatchState | undefined {
  if (!batch) return batch;
  if (
    !batch.zip &&
    !batch.info &&
    !batch.error &&
    batch.progress.done === 0 &&
    batch.progress.total === 0
  ) {
    return batch;
  }
  return {
    ...batch,
    zip: null,
    info: null,
    error: null,
    progress: { done: 0, total: 0 },
  };
}

function hasVisibleSizeOverride(item: HistoryItem): boolean {
  const originalWidth = item.originalWidth || item.width;
  const originalHeight = item.originalHeight || item.height;
  return (
    item.width > 0 &&
    item.height > 0 &&
    (item.width !== originalWidth || item.height !== originalHeight)
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<ServerResult>();
  const batchFileInputRefs = React.useRef(new Map<number, HTMLInputElement>());
  const [file, setFile] = React.useState<File | null>(null);
  const [originalFileSize, setOriginalFileSize] = React.useState<number | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] =
    React.useState<string>(DEFAULT_PRESET_ID);
  const [activeClientTraceCount, setActiveClientTraceCount] = React.useState(0);
  const busy = fetcher.state !== "idle" || activeClientTraceCount > 0;
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [updatingOutputStamp, setUpdatingOutputStamp] = React.useState<
    number | null
  >(null);

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
  const historyPreviewDataCacheRef = React.useRef(
    new WeakMap<HistoryItem, HistoryPreviewData>(),
  );
  const [fullscreenPreviewIndex, setFullscreenPreviewIndex] = React.useState<
    number | null
  >(null);
  const [activeHistoryStamp, setActiveHistoryStamp] = React.useState<
    number | null
  >(null);
  const outputCounterRef = React.useRef(0);
  const activeHistoryStampRef = React.useRef<number | null>(null);
  const latestSubmittedRunIdRef = React.useRef("");
  const clientRunIdCounterRef = React.useRef(0);
  const clientAbortControllersRef = React.useRef(new Map<string, AbortController>());
  const lastProcessedResultKeyRef = React.useRef("");
  const fileMeasureRunIdRef = React.useRef(0);
  const busyRetryCountRef = React.useRef(0);
  const lastSubmittedRef = React.useRef<{
    settings: Settings;
    presetId: string | null;
    parentStamp: number | null;
    replaceStamp?: number | null;
    sourceLayerEdits?: EditableSvgLayer[];
    stamp?: number | null;
    name?: string;
    startedAt?: number;
    fileName?: string;
  }>({
    settings: DEFAULTS,
    presetId: DEFAULT_PRESET_ID,
    parentStamp: null,
    replaceStamp: null,
  });
  const submittedByRunIdRef = React.useRef(
    new Map<
      string,
      {
        settings: Settings;
        presetId: string | null;
        parentStamp: number | null;
        replaceStamp?: number | null;
        sourceLayerEdits?: EditableSvgLayer[];
        stamp?: number | null;
        name?: string;
        startedAt?: number;
        fileName?: string;
      }
    >(),
  );
  const hasActiveHistoryJob = history.some((item) =>
    item.jobStatus === "queued" || item.jobStatus === "running",
  );
  const [jobNowMs, setJobNowMs] = React.useState(() => Date.now());
  const [focusedOutputStamp, setFocusedOutputStamp] = React.useState<
    number | null
  >(null);
  const [collapsedOutputStamps, setCollapsedOutputStamps] = React.useState<
    ReadonlySet<number>
  >(() => new Set());
  const [highlightedOutputStamp, setHighlightedOutputStamp] = React.useState<
    number | null
  >(null);
  const [focusedSettingsSections, setFocusedSettingsSections] = React.useState<
    Map<number, string | null>
  >(() => new Map());

  React.useEffect(() => {
    if (!hasActiveHistoryJob) return;
    const interval = window.setInterval(() => setJobNowMs(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [hasActiveHistoryJob]);

  React.useEffect(() => {
    if (focusedOutputStamp == null) return;
    if (history.some((item) => item.stamp === focusedOutputStamp)) return;
    setFocusedOutputStamp(null);
  }, [focusedOutputStamp, history]);

  React.useEffect(() => {
    if (focusedOutputStamp == null) return;
    const stamp = focusedOutputStamp;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeFocusedEditor(stamp);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusedOutputStamp]);

  React.useEffect(() => {
    activeHistoryStampRef.current = activeHistoryStamp;
  }, [activeHistoryStamp]);

  // Auto-conversion tier
  const [autoMode, setAutoMode] = React.useState<AutoMode>("off");

  function handleSuccessfulTraceData(data: ServerResult) {
    if (!data.svg) {
      return;
    }

      const clientRunId = data.clientRunId || "";
      const submitted =
        (clientRunId && submittedByRunIdRef.current.get(clientRunId)) ||
        lastSubmittedRef.current;

      const resultKey = [
        clientRunId || "legacy",
        data.svg.length,
        data.width ?? 0,
        data.height ?? 0,
        data.layers?.length ?? 0,
      ].join(":");
      if (lastProcessedResultKeyRef.current === resultKey) return;
      lastProcessedResultKeyRef.current = resultKey;
      busyRetryCountRef.current = 0;
      if (clientRunId) submittedByRunIdRef.current.delete(clientRunId);
      if (clientRunId) clientAbortControllersRef.current.delete(clientRunId);

      const parentStamp = submitted.parentStamp;
      const presetLabel =
        DISPLAY_PRESETS.find((preset) => preset.id === submitted.presetId)?.label ||
        "Custom settings";
      const presetBackendIntensity = getPresetBackendIntensityById(
        submitted.presetId,
      );
      const resultLayers = mergeLayerEditsIntoResultLayers(
        data.layers,
        submitted.sourceLayerEdits,
      );
      const resultSvg = data.svg;
      const resultWidth = data.width ?? 0;
      const resultHeight = data.height ?? 0;

      if (submitted.replaceStamp) {
        const replaceStamp = submitted.replaceStamp;
        setHistory((prev) =>
          prev.map((item) =>
            item.stamp === replaceStamp
              ? {
                  ...item,
                  svg: resultSvg,
                  layers: resultLayers,
                  width: resultWidth,
                  height: resultHeight,
                  originalWidth: resultWidth,
                  originalHeight: resultHeight,
                  parentStamp,
                  presetId: submitted.presetId ?? undefined,
                  presetLabel,
                  presetBackendIntensity,
                  settingsSnapshot: submitted.settings,
                  draftSettings: submitted.settings,
                  engineUsed: data.engineUsed || "potrace",
                  sourceKind: data.sourceKind || "raster",
                  warnings: data.warnings,
                  timings: data.timings,
                  layerBuildMode: data.layerBuildMode,
                  requestedPaletteCount: data.requestedPaletteCount,
                  actualPaletteCount: data.actualPaletteCount,
                  outputDetectedColors: data.outputDetectedColors,
                  pathCount: data.pathCount,
                  svgBytes: data.svgBytes,
                  updateError: null,
                  jobId: clientRunId || item.jobId,
                  jobStatus: "succeeded",
                  jobStartedAt: submitted.startedAt ?? item.jobStartedAt,
                  jobCompletedAt: Date.now(),
                  jobError: null,
                  sourceFileName: submitted.fileName ?? item.sourceFileName,
                  canCancel: false,
                  batch: item.batch
                    ? {
                        ...item.batch,
                        zip: null,
                        info: null,
                        error: null,
                        progress: { done: 0, total: 0 },
                      }
                    : item.batch,
                  previousVersion: snapshotOutputVersion(item),
                  nextVersion: null,
                }
              : item,
          ),
        );
        setActiveHistoryStamp((current) =>
          current === replaceStamp ? current : replaceStamp,
        );
        setUpdatingOutputStamp(null);
        return;
      }

      const outputNumber = outputCounterRef.current + 1;
      outputCounterRef.current = outputNumber;
      const stamp = submitted.stamp ?? Date.now();
      const item: HistoryItem = {
        svg: resultSvg,
        layers: resultLayers,
        width: resultWidth,
        height: resultHeight,
        originalWidth: resultWidth,
        originalHeight: resultHeight,
        stamp,
        name: `Output ${outputNumber} · ${presetLabel}`,
        parentStamp,
        presetId: submitted.presetId ?? undefined,
        presetLabel,
        presetBackendIntensity,
        settingsSnapshot: submitted.settings,
        draftSettings: submitted.settings,
        engineUsed: data.engineUsed || "potrace",
        sourceKind: data.sourceKind || "raster",
        warnings: data.warnings,
        timings: data.timings,
        layerBuildMode: data.layerBuildMode,
        requestedPaletteCount: data.requestedPaletteCount,
        actualPaletteCount: data.actualPaletteCount,
        outputDetectedColors: data.outputDetectedColors,
        pathCount: data.pathCount,
        svgBytes: data.svgBytes,
        batch: createOutputBatchState(),
        jobId: clientRunId || undefined,
        jobStatus: "succeeded",
        jobStartedAt: submitted.startedAt,
        jobCompletedAt: Date.now(),
        jobError: null,
        sourceFileName: submitted.fileName,
        canCancel: false,
      };
      setHistory((prev) => {
        if (prev.some((candidate) => candidate.stamp === stamp)) {
          return prev.map((candidate) =>
            candidate.stamp === stamp ? item : candidate,
          );
        }
        return trimOutputHistory([item, ...prev]);
      });
      setActiveHistoryStamp((current) => (current === stamp ? current : stamp));
  }

  // When a fallback/server SVG arrives, push it through the same output path as client tracing.
  React.useEffect(() => {
    if (fetcher.data?.svg) {
      handleSuccessfulTraceData(fetcher.data);
    }
  }, [
    fetcher.data?.svg,
    fetcher.data?.layers,
    fetcher.data?.width,
    fetcher.data?.height,
    fetcher.data?.clientRunId,
  ]);

  React.useEffect(() => {
    if (history.length === 0) {
      if (activeHistoryStamp !== null) setActiveHistoryStamp(null);
      return;
    }

    if (!activeHistoryStamp || !history.some((item) => item.stamp === activeHistoryStamp)) {
      setActiveHistoryStamp(history[0].stamp);
    }
  }, [history, activeHistoryStamp]);

  React.useEffect(() => {
    if (fetcher.data?.error) {
      const clientRunId = fetcher.data.clientRunId || "";
      const submitted =
        (clientRunId && submittedByRunIdRef.current.get(clientRunId)) ||
        lastSubmittedRef.current;
      if (clientRunId) submittedByRunIdRef.current.delete(clientRunId);
      clientAbortControllersRef.current.delete(clientRunId);
      if (submitted.replaceStamp) {
        const message = fetcher.data.error || "Update preview failed.";
        setHistory((prev) =>
          prev.map((item) =>
            item.stamp === submitted.replaceStamp
              ? { ...item, updateError: message }
              : item,
          ),
        );
        setUpdatingOutputStamp(null);
        logAppError(new Error(message), {
          flowStep: "home_output_update_response",
          flowKind: "conversion",
          action: fetcher.data.code || "server_response",
          selectedFileType: file?.type,
          selectedFileSize: file?.size,
          imageDimensions: dims ? { width: dims.w, height: dims.h } : null,
          settingsSnapshot: submitted.settings,
        });
        return;
      }
      if (submitted.stamp) {
        const message = fetcher.data.error || "Conversion failed.";
        setHistory((prev) =>
          prev.map((item) =>
            item.stamp === submitted.stamp
              ? {
                  ...item,
                  jobStatus: "failed",
                  jobError: message,
                  jobCompletedAt: Date.now(),
                  canCancel: false,
                  updateError: null,
                }
              : item,
          ),
        );
        logAppError(new Error(message), {
          flowStep: "home_conversion_job_response",
          flowKind: "conversion",
          action: fetcher.data.code || "server_response",
          selectedFileType: file?.type,
          selectedFileSize: file?.size,
          imageDimensions: dims ? { width: dims.w, height: dims.h } : null,
          settingsSnapshot: submitted.settings,
        });
        return;
      }
      setErr((current) =>
        current === fetcher.data?.error ? current : fetcher.data?.error || null,
      );
      logAppError(new Error(fetcher.data.error), {
        flowStep: "home_conversion_response",
        flowKind: "conversion",
        action: fetcher.data.code || "server_response",
        selectedFileType: file?.type,
        selectedFileSize: file?.size,
        imageDimensions: dims ? { width: dims.w, height: dims.h } : null,
        settingsSnapshot: settings,
      });
    }
  }, [
    fetcher.data?.error,
    fetcher.data?.code,
    fetcher.data?.clientRunId,
    file,
    dims,
    settings,
  ]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function measureAndSet(f: File, runId = fileMeasureRunIdRef.current) {
    if (isSvgFile(f)) {
      if (fileMeasureRunIdRef.current === runId) {
        setDims((current) => (current === null ? current : null));
      }
      return;
    }

    try {
      const { w, h } = await getImageSize(f);
      if (fileMeasureRunIdRef.current !== runId) return;
      const mp = (w * h) / 1_000_000;
      setDims((current) =>
        current && current.w === w && current.h === h && current.mp === mp
          ? current
          : { w, h, mp },
      );
    } catch (error) {
      if (fileMeasureRunIdRef.current !== runId) return;
      setDims((current) => (current === null ? current : null));
      logAppError(error, {
        flowStep: "home_measure_image",
        flowKind: "async-processing",
        selectedFileType: f.type,
        selectedFileSize: f.size,
      });
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
    if (!isAllowedImageFile(f)) {
      setErr(`Please choose a ${ACCEPTED_IMAGE_LABEL} image.`);
      return;
    }

    // Pause auto conversion while we swap state
    suppressLiveRef.current = true;
    busyRetryCountRef.current = 0;
    lastProcessedResultKeyRef.current = "";
    const measureRunId = fileMeasureRunIdRef.current + 1;
    fileMeasureRunIdRef.current = measureRunId;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Clear current file first so nothing submits with the old one
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);

    // Reset active-input settings for the new upload. Output history is
    // independent from the active input and remains bounded separately.
    setSettings(DEFAULTS);
    setActivePreset(DEFAULT_PRESET_ID);
    setUpdatingOutputStamp(null);

    setErr(null);
    setInfo(null);
    setDims(null);
    setOriginalFileSize(f.size);

    let chosen = f;

    // ... keep ALL your existing compression logic and the rest unchanged ...

    setFile(chosen);
    setAutoMode(getAutoMode(chosen.size));
    const url = URL.createObjectURL(chosen);
    setPreviewUrl(url);
    await measureAndSet(chosen, measureRunId);

    // Re-enable auto conversion and submit the selected file directly so the first upload
    // never depends on stale React state.
    skipNextAutoSubmitRef.current = true;
    suppressLiveRef.current = false;
    void submitConvertWith(chosen, DEFAULTS, {
      presetId: DEFAULT_PRESET_ID,
      parentStamp: null,
    });
  }

  function getEffectiveSubmitSettings(targetSettings: Settings): Settings {
    if (targetSettings.traceMode === "layered" || !targetSettings.invert) {
      return targetSettings;
    }
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
  }

  async function submitConvert() {
    await submitConvertWith(file, settings, {
      presetId: activePreset,
      parentStamp: null,
    });
  }

  function appendTraceSettingsPayload(fd: FormData, effective: Settings) {
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
  }

  function resolveSubmittedPresetId(
    candidatePresetId: string | undefined,
    effective: Settings,
  ): string | null {
    const preset = DISPLAY_PRESETS.find(
      (candidate) => candidate.id === candidatePresetId,
    );
    if (!preset) return null;
    const expected = buildPresetSettings(DEFAULTS, preset);
    return settingsEqual(expected, effective) ? preset.id : null;
  }

  async function submitConvertWith(
    targetFile: File | null,
    targetSettings: Settings,
    meta?: {
      presetId?: string;
      parentStamp?: number | null;
      replaceStamp?: number | null;
      sourceLayerEdits?: EditableSvgLayer[];
    },
  ) {
    if (!targetFile) {
      setErr("Choose an image first.");
      return false;
    }

    // Client-side precheck
    try {
      await validateBeforeSubmit(targetFile, dims ? { w: dims.w, h: dims.h } : undefined);
    } catch (e: any) {
      setErr(e?.message || "Image is too large.");
      return false;
    }

    // Ensure invert always produces visible output (white on dark)
    const effective = getEffectiveSubmitSettings(targetSettings);

    const fd = new FormData();
    fd.append("file", targetFile);
    appendTraceSettingsPayload(fd, effective);
    const clientRunId = `home-${Date.now()}-${++clientRunIdCounterRef.current}`;
    latestSubmittedRunIdRef.current = clientRunId;
    fd.append("clientRunId", clientRunId);
    setErr(null);
    const submittedPresetId = resolveSubmittedPresetId(
      meta?.presetId ?? activePreset,
      effective,
    );
    const startedAt = Date.now();
    const replaceStamp = meta?.replaceStamp ?? null;
    const presetLabel =
      DISPLAY_PRESETS.find((preset) => preset.id === submittedPresetId)?.label ||
      "Custom settings";
    const pendingStamp = replaceStamp ? null : startedAt;
    const submittedMeta = {
      settings: effective,
      presetId: submittedPresetId,
      parentStamp: meta?.parentStamp ?? null,
      replaceStamp,
      sourceLayerEdits: cloneEditableLayers(meta?.sourceLayerEdits),
      stamp: pendingStamp,
      name: pendingStamp ? `Output - ${presetLabel}` : undefined,
      startedAt,
      fileName: targetFile.name,
    };
    lastSubmittedRef.current = submittedMeta;
    submittedByRunIdRef.current.set(clientRunId, submittedMeta);
    const abortController = new AbortController();
    clientAbortControllersRef.current.set(clientRunId, abortController);

    if (pendingStamp) {
      const pendingItem: HistoryItem = {
        svg: "",
        layers: [],
        width: 0,
        height: 0,
        stamp: pendingStamp,
        name: submittedMeta.name || `Output - ${presetLabel}`,
        parentStamp: submittedMeta.parentStamp,
        presetId: submittedPresetId ?? undefined,
        presetLabel,
        presetBackendIntensity: getPresetBackendIntensityById(submittedPresetId),
        settingsSnapshot: effective,
        draftSettings: effective,
        batch: createOutputBatchState(),
        jobId: clientRunId,
        jobStatus: "running",
        jobStartedAt: startedAt,
        sourceFileName: targetFile.name,
        enginePathLabel:
          effective.traceMode === "layered"
            ? "Hybrid layered trace"
            : "Hybrid trace",
        canCancel: effective.traceMode === "layered",
      };
      setHistory((prev) => trimOutputHistory([pendingItem, ...prev]));
      setActiveHistoryStamp((current) =>
        current === pendingStamp ? current : pendingStamp,
      );
    }

    setActiveClientTraceCount((count) => count + 1);
    try {
      const clientTrace = await tryTraceRasterInClient({
        file: targetFile,
        settings: {
          ...effective,
          routeId: "home",
          presetId: submittedPresetId,
          presetBackendIntensity: getPresetBackendIntensityById(submittedPresetId),
        },
        presetId: submittedPresetId,
        presetBackendIntensity: getPresetBackendIntensityById(submittedPresetId),
        sourceWidth: dims?.w ?? null,
        sourceHeight: dims?.h ?? null,
        onProgress: (_progress, message) => {
          if (message) {
            setInfo(message);
          }
        },
        signal: abortController.signal,
      });

      if (clientTrace.ok) {
        handleSuccessfulTraceData({
          svg: clientTrace.result.svg,
          width: clientTrace.result.width,
          height: clientTrace.result.height,
          layers: clientTrace.result.layers,
          clientRunId,
          engineUsed: clientTrace.result.engineUsed,
          sourceKind: clientTrace.result.sourceKind,
          warnings: clientTrace.result.warnings,
          timings: clientTrace.result.timings,
          layerBuildMode: clientTrace.result.layerBuildMode,
          requestedPaletteCount: clientTrace.result.requestedPaletteCount,
          actualPaletteCount: clientTrace.result.actualPaletteCount,
          outputDetectedColors: clientTrace.result.outputDetectedColors,
          pathCount: clientTrace.result.pathCount,
          svgBytes: clientTrace.result.svgBytes,
        });
        setInfo("Converted in your browser with VTracer.");
        return true;
      }
      if (
        abortController.signal.aborted ||
        clientTrace.reason.toLowerCase().includes("canceled")
      ) {
        return false;
      }
    } finally {
      setActiveClientTraceCount((count) => Math.max(0, count - 1));
    }

    // Target this route's index action
    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action: `${window.location.pathname}?index`,
    });
    return true;
  }

  function patchHistoryItem(
    stamp: number,
    updater: (item: HistoryItem) => HistoryItem,
  ) {
    setHistory((prev) =>
      prev.map((item) => (item.stamp === stamp ? updater(item) : item)),
    );
  }

  function patchOutputBatchState(
    stamp: number,
    updater: (batch: OutputBatchState) => OutputBatchState,
  ) {
    patchHistoryItem(stamp, (item) => ({
      ...item,
      batch: updater(item.batch || createOutputBatchState()),
    }));
  }

  function updateOutputDraftSettings(
    stamp: number,
    updater: React.SetStateAction<Settings>,
  ) {
    patchHistoryItem(stamp, (item) => {
      const current =
        item.draftSettings || item.settingsSnapshot || getEffectiveSubmitSettings(settings);
      const next =
        typeof updater === "function"
          ? (updater as (value: Settings) => Settings)(current)
          : updater;
      return settingsEqual(current, next)
        ? item
        : { ...item, draftSettings: next };
    });
  }

  function toggleOutputSettings(stamp: number) {
    patchHistoryItem(stamp, (item) => ({
      ...item,
      settingsOpen: !item.settingsOpen,
      updateError: null,
    }));
  }

  function toggleOutputBatch(stamp: number) {
    patchHistoryItem(stamp, (item) => ({
      ...item,
      batchOpen: !item.batchOpen,
      batch: item.batch || createOutputBatchState(),
    }));
  }

  function stepOutputVersion(stamp: number, direction: "back" | "forward") {
    patchHistoryItem(stamp, (item) => {
      if (direction === "back") {
        if (!item.previousVersion) return item;
        const current = snapshotOutputVersion(item);
        return {
          ...item,
          ...item.previousVersion,
          draftSettings: item.previousVersion.settingsSnapshot || item.draftSettings,
          previousVersion: null,
          nextVersion: current,
          updateError: null,
          batch: item.batch
            ? {
                ...item.batch,
                zip: null,
                info: null,
                error: null,
                progress: { done: 0, total: 0 },
              }
            : item.batch,
        };
      }

      if (!item.nextVersion) return item;
      const current = snapshotOutputVersion(item);
      return {
        ...item,
        ...item.nextVersion,
        draftSettings: item.nextVersion.settingsSnapshot || item.draftSettings,
        previousVersion: current,
        nextVersion: null,
        updateError: null,
        batch: item.batch
          ? {
              ...item.batch,
              zip: null,
              info: null,
              error: null,
              progress: { done: 0, total: 0 },
            }
          : item.batch,
      };
    });
  }

  async function submitOutputUpdate(stamp: number) {
    if (updatingOutputStamp !== null || busy) return;
    const item = history.find((candidate) => candidate.stamp === stamp);
    if (!item) return;
    if (!file || !outputMatchesActiveSource(item, file)) {
      patchHistoryItem(stamp, (current) => ({
        ...current,
        updateError:
          current.sourceFileName && !file
            ? `Update preview needs the original source file (${current.sourceFileName}). Copy and download still use the saved SVG.`
            : current.sourceFileName
              ? `Update preview needs ${current.sourceFileName}; the active input is ${file?.name || "missing"}. Copy and download still use the saved SVG.`
              : "Choose a valid source image before updating this output preview.",
      }));
      setUpdatingOutputStamp(null);
      return;
    }
    const targetSettings = item.draftSettings || item.settingsSnapshot || settings;
    patchHistoryItem(stamp, (current) => ({ ...current, updateError: null }));
    setUpdatingOutputStamp(stamp);
    const submitted = await submitConvertWith(file, targetSettings, {
      presetId: item.presetId,
      parentStamp: null,
      replaceStamp: item.stamp,
      sourceLayerEdits: item.layers,
    });
    if (!submitted) {
      setUpdatingOutputStamp(null);
      patchHistoryItem(stamp, (current) => ({
        ...current,
        updateError:
          "Choose a valid source image before updating this output preview.",
      }));
    }
  }

  function cancelOutputJob(jobId: string, stamp: number) {
    clientAbortControllersRef.current.get(jobId)?.abort();
    clientAbortControllersRef.current.delete(jobId);
    submittedByRunIdRef.current.delete(jobId);
    patchHistoryItem(stamp, (item) => ({
      ...item,
      jobStatus: "canceled",
      jobError: "Conversion canceled.",
      jobCompletedAt: Date.now(),
      canCancel: false,
    }));
  }

  function retryOutputJob(stamp: number) {
    const item = history.find((candidate) => candidate.stamp === stamp);
    if (!item) return;
    if (!file || !outputMatchesActiveSource(item, file)) {
      patchHistoryItem(stamp, (current) => ({
        ...current,
        jobError:
          current.sourceFileName && !file
            ? `Retry needs the original source file (${current.sourceFileName}).`
            : current.sourceFileName
              ? `Retry needs ${current.sourceFileName}; the active input is ${file?.name || "missing"}.`
              : "Choose a valid source image before retrying this output.",
      }));
      return;
    }
    setHistory((prev) => prev.filter((candidate) => candidate.stamp !== stamp));
    void submitConvertWith(file, item.settingsSnapshot || item.draftSettings || settings, {
      presetId: item.presetId || activePreset,
      parentStamp: item.parentStamp ?? null,
    });
  }

  function getOutputBatchPreview(item: HistoryItem) {
    return {
      presetId: item.presetId,
      presetBackendIntensity: item.presetBackendIntensity,
      settingsSnapshot: item.settingsSnapshot as Record<string, unknown> | undefined,
    };
  }

  function getOutputBatchDynamicMax(item: HistoryItem) {
    return getBatchMaxForPreview(getOutputBatchPreview(item));
  }

  function handleOutputBatchFilesPicked(
    stamp: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const item = history.find((candidate) => candidate.stamp === stamp);
    const picked = Array.from(e.currentTarget.files || []);
    e.currentTarget.value = "";

    if (!item?.settingsSnapshot) {
      patchOutputBatchState(stamp, (batch) => ({
        ...batch,
        zip: null,
        info: null,
        error: "Convert this preview first, then batch from its applied settings.",
      }));
      return;
    }

    const accepted: File[] = [];
    let rejected = 0;
    for (const candidate of picked) {
      if (!isAllowedImageFile(candidate) || candidate.size > MAX_UPLOAD_BYTES) {
        rejected += 1;
        continue;
      }
      accepted.push(candidate);
    }

    const dynamicMax = getOutputBatchDynamicMax(item);
    const limited = accepted.slice(0, dynamicMax);
    const skippedByLimit = Math.max(0, accepted.length - limited.length);
    patchOutputBatchState(stamp, (batch) => ({
      ...batch,
      files: limited,
      zip: null,
      progress: { done: 0, total: 0 },
      error:
        rejected > 0
          ? `${rejected} file${rejected === 1 ? "" : "s"} skipped. Batch files must be ${ACCEPTED_IMAGE_LABEL} images under 30 MB each.`
          : null,
      info:
        skippedByLimit > 0
          ? `${skippedByLimit} extra file${skippedByLimit === 1 ? "" : "s"} skipped because this output allows up to ${dynamicMax} batch conversions.`
          : null,
    }));
  }

  async function submitOutputBatchConvert(stamp: number) {
    const sourceItem = history.find((candidate) => candidate.stamp === stamp);
    const batch = sourceItem?.batch || createOutputBatchState();
    if (!sourceItem?.settingsSnapshot) {
      patchOutputBatchState(stamp, (current) => ({
        ...current,
        error: "Convert this preview first, then batch from its applied settings.",
      }));
      return;
    }
    if (batch.running) return;

    const effective = getEffectiveSubmitSettings(sourceItem.settingsSnapshot);
    const submittedPresetId = resolveSubmittedPresetId(
      sourceItem.presetId,
      effective,
    );
    const runPreview = {
      presetId: submittedPresetId,
      presetBackendIntensity: submittedPresetId
        ? getPresetBackendIntensityById(submittedPresetId)
        : undefined,
      settingsSnapshot: effective as Record<string, unknown>,
    };
    const runSpeedTier = getBatchSpeedTierForPreview(runPreview);
    const runDynamicMax = getBatchMaxForPreview(runPreview);
    const filesToConvert = batch.files.slice(0, runDynamicMax);
    if (filesToConvert.length === 0) {
      patchOutputBatchState(stamp, (current) => ({
        ...current,
        error: "Choose files for this batch first.",
      }));
      return;
    }

    patchOutputBatchState(stamp, (current) => ({
      ...current,
      files:
        current.files.length > runDynamicMax
          ? current.files.slice(0, runDynamicMax)
          : current.files,
      running: true,
      error: null,
      info:
        current.files.length > runDynamicMax
          ? `${current.files.length - runDynamicMax} extra file${
              current.files.length - runDynamicMax === 1 ? "" : "s"
            } skipped because this output now allows up to ${runDynamicMax} batch conversions.`
          : null,
      zip: null,
      progress: { done: 0, total: filesToConvert.length },
    }));

    try {
      const { zipSync, strToU8 } = await import("fflate");
      const zipEntries: Record<string, Uint8Array> = {};
      const failures: string[] = [];
      const sourceLayerEdits = sourceItem.layers;
      const batchSessionId = `home-batch-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;

      for (let index = 0; index < filesToConvert.length; index += 1) {
        const batchFile = filesToConvert[index];
        const fd = new FormData();
        fd.append("intent", "batch-file");
        fd.append("batchSessionId", batchSessionId);
        fd.append("batchIndex", String(index));
        fd.append("batchTotal", String(filesToConvert.length));
        fd.append("file", batchFile);
        fd.append("batchSpeedTier", runSpeedTier);
        fd.append("batchDynamicMax", String(runDynamicMax));
        fd.append("sourceOutputStamp", String(sourceItem.stamp));
        fd.append("presetId", submittedPresetId ?? "");
        appendTraceSettingsPayload(fd, effective);
        fd.append(
          "clientRunId",
          `home-batch-${Date.now()}-${index + 1}-${filesToConvert.length}`,
        );

        try {
          const clientBatchTrace = await tryTraceRasterInClient({
            file: batchFile,
            settings: {
              ...effective,
              routeId: "home",
              presetId: submittedPresetId,
              presetBackendIntensity: runPreview.presetBackendIntensity,
            },
            presetId: submittedPresetId,
            presetBackendIntensity: runPreview.presetBackendIntensity,
            onProgress: (_progress, message) => {
              if (message) {
                patchOutputBatchState(stamp, (current) => ({
                  ...current,
                  info: `${message} (${index + 1}/${filesToConvert.length})`,
                }));
              }
            },
          });

          if (clientBatchTrace.ok) {
            const svgWithLayerEdits = sourceLayerEdits?.length
              ? applyLayerEditsToSvg(clientBatchTrace.result.svg, sourceLayerEdits)
              : clientBatchTrace.result.svg;
            const svgForZip = hasVisibleSizeOverride(sourceItem)
              ? applySvgSizeAttributes(
                  svgWithLayerEdits,
                  sourceItem.width,
                  sourceItem.height,
                )
              : svgWithLayerEdits;
            zipEntries[makeBatchZipEntryName(batchFile.name, index)] = strToU8(
              svgForZip,
            );
            continue;
          }

          const response = await fetch("/api/batch-svg", {
            method: "POST",
            body: fd,
            headers: { Accept: "application/json" },
          });
          const data = await readBatchConversionResponse(response);
          if (!response.ok || data.error || !data.svg) {
            const message =
              data.error ||
              `Server returned ${response.status || "an"} error for this file.`;
            logAppError(new Error(message), {
              flowStep: "home_batch_conversion_response",
              flowKind: "conversion",
              action: data.code || `batch_response_${response.status}`,
              selectedFileType: batchFile.type,
              selectedFileSize: batchFile.size,
              settingsSnapshot: effective,
            });
            failures.push(`${batchFile.name}: ${message}`);
          } else {
            const svgWithLayerEdits = sourceLayerEdits?.length
              ? applyLayerEditsToSvg(data.svg, sourceLayerEdits)
              : data.svg;
            const svgForZip = hasVisibleSizeOverride(sourceItem)
              ? applySvgSizeAttributes(
                  svgWithLayerEdits,
                  sourceItem.width,
                  sourceItem.height,
                )
              : svgWithLayerEdits;
            zipEntries[makeBatchZipEntryName(batchFile.name, index)] = strToU8(
              svgForZip,
            );
          }
        } catch (error) {
          logAppError(error, {
            flowStep: "home_batch_conversion_request",
            flowKind: "conversion",
            action: "batch_fetch_failed",
            selectedFileType: batchFile.type,
            selectedFileSize: batchFile.size,
            settingsSnapshot: effective,
          });
          failures.push(
            `${batchFile.name}: The batch request did not complete. Try fewer files or smaller images.`,
          );
        } finally {
          patchOutputBatchState(stamp, (current) => ({
            ...current,
            progress: { done: index + 1, total: filesToConvert.length },
          }));
        }
      }

      const successCount = Object.keys(zipEntries).length;
      if (successCount === 0) {
        patchOutputBatchState(stamp, (current) => ({
          ...current,
          error:
            failures[0] ||
            "No files converted. Try fewer files or a faster selected preview.",
        }));
        return;
      }

      const zipped = zipSync(zipEntries, { level: 6 });
      const zipBuffer = new ArrayBuffer(zipped.byteLength);
      new Uint8Array(zipBuffer).set(zipped);
      const result: BatchZipResult = {
        filename: buildBatchZipFilename(sourceItem),
        blob: new Blob([zipBuffer], { type: "application/zip" }),
        count: successCount,
        failed: failures.length,
        errors: failures,
        speedTier: runSpeedTier,
        dynamicMax: runDynamicMax,
      };
      patchOutputBatchState(stamp, (current) => ({
        ...current,
        zip: result,
        info: failures.length
          ? `${successCount} file${successCount === 1 ? "" : "s"} converted. ${failures.length} failed.`
          : `${successCount} file${successCount === 1 ? "" : "s"} converted. Download the ZIP when ready, or choose a new batch to run again.`,
      }));
      maybeSendBatchProInterestSignal({
        batchCount: successCount,
        batchSpeedTier: runSpeedTier,
        batchDynamicMax: runDynamicMax,
      });
    } finally {
      patchOutputBatchState(stamp, (current) => ({
        ...current,
        running: false,
      }));
    }
  }

  function downloadOutputBatchZip(item: HistoryItem) {
    const zip = item.batch?.zip;
    if (!zip) return;
    const url = URL.createObjectURL(zip.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = zip.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function maybeSendBatchProInterestSignal(payload: {
    batchCount: number;
    batchSpeedTier: BatchSpeedTier;
    batchDynamicMax: number;
  }) {
    if (
      payload.batchCount !== 100 ||
      payload.batchSpeedTier !== "fastest" ||
      payload.batchDynamicMax !== 100
    ) {
      return;
    }
    try {
      if (window.localStorage.getItem(BATCH_PRO_INTEREST_STORAGE_KEY)) return;
      const body = JSON.stringify({
        event: "batch_100",
        route: "home",
        page_url: window.location.origin + window.location.pathname,
        batch_count: payload.batchCount,
        batch_speed_tier: payload.batchSpeedTier,
        batch_dynamic_max: payload.batchDynamicMax,
        occurred_at: new Date().toISOString(),
        user_agent: navigator.userAgent,
      });
      const sent =
        typeof navigator.sendBeacon === "function"
          ? navigator.sendBeacon(
              PRO_INTEREST_LOG_URL,
              new Blob([body], { type: "application/json" }),
            )
          : false;
      if (!sent) {
        void fetch(PRO_INTEREST_LOG_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body,
        });
      }
      window.localStorage.setItem(
        BATCH_PRO_INTEREST_STORAGE_KEY,
        new Date().toISOString(),
      );
    } catch {
      // Pro-interest tracking is best-effort and must never block downloads.
    }
  }

  // ---- Tiered auto conversion for allowed upload sizes ----
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressLiveRef = React.useRef(false);
  const skipNextAutoSubmitRef = React.useRef(false);

  React.useEffect(() => {
    if (suppressLiveRef.current) return;
    if (!file) return;
    if (skipNextAutoSubmitRef.current) {
      skipNextAutoSubmitRef.current = false;
      return;
    }

    const mode = autoMode;
    if (mode === "off") return; // file >25MB and not compressible - no auto submit

    const delay = mode === "fast" ? LIVE_FAST_MS : LIVE_MED_MS;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      submitConvertWith(file, settings);
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Only upload/auto-mode changes should trigger this effect. Presets submit
    // their computed settings directly in applyPreset, and advanced controls stay
    // manual-only until Convert or Update preview is clicked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, autoMode]);

  // Disable logic identical on SSR and first client render
  const buttonDisabled = isServer || !hydrated || !file;

  function buildPresetSettings(
    currentSettings: Settings,
    preset: Preset,
  ): Settings {
    void currentSettings;

    return {
      ...DEFAULTS,
      ...preset.settings,
    } as Settings;
  }

  // Apply preset without carrying user overrides except background choices.
  // Submit the computed settings directly so every preset click uses the correct
  // values immediately, even if React state has not finished updating yet.
  function applyPreset(preset: Preset) {
    const nextSettings = buildPresetSettings(settings, preset);

    setActivePreset((current) => (current === preset.id ? current : preset.id));
    setSettings((current) =>
      settingsEqual(current, nextSettings) ? current : nextSettings,
    );

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (file && getAutoMode(file.size) !== "off") {
      void submitConvertWith(file, nextSettings, {
        presetId: preset.id,
        parentStamp: null,
      });
    }
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

  function getHistoryItemSvg(item: HistoryItem): string {
    const edited = item.layers?.length
      ? applyLayerEditsToSvg(item.svg, item.layers)
      : item.svg;
    const sized = applySvgSizeAttributes(edited, item.width, item.height);
    const appearance = normalizeOutputAppearance(item.appearance);
    if (!hasOutputAppearanceChanges(appearance)) return sized;
    return applyOutputAppearanceToSvg(
      sized,
      appearance,
      detectOutputAppearanceSupport(sized, { precisionOutput: false }),
    );
  }

  function getHistoryPreviewData(item: HistoryItem): HistoryPreviewData {
    const cached = historyPreviewDataCacheRef.current.get(item);
    if (cached) return cached;

    const svg = getHistoryItemSvg(item);
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const data = { svg, src };
    historyPreviewDataCacheRef.current.set(item, data);
    return data;
  }

  function getTraceJobPreviewData(item: HistoryItem): HistoryPreviewData {
    const title =
      item.jobStatus === "failed" || item.jobStatus === "canceled"
        ? "Conversion did not finish"
        : "Converting...";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" rx="18" fill="#f8fafc"/><text x="320" y="168" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#0f172a">${escapeSvgText(title)}</text><text x="320" y="204" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#475569">${escapeSvgText(item.presetLabel || "Custom settings")}</text></svg>`;
    return {
      svg,
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    };
  }

  function setOutputAppearance(
    stamp: number,
    patch: Partial<OutputAppearanceSettings>,
  ) {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp === stamp
          ? {
              ...item,
              appearance: normalizeOutputAppearance({
                ...(item.appearance ?? DEFAULT_OUTPUT_APPEARANCE),
                ...patch,
              }),
              batch: clearOutputBatchResult(item.batch),
            }
          : item,
      ),
    );
  }

  function resetOutputAppearance(stamp: number) {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp === stamp
          ? {
              ...item,
              appearance: DEFAULT_OUTPUT_APPEARANCE,
              batch: clearOutputBatchResult(item.batch),
            }
          : item,
      ),
    );
  }

  function toggleCollapsedOutput(stamp: number) {
    setCollapsedOutputStamps((current) => {
      const next = new Set(current);
      if (next.has(stamp)) next.delete(stamp);
      else next.add(stamp);
      return next;
    });
  }

  function setFocusedSettingsSection(stamp: number, sectionId: string | null) {
    setFocusedSettingsSections((current) => {
      const next = new Map(current);
      if (sectionId) {
        next.set(stamp, sectionId);
      } else {
        next.delete(stamp);
      }
      return next;
    });
  }

  function openFocusedEditor(stamp: number, sectionId = "output-appearance") {
    setFocusedSettingsSection(stamp, sectionId);
    setFocusedOutputStamp(stamp);
    setCollapsedOutputStamps((current) => {
      if (!current.has(stamp)) return current;
      const next = new Set(current);
      next.delete(stamp);
      return next;
    });
  }

  function openOutputBatchSettings(stamp: number) {
    patchHistoryItem(stamp, (item) => ({
      ...item,
      settingsOpen: true,
      batchOpen: true,
      batch: item.batch || createOutputBatchState(),
      updateError: null,
    }));
    openFocusedEditor(stamp, "batch");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const section = document.getElementById(`output-batch-${stamp}`);
        const toggle = document.getElementById(`output-batch-toggle-${stamp}`);
        section?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        toggle?.focus?.({ preventScroll: true });
      });
    });
  }

  function closeFocusedEditor(stamp: number) {
    setFocusedOutputStamp(null);
    setHighlightedOutputStamp(stamp);
    window.setTimeout(() => {
      const card = document.querySelector<HTMLElement>(
        `[data-output-stamp="${stamp}"]`,
      );
      card?.scrollIntoView({ block: "center", behavior: "smooth" });
      const action = card?.querySelector<HTMLElement>("[data-output-primary-action]");
      (action || card)?.focus?.({ preventScroll: true });
    }, 80);
    window.setTimeout(() => {
      setHighlightedOutputStamp((current) => (current === stamp ? null : current));
    }, 1_500);
  }

  function getTraceJobElapsedMs(item: HistoryItem, nowMs: number) {
    const started = Number(item.jobStartedAt || 0);
    if (!Number.isFinite(started) || started <= 0) return 0;
    const completed = Number(item.jobCompletedAt || 0);
    const end = Number.isFinite(completed) && completed > 0 ? completed : nowMs;
    return Math.max(0, end - started);
  }

  function formatTraceJobElapsed(elapsedMs: number) {
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) return `${seconds}s`;
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  function escapeSvgText(value: string) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setHistoryLayer(
    stamp: number,
    layerId: string,
    patch: Partial<Pick<EditableSvgLayer, "color" | "visible" | "opacity">>,
  ) {
    setHistory((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.stamp !== stamp || !item.layers?.length) return item;
        let itemChanged = false;
        const layers = item.layers.map((layer) => {
          if (layer.id !== layerId) return layer;
          if (!hasLayerPatchChanges(layer, patch)) return layer;
          itemChanged = true;
          return { ...layer, ...patch };
        });
        if (!itemChanged) return item;
        changed = true;
        return { ...item, layers, batch: clearOutputBatchResult(item.batch) };
      });
      return changed ? next : prev;
    });
  }

  function resetHistoryLayer(stamp: number, layerId: string) {
    setHistory((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.stamp !== stamp || !item.layers?.length) return item;
        let itemChanged = false;
        const layers = item.layers.map((layer) => {
          if (layer.id !== layerId) return layer;
          const resetPatch = {
            color: layer.originalColor,
            visible: true,
            opacity: layer.originalOpacity ?? 1,
          };
          if (!hasLayerPatchChanges(layer, resetPatch)) return layer;
          itemChanged = true;
          return { ...layer, ...resetPatch };
        });
        if (!itemChanged) return item;
        changed = true;
        return { ...item, layers, batch: clearOutputBatchResult(item.batch) };
      });
      return changed ? next : prev;
    });
  }

  function resetAllHistoryLayers(stamp: number) {
    setHistory((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.stamp !== stamp || !item.layers?.length) return item;
        let itemChanged = false;
        const layers = item.layers.map((layer) => {
          const resetPatch = {
            color: layer.originalColor,
            visible: true,
            opacity: layer.originalOpacity ?? 1,
          };
          if (!hasLayerPatchChanges(layer, resetPatch)) return layer;
          itemChanged = true;
          return { ...layer, ...resetPatch };
        });
        if (!itemChanged) return item;
        changed = true;
        return { ...item, layers, batch: clearOutputBatchResult(item.batch) };
      });
      return changed ? next : prev;
    });
  }

  function setHistorySize(stamp: number, size: { width: number; height: number }) {
    setHistory((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.stamp !== stamp) return item;
        const originalWidth = item.originalWidth || item.width;
        const originalHeight = item.originalHeight || item.height;
        if (
          item.width === size.width &&
          item.height === size.height &&
          item.originalWidth === originalWidth &&
          item.originalHeight === originalHeight
        ) {
          return item;
        }
        changed = true;
        return {
          ...item,
          width: size.width,
          height: size.height,
          originalWidth,
          originalHeight,
          batch: clearOutputBatchResult(item.batch),
        };
      });
      return changed ? next : prev;
    });
  }

  return (
    <>
      <HomeWebsiteSchema />
      <main className="bg-slate-50 text-[#0f2537]">
        <div className="max-w-[1180px] mx-auto px-4">
          <div className="hidden lg:block py-5">
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
              <h1 className="font-display m-0 mb-3 inline-flex w-full items-center justify-center gap-2 text-center text-[28px] font-[800] leading-[1.05] tracking-[-0.035em] text-sky-950 sm:text-[34px]">
                Free SVG Converter
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
                  <div className="mt-0 flex items-center justify-between gap-2 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2 text-slate-900">
                    <div className="flex items-center min-w-0 gap-2">
                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt=""
                          className="w-[22px] h-[22px] rounded-md object-cover mr-1"
                        />
                      )}
                      <span
                        title={file?.name || ""}
                        className="truncate text-[13px] font-medium text-slate-800"
                      >
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
                      aria-label="Remove selected file"
                      className="rounded-md border border-sky-200 bg-white px-2 py-1 text-slate-600 cursor-pointer transition-colors hover:bg-sky-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      x
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
                    "text-white bg-[#2563eb] border-[#1d4ed8] hover:bg-[#1d4ed8] hover:border-[#1e40af] cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1",
                    "disabled:opacity-70 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  <Icons
                    name="convert"
                    size={18}
                    className="mr-1"
                    title="Convert"
                  />
                  {busy ? "Converting…" : "Convert to SVG"}
                </button>

                {/* Auto-conversion tier notice */}
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

            {/* RESULTS */}
            <div
              data-focused-editor={focusedOutputStamp != null ? "true" : "false"}
              data-output-panel-focused={focusedOutputStamp != null ? "true" : "false"}
              className={[
                "converter-output-panel order-2 min-w-0 overflow-auto rounded-2xl border border-slate-300/40 bg-[#43546b] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] transition-[opacity,transform,box-shadow] duration-[300ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                focusedOutputStamp != null
                  ? "md:col-span-2 md:row-start-1 md:max-h-none md:self-start"
                  : "md:sticky md:top-4 md:row-span-3 md:max-h-[calc(100vh-2rem)] md:self-start",
              ].join(" ")}
            >
              {history.length > 0 ? (
                <div className="grid gap-3">
                  {history.map((item, index) => {
                    const isActiveJob =
                      item.jobStatus === "queued" || item.jobStatus === "running";
                    const isFailedJob =
                      item.jobStatus === "failed" || item.jobStatus === "canceled";
                    const previewData =
                      isActiveJob || isFailedJob
                        ? getTraceJobPreviewData(item)
                        : getHistoryPreviewData(item);
                    const displaySvgBytes = previewData.svg
                      ? getSvgByteSize(previewData.svg)
                      : item.svgBytes;
                    const outputSettings =
                      item.draftSettings || item.settingsSnapshot || settings;
                    const isUpdating = updatingOutputStamp === item.stamp;
                    const batch = item.batch || createOutputBatchState();
                    const batchDynamicMax = getOutputBatchDynamicMax(item);
                    const displayName = getHistoryDisplayName(item);
                    const focused = focusedOutputStamp === item.stamp;
                    const sourceAvailableForOutput =
                      outputMatchesActiveSource(item, file);
                    const focusedSettingsSection =
                      focusedSettingsSections.get(item.stamp) ??
                      "output-appearance";
                    const batchSectionOpen = focused
                      ? focusedSettingsSection === "batch"
                      : !!item.batchOpen;
                    if (focusedOutputStamp != null && !focused) return null;
                    const collapsed =
                      !focused && collapsedOutputStamps.has(item.stamp);
                    const appearance = normalizeOutputAppearance(item.appearance);
                    const appearanceSupport =
                      (focused || item.settingsOpen) && item.svg
                        ? detectOutputAppearanceSupport(
                            applySvgSizeAttributes(
                              item.layers?.length
                                ? applyLayerEditsToSvg(item.svg, item.layers)
                                : item.svg,
                              item.width,
                              item.height,
                            ),
                            { precisionOutput: false },
                          )
                        : null;
                    const appearanceControls =
                      appearanceSupport && !isActiveJob && !isFailedJob ? (
                        <OutputAppearanceControls
                          settings={appearance}
                          support={appearanceSupport}
                          onChange={(patch) =>
                            setOutputAppearance(item.stamp, patch)
                          }
                          onReset={() => resetOutputAppearance(item.stamp)}
                        />
                      ) : null;
                    const settingsPanel = (
                      <div
                        id={`output-settings-${item.stamp}`}
                        data-editor-settings-panel={focused ? "true" : undefined}
                        className={[
                          "rounded-xl border border-sky-200 bg-sky-50/70 p-2",
                          focused
                            ? "max-h-none min-w-0 max-w-full overflow-x-hidden p-3 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
                            : "mb-2",
                        ].join(" ")}
                      >
                        <TraceAdvancedSettingsPanel
                          id={`output-settings-panel-${item.stamp}`}
                          open={true}
                          settings={outputSettings}
                          setSettings={(updater) =>
                            updateOutputDraftSettings(item.stamp, updater)
                          }
                          capabilities={routeCapabilities}
                          detectedColorItems={[item]}
                          sourceFile={sourceAvailableForOutput ? file : null}
                          removeColorsEnabled={
                            !(
                              sourceAvailableForOutput &&
                              file &&
                              (file.type === "image/svg+xml" ||
                                /\.svg$/i.test(file.name || ""))
                            )
                          }
                          outputLayerItems={item.layers}
                          outputSize={{
                            width: item.width,
                            height: item.height,
                            originalWidth: item.originalWidth || item.width,
                            originalHeight: item.originalHeight || item.height,
                          }}
                          onOutputLayerChange={(layerId, patch) =>
                            setHistoryLayer(item.stamp, layerId, patch)
                          }
                          onResetOutputLayer={(layerId) =>
                            resetHistoryLayer(item.stamp, layerId)
                          }
                          onResetAllOutputLayers={() =>
                            resetAllHistoryLayers(item.stamp)
                          }
                          onOutputSizeChange={(size) =>
                            setHistorySize(item.stamp, size)
                          }
                          helpHref="#advanced-settings-help"
                          buttonDisabled={
                            buttonDisabled || isUpdating || !sourceAvailableForOutput
                          }
                          liveSectionTitle="Live preview edits"
                          liveSectionDescription="These settings edit this output card directly. Copy, download, and batch conversion use the current visible SVG."
                          livePreviewLead={
                            appearanceControls || item.layers?.length ? (
                              <div className="grid gap-2">
                                {appearanceControls}
                                {item.layers?.length ? (
                                  <div className="rounded-xl border border-slate-200 bg-white p-2">
                                    <p className="m-0 mb-2 text-[13px] font-bold text-slate-900">
                                      Layer colors
                                    </p>
                                    <LayerPaletteEditor
                                      item={item}
                                      onColorChange={(layerId, color) =>
                                        setHistoryLayer(item.stamp, layerId, {
                                          color,
                                        })
                                      }
                                      onVisibilityChange={(layerId, visible) =>
                                        setHistoryLayer(item.stamp, layerId, {
                                          visible,
                                        })
                                      }
                                      onOpacityChange={(layerId, opacity) =>
                                        setHistoryLayer(item.stamp, layerId, {
                                          opacity,
                                        })
                                      }
                                      onResetLayer={(layerId) =>
                                        resetHistoryLayer(item.stamp, layerId)
                                      }
                                      onResetAll={() =>
                                        resetAllHistoryLayers(item.stamp)
                                      }
                                    />
                                  </div>
                                ) : null}
                              </div>
                            ) : null
                          }
                          convertSectionTitle="Click to convert"
                          convertSectionDescription={
                            sourceAvailableForOutput
                              ? "These settings retrace the source image for this output only. Unapplied changes do not affect batch conversion."
                              : item.sourceFileName
                                ? `Update preview needs the original source file (${item.sourceFileName}). Copy, download, and batch still use the saved SVG.`
                                : "Choose the original source image to retrace this output. Copy, download, and batch still use the saved SVG."
                          }
                          hideOutputLayerStyling={true}
                          focusedEditorMode={focused}
                          defaultOpenSection="output-appearance"
                          openSection={focused ? focusedSettingsSection : undefined}
                          onOpenSectionChange={
                            focused
                              ? (sectionId) =>
                                  setFocusedSettingsSection(
                                    item.stamp,
                                    sectionId,
                                  )
                              : undefined
                          }
                          updatePreviewLabel={
                            isUpdating ? "Updating..." : "Update preview"
                          }
                          onUpdatePreview={() =>
                            void submitOutputUpdate(item.stamp)
                          }
                        />

                        <div
                          data-settings-section={`output-batch-${item.stamp}`}
                          data-settings-section-open={
                            batchSectionOpen ? "true" : "false"
                          }
                          className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white"
                        >
                          <button
                            id={`output-batch-toggle-${item.stamp}`}
                            type="button"
                            onClick={() => {
                              if (focused) {
                                setFocusedSettingsSection(
                                  item.stamp,
                                  batchSectionOpen ? null : "batch",
                                );
                                patchHistoryItem(item.stamp, (current) => ({
                                  ...current,
                                  batchOpen: true,
                                  batch:
                                    current.batch || createOutputBatchState(),
                                }));
                                return;
                              }
                              toggleOutputBatch(item.stamp);
                            }}
                            aria-expanded={batchSectionOpen}
                            aria-controls={`output-batch-${item.stamp}`}
                            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                          >
                            <span>Batch conversion</span>
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[12px] font-semibold text-sky-800">
                              Max {batchDynamicMax}
                            </span>
                          </button>

                          <div
                            className={[
                              "grid transition-[grid-template-rows] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                              batchSectionOpen
                                ? "grid-rows-[1fr]"
                                : "grid-rows-[0fr]",
                            ].join(" ")}
                          >
                            <div
                              id={`output-batch-${item.stamp}`}
                              aria-hidden={!batchSectionOpen}
                              className={[
                                "overflow-hidden transition-opacity duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                                batchSectionOpen ? "opacity-100" : "opacity-0",
                              ].join(" ")}
                            >
                              <div className="border-t border-slate-100 px-3 py-3">
                                <p className="m-0 text-[13px] leading-5 text-slate-600">
                                  Batch uses this output's current applied SVG
                                  and trace settings. Changes in Click to
                                  convert apply only after Update preview.
                                </p>
                                <p className="m-0 mt-2 text-[12px] leading-5 text-slate-600">
                                  {batchDynamicMax === 100
                                    ? "This output allows up to 100 batch conversions because it uses the fastest applied settings."
                                    : "This output allows up to 20 batch conversions because these applied settings may take longer to process."}
                                </p>

                              <input
                                ref={(node) => {
                                  if (node) {
                                    batchFileInputRefs.current.set(
                                      item.stamp,
                                      node,
                                    );
                                  } else {
                                    batchFileInputRefs.current.delete(
                                      item.stamp,
                                    );
                                  }
                                }}
                                type="file"
                                multiple
                                accept={Array.from(ALLOWED_EXTENSIONS)
                                  .map((ext) => `.${ext}`)
                                  .join(",")}
                                className="sr-only"
                                onChange={(event) =>
                                  handleOutputBatchFilesPicked(
                                    item.stamp,
                                    event,
                                  )
                                }
                              />

                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    batchFileInputRefs.current
                                      .get(item.stamp)
                                      ?.click()
                                  }
                                  className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-950 transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                                >
                                  Choose batch files
                                </button>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-slate-600">
                                <span>
                                  {batch.files.length
                                    ? `${batch.files.length} file${
                                        batch.files.length === 1 ? "" : "s"
                                      } selected`
                                    : "No batch files selected"}
                                </span>
                                {batch.running && (
                                  <span>
                                    Converting {batch.progress.done}/
                                    {batch.progress.total}
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {batch.zip ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      downloadOutputBatchZip(item)
                                    }
                                    className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                                  >
                                    Download ZIP
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void submitOutputBatchConvert(
                                        item.stamp,
                                      )
                                    }
                                    disabled={
                                      batch.running ||
                                      batch.files.length === 0
                                    }
                                    className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-[#1d4ed8] bg-[#2563eb] px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                                  >
                                    {batch.running
                                      ? "Converting batch..."
                                      : `Convert ${batch.files.length} to ZIP`}
                                  </button>
                                )}
                              </div>

                              {batch.error && (
                                <p className="m-0 mt-2 text-[13px] leading-5 text-red-700">
                                  {batch.error}
                                </p>
                              )}
                              {!batch.error && batch.info && (
                                <p className="m-0 mt-2 text-[13px] leading-5 text-slate-600">
                                  {batch.info}
                                </p>
                              )}
                                {batch.zip?.errors.length ? (
                                <details className="mt-2 text-[12px] text-slate-600">
                                  <summary className="cursor-pointer font-semibold text-slate-700">
                                    Show failed files
                                  </summary>
                                  <ul className="mt-1 list-disc pl-5">
                                    {batch.zip.errors
                                      .slice(0, 8)
                                      .map((message) => (
                                        <li key={message}>{message}</li>
                                      ))}
                                  </ul>
                                </details>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                    if (collapsed) {
                      return (
                        <div
                          key={item.stamp}
                          tabIndex={-1}
                          data-output-stamp={item.stamp}
                          data-focused-editor="false"
                          data-collapse-state="collapsed"
                          data-job-status={item.jobStatus || "succeeded"}
                          data-engine-used={item.engineUsed || "unknown"}
                          className="rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="m-0 truncate text-[13px] font-bold text-slate-800">
                                {displayName}
                              </p>
                              <p className="m-0 mt-0.5 text-[12px] text-slate-600">
                                {isActiveJob
                                  ? `${item.jobStatus === "queued" ? "Queued" : "Running"} - ${formatTraceJobElapsed(getTraceJobElapsedMs(item, jobNowMs))}`
                                  : isFailedJob
                                    ? item.jobStatus === "canceled"
                                      ? "Canceled"
                                      : "Failed"
                                    : `${item.width} x ${item.height} px`}
                                {item.engineUsed ? ` - ${item.engineUsed}` : ""}
                                {displaySvgBytes ? ` - ${prettyBytes(displaySvgBytes)}` : ""}
                                {hasOutputAppearanceChanges(appearance)
                                  ? " - appearance adjusted"
                                  : ""}
                                {item.sourceFileName ? (
                                  <>
                                    {" - "}
                                    <span
                                      data-output-source-file={item.sourceFileName}
                                      title={`Source: ${item.sourceFileName}`}
                                    >
                                      Source: {item.sourceFileName}
                                    </span>
                                  </>
                                ) : null}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {isActiveJob && item.canCancel && item.jobId && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    cancelOutputJob(item.jobId!, item.stamp)
                                  }
                                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                              )}
                              {isFailedJob && (
                                <button
                                  type="button"
                                  onClick={() => retryOutputJob(item.stamp)}
                                  className="cursor-pointer rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
                                >
                                  Retry
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleCollapsedOutput(item.stamp)}
                                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-100"
                              >
                                Restore
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                    <div
                      key={item.stamp}
                      tabIndex={-1}
                      data-output-stamp={item.stamp}
                      data-focused-editor={focused ? "true" : "false"}
                      data-collapse-state="expanded"
                      data-engine-used={item.engineUsed || "unknown"}
                      data-source-kind={item.sourceKind || "unknown"}
                      data-engine-warnings={(item.warnings || []).join(" | ")}
                      data-layer-build-mode={item.layerBuildMode || ""}
                      data-requested-palette-count={item.requestedPaletteCount ?? ""}
                      data-actual-palette-count={item.actualPaletteCount ?? ""}
                      data-output-detected-colors={item.outputDetectedColors ?? ""}
                      data-path-count={item.pathCount ?? ""}
                      data-svg-bytes={displaySvgBytes ?? ""}
                      className={[
                        "rounded-xl border border-slate-200 bg-white p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                        focused ? "shadow-xl" : "",
                        highlightedOutputStamp === item.stamp
                          ? "ring-2 ring-sky-300"
                          : "",
                      ].join(" ")}
                    >
                      {focused && (
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="m-0 text-sm font-bold text-sky-950">
                              Editing {displayName}
                            </p>
                            <p className="m-0 mt-0.5 text-[12px] text-slate-600">
                              {item.engineUsed ? `Engine: ${item.engineUsed}` : "Engine pending"}
                              {item.width > 0 && item.height > 0
                                ? ` - ${item.width} x ${item.height} px`
                                : ""}
                              {displaySvgBytes ? (
                                <>
                                  {" - "}
                                  <span data-output-file-size="true">
                                    {prettyBytes(displaySvgBytes)}
                                  </span>
                                </>
                              ) : null}
                              {item.sourceFileName ? (
                                <>
                                  {" - "}
                                  <span
                                    data-output-source-file={item.sourceFileName}
                                    title={`Source: ${item.sourceFileName}`}
                                  >
                                    Source: {item.sourceFileName}
                                  </span>
                                </>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (!item.svg) return;
                                const b = new Blob([previewData.svg], {
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
                              disabled={!item.svg}
                              className="cursor-pointer rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Download SVG
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!item.svg) return;
                                handleCopySvg(previewData.svg);
                              }}
                              disabled={!item.svg}
                              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Copy SVG
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (item.settingsOpen) toggleOutputSettings(item.stamp);
                                closeFocusedEditor(item.stamp);
                              }}
                              className="cursor-pointer rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-sky-950 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                            >
                              Done editing
                            </button>
                          </div>
                        </div>
                      )}
                      {!focused ? (
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="text-[13px] font-semibold text-slate-700">
                              {displayName}
                            </span>
                            <p className="m-0 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-600">
                              <span>
                                {item.width > 0 && item.height > 0
                                  ? `${item.width} x ${item.height} px`
                                  : "size unknown"}
                              </span>
                              {!isActiveJob && !isFailedJob && displaySvgBytes ? (
                                <span data-output-file-size="true">
                                  {prettyBytes(displaySvgBytes)}
                                </span>
                              ) : null}
                              {item.sourceFileName ? (
                                <span
                                  data-output-source-file={item.sourceFileName}
                                  title={`Source: ${item.sourceFileName}`}
                                  className="min-w-0 truncate"
                                >
                                  Source: {item.sourceFileName}
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCollapsedOutput(item.stamp)}
                            data-output-minimize-control="true"
                            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                          >
                            Minimize
                          </button>
                        </div>
                      ) : null}
                      {(isActiveJob || isFailedJob) && (
                        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="m-0 text-sm font-bold text-slate-900">
                                {isFailedJob ? "Conversion did not finish" : "Converting..."}
                              </p>
                              <p className="m-0 mt-1 text-[13px] leading-5 text-slate-600">
                                {item.presetLabel || "Custom settings"}
                                {item.sourceFileName ? ` from ${item.sourceFileName}` : ""}
                              </p>
                            </div>
                            <span
                              className={[
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-bold",
                                isFailedJob
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-sky-200 bg-sky-50 text-sky-800",
                              ].join(" ")}
                            >
                              {!isFailedJob && (
                                <span className="mr-1.5 inline-block h-3 w-3 rounded-full border-2 border-sky-300 border-t-sky-700 animate-spin" />
                              )}
                              {item.jobStatus === "failed"
                                ? "Failed"
                                : item.jobStatus === "canceled"
                                  ? "Canceled"
                                  : item.jobStatus === "queued"
                                    ? "Queued"
                                    : "Running"}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 text-[13px] text-slate-700 sm:grid-cols-2">
                            <div>
                              <span className="font-semibold text-slate-900">Elapsed</span>
                              <div>
                                {formatTraceJobElapsed(
                                  getTraceJobElapsedMs(item, jobNowMs),
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900">Engine path</span>
                              <div>{item.enginePathLabel || "Hybrid trace"}</div>
                            </div>
                          </div>
                          {item.jobError && (
                            <p className="m-0 mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-[13px] leading-5 text-red-700">
                              {item.jobError}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {isActiveJob && item.canCancel && item.jobId && (
                              <button
                                type="button"
                                onClick={() => cancelOutputJob(item.jobId!, item.stamp)}
                                className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                            )}
                            {isFailedJob && (
                              <button
                                type="button"
                                onClick={() => retryOutputJob(item.stamp)}
                                className="cursor-pointer rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
                              >
                                Retry
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {!focused && (
                      <div data-output-action-row="true" className="flex gap-2 flex-wrap my-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!item.svg) return;
                            const b = new Blob([previewData.svg], {
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
                          disabled={!item.svg}
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
                          onClick={() => {
                            if (!item.svg) return;
                            handleCopySvg(previewData.svg);
                          }}
                          disabled={!item.svg}
                          className="flex justify-center items-center px-3 py-2 rounded-lg font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                        >
                          <Icons
                            name="copy"
                            size={16}
                            className="inline-block mr-1"
                          />
                          Copy SVG
                        </button>
                        <button
                          type="button"
                          onClick={() => openOutputBatchSettings(item.stamp)}
                          disabled={!item.svg}
                          data-output-batch-shortcut="true"
                          aria-controls={`output-batch-${item.stamp}`}
                          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-950 transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Batch
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openFocusedEditor(item.stamp);
                          }}
                          disabled={!item.svg}
                          data-output-primary-action="true"
                          aria-expanded={focused || !!item.settingsOpen}
                          aria-controls={`output-settings-${item.stamp}`}
                          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-950 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                        >
                          <SettingsGearIcon />
                          <span className="ml-1">Settings / Edit</span>
                        </button>
                      </div>
                      )}

                      {item.updateError && (
                        <p className="m-0 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-5 text-red-700">
                          {item.updateError}
                        </p>
                      )}

                      {focused && (
                        <div
                          data-focused-editor-workspace="true"
                          className="mt-3 grid min-w-0 max-w-full gap-4 overflow-x-hidden lg:grid-cols-[minmax(0,1fr)_minmax(340px,430px)] lg:items-start"
                        >
                          <FocusedEditorPreviewComparison
                            outputSvg={previewData.svg}
                            outputAlt="SVG result"
                            originalPreviewUrl={
                              sourceAvailableForOutput ? previewUrl : null
                            }
                            toolbar={
                              <>
                                <PreviewHistoryArrowButton
                                  direction="left"
                                  disabled={!item.previousVersion}
                                  onClick={() =>
                                    stepOutputVersion(item.stamp, "back")
                                  }
                                />
                                <PreviewHistoryArrowButton
                                  direction="right"
                                  disabled={!item.nextVersion}
                                  onClick={() =>
                                    stepOutputVersion(item.stamp, "forward")
                                  }
                                />
                                <FullscreenPreviewButton
                                  onOpen={() => setFullscreenPreviewIndex(index)}
                                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                                />
                              </>
                            }
                          />
                          {settingsPanel}
                        </div>
                      )}

                      {!focused && item.settingsOpen && (
                        <div
                          id={`output-settings-${item.stamp}`}
                          className={[
                            "mb-2 rounded-xl border border-sky-200 bg-sky-50/70 p-2",
                            focused ? "lg:float-right lg:ml-3 lg:w-[380px] lg:max-w-[42%]" : "",
                          ].join(" ")}
                        >
                          <TraceAdvancedSettingsPanel
                            id={`output-settings-panel-${item.stamp}`}
                            open={true}
                            settings={outputSettings}
                            setSettings={(updater) =>
                              updateOutputDraftSettings(item.stamp, updater)
                            }
                            capabilities={routeCapabilities}
                            detectedColorItems={[item]}
                            sourceFile={sourceAvailableForOutput ? file : null}
                            removeColorsEnabled={
                              !(
                                sourceAvailableForOutput &&
                                file &&
                                (file.type === "image/svg+xml" ||
                                  /\.svg$/i.test(file.name || ""))
                              )
                            }
                            outputLayerItems={item.layers}
                            outputSize={{
                              width: item.width,
                              height: item.height,
                              originalWidth: item.originalWidth || item.width,
                              originalHeight: item.originalHeight || item.height,
                            }}
                            onOutputLayerChange={(layerId, patch) =>
                              setHistoryLayer(item.stamp, layerId, patch)
                            }
                            onResetOutputLayer={(layerId) =>
                              resetHistoryLayer(item.stamp, layerId)
                            }
                            onResetAllOutputLayers={() =>
                              resetAllHistoryLayers(item.stamp)
                            }
                            onOutputSizeChange={(size) =>
                              setHistorySize(item.stamp, size)
                            }
                            helpHref="#advanced-settings-help"
                            buttonDisabled={
                              buttonDisabled || isUpdating || !sourceAvailableForOutput
                            }
                            liveSectionTitle="Live preview edits"
                            liveSectionDescription="These settings edit this output card directly. Copy, download, and batch conversion use the current visible SVG."
                            livePreviewLead={
                              appearanceControls || item.layers?.length ? (
                                <div className="grid gap-2">
                                  {appearanceControls}
                                  {item.layers?.length ? (
                                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                                      <p className="m-0 mb-2 text-[13px] font-bold text-slate-900">
                                        Layer colors
                                      </p>
                                      <LayerPaletteEditor
                                        item={item}
                                        onColorChange={(layerId, color) =>
                                          setHistoryLayer(item.stamp, layerId, {
                                            color,
                                          })
                                        }
                                        onVisibilityChange={(layerId, visible) =>
                                          setHistoryLayer(item.stamp, layerId, {
                                            visible,
                                          })
                                        }
                                        onOpacityChange={(layerId, opacity) =>
                                          setHistoryLayer(item.stamp, layerId, {
                                            opacity,
                                          })
                                        }
                                        onResetLayer={(layerId) =>
                                          resetHistoryLayer(item.stamp, layerId)
                                        }
                                        onResetAll={() =>
                                          resetAllHistoryLayers(item.stamp)
                                        }
                                      />
                                    </div>
                                  ) : null}
                                </div>
                              ) : null
                            }
                            convertSectionTitle="Click to convert"
                            convertSectionDescription={
                              sourceAvailableForOutput
                                ? "These settings retrace the source image for this output only. Unapplied changes do not affect batch conversion."
                                : item.sourceFileName
                                  ? `Update preview needs the original source file (${item.sourceFileName}). Copy, download, and batch still use the saved SVG.`
                                  : "Choose the original source image to retrace this output. Copy, download, and batch still use the saved SVG."
                            }
                            hideOutputLayerStyling={true}
                            updatePreviewLabel={
                              isUpdating ? "Updating..." : "Update preview"
                            }
                            onUpdatePreview={() =>
                              void submitOutputUpdate(item.stamp)
                            }
                          />

                          <div className="mt-2 rounded-xl border border-slate-200 bg-white">
                            <button
                              type="button"
                              onClick={() => toggleOutputBatch(item.stamp)}
                              aria-expanded={!!item.batchOpen}
                              aria-controls={`output-batch-${item.stamp}`}
                              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                            >
                              <span>Batch conversion</span>
                              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[12px] font-semibold text-sky-800">
                                Max {batchDynamicMax}
                              </span>
                            </button>

                            {item.batchOpen && (
                              <div
                                id={`output-batch-${item.stamp}`}
                                className="border-t border-slate-100 px-3 py-3"
                              >
                                <p className="m-0 text-[13px] leading-5 text-slate-600">
                                  Batch uses this output's current applied SVG
                                  and trace settings. Changes in Click to
                                  convert apply only after Update preview.
                                </p>
                                <p className="m-0 mt-2 text-[12px] leading-5 text-slate-600">
                                  {batchDynamicMax === 100
                                    ? "This output allows up to 100 batch conversions because it uses the fastest applied settings."
                                    : "This output allows up to 20 batch conversions because these applied settings may take longer to process."}
                                </p>

                                <input
                                  ref={(node) => {
                                    if (node) {
                                      batchFileInputRefs.current.set(
                                        item.stamp,
                                        node,
                                      );
                                    } else {
                                      batchFileInputRefs.current.delete(
                                        item.stamp,
                                      );
                                    }
                                  }}
                                  type="file"
                                  multiple
                                  accept={Array.from(ALLOWED_EXTENSIONS)
                                    .map((ext) => `.${ext}`)
                                    .join(",")}
                                  className="sr-only"
                                  onChange={(event) =>
                                    handleOutputBatchFilesPicked(
                                      item.stamp,
                                      event,
                                    )
                                  }
                                />

                                <div className="mt-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      batchFileInputRefs.current
                                        .get(item.stamp)
                                        ?.click()
                                    }
                                    className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-950 transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                                  >
                                    Choose batch files
                                  </button>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-slate-600">
                                  <span>
                                    {batch.files.length
                                      ? `${batch.files.length} file${
                                          batch.files.length === 1 ? "" : "s"
                                        } selected`
                                      : "No batch files selected"}
                                  </span>
                                  {batch.running && (
                                    <span>
                                      Converting {batch.progress.done}/
                                      {batch.progress.total}
                                    </span>
                                  )}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {batch.zip ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        downloadOutputBatchZip(item)
                                      }
                                      className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                                    >
                                      Download ZIP
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void submitOutputBatchConvert(
                                          item.stamp,
                                        )
                                      }
                                      disabled={
                                        batch.running ||
                                        batch.files.length === 0
                                      }
                                      className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-[#1d4ed8] bg-[#2563eb] px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                      {batch.running
                                        ? "Converting batch..."
                                        : `Convert ${batch.files.length} to ZIP`}
                                    </button>
                                  )}
                                </div>

                                {batch.error && (
                                  <p className="m-0 mt-2 text-[13px] leading-5 text-red-700">
                                    {batch.error}
                                  </p>
                                )}
                                {!batch.error && batch.info && (
                                  <p className="m-0 mt-2 text-[13px] leading-5 text-slate-600">
                                    {batch.info}
                                  </p>
                                )}
                                {batch.zip?.errors.length ? (
                                  <details className="mt-2 text-[12px] text-slate-600">
                                    <summary className="cursor-pointer font-semibold text-slate-700">
                                      Show failed files
                                    </summary>
                                    <ul className="mt-1 list-disc pl-5">
                                      {batch.zip.errors
                                        .slice(0, 8)
                                        .map((message) => (
                                          <li key={message}>{message}</li>
                                        ))}
                                    </ul>
                                  </details>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {!focused && (
                      <div
                        className={[
                          "relative rounded-xl border border-slate-200 bg-white transparent-checkerboard flex items-center justify-center p-2",
                          focused
                            ? "min-h-[420px] lg:sticky lg:top-4"
                            : "min-h-[240px]",
                        ].join(" ")}
                      >
                        <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
                          <PreviewHistoryArrowButton
                            direction="left"
                            disabled={!item.previousVersion}
                            onClick={() => stepOutputVersion(item.stamp, "back")}
                          />
                          <PreviewHistoryArrowButton
                            direction="right"
                            disabled={!item.nextVersion}
                            onClick={() =>
                              stepOutputVersion(item.stamp, "forward")
                            }
                          />
                          <FullscreenPreviewButton
                            onOpen={() => setFullscreenPreviewIndex(index)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur cursor-pointer transition-colors hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                          />
                        </div>
                        <img
                          src={previewData.src}
                          alt="SVG result"
                          className="max-w-full h-auto"
                        />
                      </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center">
                  <div className="max-w-[21rem]">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-slate-100">
                      {busy ? (
                        <span className="inline-block h-5 w-5 rounded-full border-2 border-slate-300 border-t-white animate-spin" />
                      ) : (
                        <Icons name="success" size={22} />
                      )}
                    </div>
                    <p className="m-0 mt-3 text-sm font-bold text-slate-50">
                      {busy ? "Converting..." : "Converted files appear here"}
                    </p>
                    <p className="m-0 mt-1 text-[13px] leading-5 text-slate-200">
                      Upload an image and convert it to preview, copy, or
                      download your SVG.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {previewUrl && (
              <div className="order-3 hidden min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:col-start-1 md:row-start-2 md:flex">
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
          </section>
        </div>

        {/* Toast */}
        <FullscreenOutputPreview
          items={history}
          activeIndex={fullscreenPreviewIndex}
          setActiveIndex={setFullscreenPreviewIndex}
          getPreviewImage={(item, index) => {
            const previewData = getHistoryPreviewData(item);
            return {
              id: String(item.stamp),
              label: `Output ${index + 1}`,
              svg: previewData.svg,
              width: item.width,
              height: item.height,
              kind: "SVG",
            };
          }}
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
      <AdvancedSettingsHelpSection />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

function HomeWebsiteSchema() {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "iLoveSVG",
    alternateName: "i\uD83E\uDE75SVG",
    url: "https://www.ilovesvg.com",
    inLanguage: "en-US",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}

function applySvgSizeAttributes(svg: string, width: number, height: number): string {
  const safeWidth = Math.round(Number(width));
  const safeHeight = Math.round(Number(height));
  if (
    !Number.isFinite(safeWidth) ||
    !Number.isFinite(safeHeight) ||
    safeWidth <= 0 ||
    safeHeight <= 0
  ) {
    return svg;
  }

  return String(svg).replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
    const nextAttrs = String(attrs)
      .replace(/\swidth\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sheight\s*=\s*["'][^"']*["']/gi, "");
    return ensureSvgRootNamespace(
      `<svg${nextAttrs} width="${safeWidth}" height="${safeHeight}">`,
    );
  });
}

function getHistoryDisplayName(item: {
  name?: string;
  presetLabel?: string;
}): string {
  const name = item.name || "";
  if (!/Derived from Output/i.test(name)) return name;
  const prefix = name.match(/^Output\s+\d+/i)?.[0] || "Output";
  return `${prefix} · ${item.presetLabel || "Updated preview"}`;
}

async function readBatchConversionResponse(response: Response): Promise<ServerResult> {
  const rawText = await response.text();
  const trimmed = rawText.trim();
  if (!trimmed) {
    return response.ok
      ? {}
      : {
          error: `Server returned ${response.status} ${
            response.statusText || "without details"
          }.`.trim(),
        };
  }

  try {
    return JSON.parse(trimmed) as ServerResult;
  } catch {
    const summary = summarizeBatchResponseText(trimmed);
    const prefix = response.ok
      ? "Server returned an unreadable conversion response"
      : `Server returned ${response.status} ${response.statusText || "error"}`;
    return {
      error: summary ? `${prefix}: ${summary}` : `${prefix}.`,
    };
  }
}

function summarizeBatchResponseText(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function makeBatchZipEntryName(filename: string, index: number): string {
  const cleanBase =
    filename
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "converted";
  return `${String(index + 1).padStart(3, "0")}-${cleanBase}.svg`;
}

function buildBatchZipFilename(item: HistoryItem | null): string {
  const base =
    item?.presetLabel
      ?.replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 50) || "svg-batch";
  return `${base || "svg-batch"}-converted.zip`;
}

function hasLayerPatchChanges(
  layer: EditableSvgLayer,
  patch: Partial<Pick<EditableSvgLayer, "color" | "visible" | "opacity">>,
): boolean {
  if ("color" in patch && patch.color !== layer.color) return true;
  if ("visible" in patch && patch.visible !== layer.visible) return true;
  if ("opacity" in patch && patch.opacity !== layer.opacity) return true;
  return false;
}

function settingsEqual(a: Settings, b: Settings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ===== Client-side helpers (dimension precheck + compression ≤25MB) ===== */
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

async function validateBeforeSubmit(file: File, knownSize?: { w: number; h: number }) {
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
    const { w, h } = knownSize || (await getImageSize(file));
    if (!w || !h) return;
    if (w < MIN_TRACE_SIDE || h < MIN_TRACE_SIDE) {
      throw new Error(
        "Image is too small to trace safely. Please upload an image at least 2×2 pixels.",
      );
    }
    const mp = (w * h) / 1_000_000;
    if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
      throw new Error(
        `Image too large: ${w}×${h} (~${mp.toFixed(1)} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
      );
    }
  } catch (error: any) {
    if (
      error?.message?.startsWith("Image too large:") ||
      error?.message?.startsWith("Image is too small")
    ) {
      throw error;
    }
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
  try {
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
  } finally {
    if ("close" in img && typeof img.close === "function") {
      img.close();
    }
  }
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
function SettingsGearIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.1.35.33.66.66.85.26.15.55.23.85.24H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
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
  const [localValue, setLocalValue] = React.useState(String(value));

  React.useEffect(() => {
    const nextValue = String(value);
    setLocalValue((current) => (current === nextValue ? current : nextValue));
  }, [value]);

  function commit() {
    const next = Number(localValue);
    if (!Number.isFinite(next)) {
      setLocalValue(String(value));
      return;
    }

    const clamped = Math.max(min, Math.min(max, next));
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
          {/* Header / Hero */}
          <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                PNG/JPEG to SVG vectorizer
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-[800] tracking-[-0.03em] leading-tight text-sky-950">
                SVG Converter: Precise, fast, and built for creators
              </h2>
              <p className="text-[15px] leading-6 text-slate-700">
                VTracer-first raster-to-vector conversion with Potrace fallback
                for legacy line art, scans, diagrams, and compatibility cases.
                Clean, editable SVG output keeps layer metadata available for
                recoloring, hiding, copying, and downloading.
              </p>

              <p className="text-[15px] leading-6 text-slate-700">
                Convert your PNG, JPEG, JPG, and WEBP images into crisp vector
                graphics with route-aware presets, advanced trace controls,
                local output edits, browser-side tracing where safe, and
                protected server fallback when needed.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { k: "Clean SVG", v: "Editable paths, recolor anywhere" },
                  { k: "Preset workflow", v: "Line art, logo, scan, photo edge" },
                  { k: "Local edits", v: "Recolor, resize, hide layers" },
                  { k: "Private by default", v: "Browser-first when supported" },
                ].map((x) => (
                  <div
                    key={x.k}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
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
          <section>
            <h3 className="font-display text-xl font-[800] tracking-[-0.025em] text-sky-950">
              Best for
            </h3>
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
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="text-sm font-semibold">Lineart and ink</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Choose “Lineart - Accurate” for crisp strokes and clean fills.
                  Lower curve tolerance for detail, raise turd size to kill
                  dust.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="text-sm font-semibold">Logos and icons</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
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
              <h3
                itemProp="name"
                className="font-display text-xl font-[800] tracking-[-0.025em] text-sky-950"
              >
                How to convert an image to SVG
              </h3>
              <span className="text-xs text-slate-500">
                Fast path: upload → preset → tweak → export
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload a supported image",
                  body: "Drag and drop or use the picker. Oversized raster files may be compressed on your device before backend conversion when that can preserve a usable result.",
                },
                {
                  title: "Pick a preset that matches your art",
                  body: "Lineart for inks, Logo for clean shapes, Photo Edge for contour extraction.",
                },
                {
                  title: "Adjust settings",
                  body: "Tune threshold, curve tolerance, turd size, and turn policy. Advanced setting changes update locally until you click Convert or Update preview.",
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
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
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

          {/* Settings */}
          <section className="mt-12">
            <h3 className="font-display text-xl font-[800] tracking-[-0.025em] text-sky-950">
              Settings explained
            </h3>
            <p className="mt-2 max-w-[80ch] text-sm leading-6 text-slate-600">
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
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                >
                  <div className="text-sm font-semibold">{c.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Performance */}
          <section className="mt-12">
            <h3 className="font-display text-xl font-[800] tracking-[-0.025em] text-sky-950">
              Performance and limits
            </h3>

            <div className="mt-4 grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
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
                    <dt className="text-slate-500">Processing model</dt>
                    <dd className="mt-1 font-semibold">
                      Upload, preset, convert, then edit locally
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

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="text-sm font-semibold">Server stability</div>
                <p className="mt-2 text-sm text-slate-700">
                  This PNG to SVG conversion page only rate limits backend
                  raster tracing and server-side conversion work. Preview
                  rendering, copy, local download generation, and setting
                  changes that only update React state are not rate limited.
                </p>
                <p className="mt-3 text-sm text-slate-700">
                  Backend conversions allow up to 120 conversions per minute,
                  400 conversions every 5 minutes, 1500 conversions per hour,
                  and 3000 conversions per day for the same connection and
                  browser profile.
                </p>
              </div>
            </div>
          </section>

          {/* Troubleshooting */}
          <section className="mt-12">
            <h3 className="font-display text-xl font-[800] tracking-[-0.025em] text-sky-950">
              Troubleshooting and tips
            </h3>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {[
                ["Image too large", "Downscale or crop unused borders."],
                [
                  "Over 25 MB",
                  "We try to compress locally. If it fails, resize and re-upload.",
                ],
                [
                  "429 server busy",
                  "Backend conversion limit or concurrency protection. Wait for the Retry-After time, then try again.",
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
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                >
                  <div className="text-sm font-semibold">{t}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{d}</p>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <CurrentRouteGuide />

          <section
            className="mt-12"
            itemScope
            itemType="https://schema.org/FAQPage"
          >
            <h3 className="font-display text-xl font-[800] tracking-[-0.025em] text-sky-950">
              Frequently asked questions
            </h3>

            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "What file limits apply?",
                  a: "Supported image uploads are capped at 30 MB, about 30 MP, and 8000 px on the longest side. Larger raster files may be compressed on-device before conversion when possible.",
                },
                {
                  q: "Does this tool have usage limits?",
                  a: "Only backend conversion work is rate limited. Preview rendering, copy, local download generation, and setting changes that only update the current React state are not rate limited because they do not use server conversion compute. Backend conversions, such as raster image tracing, allow up to 120 conversions per minute, 400 conversions every 5 minutes, 1500 conversions per hour, and 3000 conversions per day for the same connection and browser profile.",
                },
                {
                  q: "What happens with files over 25 MB?",
                  a: "The app tries local compression first for oversized raster files. If the image cannot be reduced without too much quality loss, resize or crop it and upload again.",
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
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                >
                  <h4 itemProp="name" className="m-0 font-semibold">
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
