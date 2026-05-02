import * as React from "react";
import type { Route } from "./+types/image-to-layered-svg-for-cricut";
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
import { ChevronDownIcon, PresetPicker } from "~/client/components/converter/PresetSelector";
import { LayeredAdvancedSettingsPanel } from "~/client/components/converter/AdvancedSettingsPanel";
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
    "Image to Layered SVG for Cricut - Free Online Layered SVG Converter";
  const description =
    "Convert PNG and JPG images into layered SVG files for Cricut Design Space. Split artwork by color, adjust layer count, recolor individual layers, preview, and download a Cricut-ready layered SVG.";
  const canonical = "https://www.ilovesvg.com/image-to-layered-svg-for-cricut";

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
   Limits
======================== */
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_MP = 30;
const MAX_SIDE = 8000;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 450;
const LIVE_MED_MS = 1600;

const MIN_LAYER_COUNT = 2;
const MAX_LAYER_COUNT = 10;
const MAX_TRACE_SIDE_DEFAULT = 1600;

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
   Server concurrency gate
======================== */
type ReleaseFn = () => void;
type Gate = {
  acquireOrQueue: () => Promise<ReleaseFn>;
  running: number;
  queued: number;
};

async function getGate(): Promise<Gate> {
  const g = globalThis as any;
  if (g.__iheartsvg_layer_gate) return g.__iheartsvg_layer_gate as Gate;

  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);

  let cpuCount = 1;
  try {
    const os = req("os") as typeof import("os");
    cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 1;
  } catch {}

  const MAX = Math.max(1, Math.min(2, cpuCount));
  const QUEUE_MAX = 6;
  const EST_JOB_MS = 4500;

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
      return Math.min(20000, Math.max(1500, waves * EST_JOB_MS));
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

  g.__iheartsvg_layer_gate = new SimpleGate(MAX, QUEUE_MAX);
  return g.__iheartsvg_layer_gate as Gate;
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
            "Upload too large for live conversion. Please resize and try again.",
        },
        { status: 413 },
      );
    }

    const rateLimit = checkBackendConversionRateLimit(
      request,
      "image-to-layered-svg-for-cricut",
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

    const gate = await getGate();
    let release: ReleaseFn | null = null;

    try {
      release = await gate.acquireOrQueue();
    } catch (e: any) {
      const retryAfterMs = Math.max(1500, Number(e?.retryAfterMs) || 2500);

      return json(
        {
          error:
            "Server is busy converting other layered SVGs. Retrying automatically.",
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
      // @ts-ignore Buffer exists in Remix node runtime
      const input: Buffer = Buffer.from(ab);

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
        // Continue. Main conversion will fail cleanly if invalid.
      }

      const layerCount = clampInt(
        Number(form.get("layerCount") ?? 4),
        MIN_LAYER_COUNT,
        MAX_LAYER_COUNT,
      );

      const maxTraceSide = clampInt(
        Number(form.get("maxTraceSide") ?? MAX_TRACE_SIDE_DEFAULT),
        600,
        2400,
      );

      const minRegionPercent = clampNumber(
        Number(form.get("minRegionPercent") ?? 0.25),
        0,
        5,
      );

      const optTolerance = clampNumber(
        Number(form.get("optTolerance") ?? 0.35),
        0.05,
        1.2,
      );

      const turdSize = clampInt(Number(form.get("turdSize") ?? 3), 0, 20);

      const posterize =
        String(form.get("posterize") ?? "true").toLowerCase() === "true";

      const removeWhite =
        String(form.get("removeWhite") ?? "false").toLowerCase() === "true";

      const removeTransparent =
        String(form.get("removeTransparent") ?? "true").toLowerCase() ===
        "true";

      const transparent =
        String(form.get("transparent") ?? "true").toLowerCase() === "true";

      const bgColor = sanitizeHexColor(
        String(form.get("bgColor") ?? "#ffffff"),
        "#ffffff",
      );

      const turnPolicy = String(form.get("turnPolicy") ?? "minority") as
        | "black"
        | "white"
        | "left"
        | "right"
        | "minority"
        | "majority";

      const {
        readAdvancedTraceFormSettings,
        shouldRemoveSelectedColors,
      } = await import("../utils/converterSettings.server");
      const advancedTraceSettings = readAdvancedTraceFormSettings(form);

      const { createLayeredColorSvg } = await import(
        "../utils/svgLayerTrace.server"
      );
      const result = await createLayeredColorSvg(input, {
        layerCount,
        maxTraceSide,
        minRegionPercent,
        optTolerance,
        turdSize,
        posterize,
        removeWhite,
        removeTransparent,
        transparent,
        bgColor,
        turnPolicy,
        removeColors: shouldRemoveSelectedColors(advancedTraceSettings, "layered")
          ? advancedTraceSettings.removeColors
          : [],
        removeColorTolerance: advancedTraceSettings.removeColorTolerance,
        backgroundAlpha: advancedTraceSettings.backgroundAlpha,
        layerAlpha: advancedTraceSettings.layerAlpha,
        colorMergeTolerance: advancedTraceSettings.colorMergeTolerance,
        posterizeStrength: advancedTraceSettings.posterizeStrength,
        sortLayersBy: advancedTraceSettings.sortLayersBy,
        brightness: advancedTraceSettings.brightness,
        contrast: advancedTraceSettings.contrast,
        outputWidth: advancedTraceSettings.outputWidth,
        outputHeight: advancedTraceSettings.outputHeight,
        preserveAspectRatio: advancedTraceSettings.preserveAspectRatio,
      })

      return json({
        ...result,
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
      { error: safeErrorMessage(err?.message || "Server error during layered SVG conversion.", "Server error during layered SVG conversion.") },
      { status: 500 },
    );
  }
}

/* ========================
   Layered SVG engine
======================== */
type RGB = { r: number; g: number; b: number };

type LayeredOptions = {
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
};

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

type ServerLayer = EditableSvgLayer & {
  pixelPercent: number;
  pathTags: string;
};

async function rasterToLayeredSvg(
  input: Buffer,
  options: LayeredOptions,
): Promise<{
  svg: string;
  width: number;
  height: number;
  layers: ServerLayer[];
  palette: string[];
}> {
  throw new Error("Layered SVG tracing is handled by the server action.");
}

function collectPixels(
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

function assignAllPixelsToPalette(
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

function buildPalette(pixels: RGB[], requestedCount: number): RGB[] {
  const k = clampInt(requestedCount, MIN_LAYER_COUNT, MAX_LAYER_COUNT);

  const uniqueMap = new Map<string, RGB>();
  for (const p of pixels) {
    uniqueMap.set(`${p.r},${p.g},${p.b}`, p);
    if (uniqueMap.size >= 4096) break;
  }

  const unique = Array.from(uniqueMap.values());
  if (unique.length <= k) return unique;

  const centroids = seedCentroids(unique, k);

  for (let iter = 0; iter < 12; iter++) {
    const sums = centroids.map(() => ({
      r: 0,
      g: 0,
      b: 0,
      count: 0,
    }));

    for (const p of pixels) {
      const idx = nearestPaletteIndex(p, centroids);
      sums[idx].r += p.r;
      sums[idx].g += p.g;
      sums[idx].b += p.b;
      sums[idx].count++;
    }

    for (let i = 0; i < centroids.length; i++) {
      const s = sums[i];
      if (!s.count) continue;

      centroids[i] = {
        r: Math.round(s.r / s.count),
        g: Math.round(s.g / s.count),
        b: Math.round(s.b / s.count),
      };
    }
  }

  return dedupePalette(centroids).slice(0, k);
}

function seedCentroids(pixels: RGB[], k: number): RGB[] {
  const sorted = [...pixels].sort((a, b) => {
    const lumDiff = luminance(a) - luminance(b);
    if (Math.abs(lumDiff) > 1) return lumDiff;
    return a.r + a.g + a.b - (b.r + b.g + b.b);
  });

  const seeds: RGB[] = [];

  for (let i = 0; i < k; i++) {
    const idx = Math.round((i / Math.max(1, k - 1)) * (sorted.length - 1));
    seeds.push(sorted[idx]);
  }

  return dedupePalette(seeds);
}

function dedupePalette(palette: RGB[]): RGB[] {
  const seen = new Set<string>();
  const out: RGB[] = [];

  for (const p of palette) {
    const key = `${p.r},${p.g},${p.b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
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
  const { traceBitmapToSvg } = await import("~/utils/potraceCompat");
  const opts: any = {
    color: "#000000",
    threshold: 128,
    turdSize: options.turdSize,
    optTolerance: options.optTolerance,
    turnPolicy: options.turnPolicy,
    invert: false,
    blackOnWhite: true,
  };

  const svgRaw: string = await traceBitmapToSvg(maskPng, opts);

  return extractPathTags(svgRaw);
}

function extractPathTags(svg: string): string {
  const matches = svg.match(/<path\b[^>]*>/gi) || [];

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

function buildLayeredSvgString({
  width,
  height,
  layers,
  transparent,
  bgColor,
}: {
  width: number;
  height: number;
  layers: ServerLayer[];
  transparent: boolean;
  bgColor: string;
}) {
  const background = transparent
    ? ""
    : `<rect x="0" y="0" width="${width}" height="${height}" fill="${bgColor}" />`;

  const body = layers
    .map((layer, index) => {
      const fill = sanitizeHexColor(layer.color, "#000000");
      const safeId = escapeXmlAttr(layer.id || `layer-${index + 1}`);
      const safeLabel = escapeXmlAttr(layer.label || `Layer ${index + 1}`);

      return `<g id="${safeId}" data-layer-id="${safeId}" data-layer-label="${safeLabel}" data-layer-color="${fill}" fill="${fill}">${layer.pathTags}</g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Layered SVG for Cricut">${background}${body}</svg>`;
}

function maskHasInk(mask: Buffer) {
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < 250) return true;
  }

  return false;
}

function nearestPaletteIndex(color: RGB, palette: RGB[]) {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < palette.length; i++) {
    const d = colorDistance(color, palette[i]);

    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }

  return best;
}

function colorDistance(a: RGB, b: RGB) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;

  return dr * dr * 0.32 + dg * dg * 0.52 + db * db * 0.16;
}

function luminance(c: RGB) {
  return c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
}

function blendChannel(channel: number, alpha: number, bg: number) {
  return Math.round((channel * alpha + bg * (255 - alpha)) / 255);
}

function posterizeChannel(v: number) {
  return Math.round(v / 32) * 32;
}

function isNearWhite(c: RGB) {
  return c.r >= 244 && c.g >= 244 && c.b >= 244;
}

function rgbToHex(c: RGB) {
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

function toHex(n: number) {
  return clampInt(n, 0, 255).toString(16).padStart(2, "0");
}

function sanitizeHexColor(input: string, fallback: string) {
  const value = String(input || "").trim();

  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();

  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }

  return fallback;
}

function prettyBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function escapeXmlAttr(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clampNumber(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.round(Math.min(max, Math.max(min, n)));
}

/* ========================
   UI types
======================== */
type Settings = TraceAdvancedSettings & {
  layerCount: number;
  maxTraceSide: number;
  minRegionPercent: number;
  optTolerance: number;
  turdSize: number;
  turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  posterize: boolean;
  removeWhite: boolean;
  removeTransparent: boolean;
  transparent: boolean;
  bgColor: string;
};

type Preset = {
  id: string;
  label: string;
  settings: Partial<Settings>;
};

const DEFAULTS: Settings = {
  ...DEFAULT_TRACE_ADVANCED_SETTINGS,
  layerCount: 5,
  maxTraceSide: MAX_TRACE_SIDE_DEFAULT,
  minRegionPercent: 0.35,
  optTolerance: 0.45,
  turdSize: 4,
  turnPolicy: "majority",
  posterize: true,
  removeWhite: false,
  removeTransparent: true,
  transparent: true,
  bgColor: "#ffffff",
};

const routeCapabilities = getRouteCapabilities("image-to-layered-svg-for-cricut");

const PRESETS: Preset[] = [
  {
    id: "layered-color",
    label: "Layered color SVG",
    settings: {
      layerCount: 5,
      maxTraceSide: MAX_TRACE_SIDE_DEFAULT,
      minRegionPercent: 0.35,
      optTolerance: 0.45,
      turdSize: 4,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
    },
  },
  {
    id: "layered-color-smoother",
    label: "Layered color SVG - Smoother",
    settings: {
      layerCount: 4,
      maxTraceSide: 1200,
      minRegionPercent: 0.55,
      optTolerance: 0.65,
      turdSize: 7,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
    },
  },
  {
    id: "layered-color-detail",
    label: "Layered color SVG - More detail",
    settings: {
      layerCount: 8,
      maxTraceSide: 2000,
      minRegionPercent: 0.2,
      optTolerance: 0.32,
      turdSize: 2,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
    },
  },
  {
    id: "layered-color-fewer",
    label: "Layered color SVG - Fewer larger layers",
    settings: {
      layerCount: 3,
      maxTraceSide: 1200,
      minRegionPercent: 0.8,
      optTolerance: 0.75,
      turdSize: 9,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
    },
  },
  {
    id: "layered-basic",
    label: "Layered SVG - Balanced",
    settings: {
      layerCount: 4,
      minRegionPercent: 0.25,
      optTolerance: 0.35,
      turdSize: 3,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 1600,
    },
  },
  {
    id: "cricut-cut-clean",
    label: "Cricut Cut - Clean Layers",
    settings: {
      layerCount: 4,
      minRegionPercent: 0.6,
      optTolerance: 0.55,
      turdSize: 6,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1400,
    },
  },
  {
    id: "sticker-layers",
    label: "Sticker - Bold Color Blocks",
    settings: {
      layerCount: 5,
      minRegionPercent: 0.35,
      optTolerance: 0.45,
      turdSize: 4,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1600,
    },
  },
  {
    id: "vinyl-layers",
    label: "Vinyl - Fewer Pieces",
    settings: {
      layerCount: 3,
      minRegionPercent: 1,
      optTolerance: 0.7,
      turdSize: 8,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "black",
      maxTraceSide: 1200,
    },
  },
  {
    id: "htv-simple",
    label: "HTV - Simple Press Layers",
    settings: {
      layerCount: 3,
      minRegionPercent: 0.8,
      optTolerance: 0.65,
      turdSize: 7,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1200,
    },
  },
  {
    id: "paper-craft",
    label: "Paper Craft - Stacked Colors",
    settings: {
      layerCount: 5,
      minRegionPercent: 0.45,
      optTolerance: 0.5,
      turdSize: 5,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1400,
    },
  },
  {
    id: "cartoon-art",
    label: "Cartoon Art - More Colors",
    settings: {
      layerCount: 6,
      minRegionPercent: 0.2,
      optTolerance: 0.35,
      turdSize: 3,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 1800,
    },
  },
  {
    id: "clipart",
    label: "Clipart - Clean Color Areas",
    settings: {
      layerCount: 5,
      minRegionPercent: 0.25,
      optTolerance: 0.32,
      turdSize: 3,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 1800,
    },
  },
  {
    id: "logo-multicolor",
    label: "Logo - Multi-Color Trace",
    settings: {
      layerCount: 5,
      minRegionPercent: 0.2,
      optTolerance: 0.25,
      turdSize: 2,
      posterize: false,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 1800,
    },
  },
  {
    id: "flat-icon",
    label: "Icon - Flat Layers",
    settings: {
      layerCount: 4,
      minRegionPercent: 0.15,
      optTolerance: 0.22,
      turdSize: 2,
      posterize: false,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 1800,
    },
  },
  {
    id: "photo-posterized",
    label: "Photo - Posterized Layers",
    settings: {
      layerCount: 7,
      minRegionPercent: 0.4,
      optTolerance: 0.6,
      turdSize: 5,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1600,
    },
  },
  {
    id: "portrait-poster",
    label: "Portrait - Poster Style",
    settings: {
      layerCount: 6,
      minRegionPercent: 0.55,
      optTolerance: 0.75,
      turdSize: 7,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1400,
    },
  },
  {
    id: "low-detail-photo",
    label: "Photo - Low Detail Cut",
    settings: {
      layerCount: 4,
      minRegionPercent: 1.2,
      optTolerance: 0.9,
      turdSize: 10,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1000,
    },
  },
  {
    id: "simple-2-color",
    label: "2 Color - Simple Cut",
    settings: {
      layerCount: 2,
      minRegionPercent: 0.5,
      optTolerance: 0.45,
      turdSize: 5,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1400,
    },
  },
  {
    id: "three-color-decal",
    label: "3 Color - Decal",
    settings: {
      layerCount: 3,
      minRegionPercent: 0.45,
      optTolerance: 0.5,
      turdSize: 5,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1400,
    },
  },
  {
    id: "shadow-layer",
    label: "Shadow Layer - Bold Shapes",
    settings: {
      layerCount: 3,
      minRegionPercent: 1,
      optTolerance: 0.8,
      turdSize: 8,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "black",
      maxTraceSide: 1200,
    },
  },
  {
    id: "small-business-logo",
    label: "Small Business Logo",
    settings: {
      layerCount: 6,
      minRegionPercent: 0.15,
      optTolerance: 0.28,
      turdSize: 2,
      posterize: false,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 2000,
    },
  },
  {
    id: "kids-illustration",
    label: "Kids Illustration - Bright Layers",
    settings: {
      layerCount: 8,
      minRegionPercent: 0.25,
      optTolerance: 0.45,
      turdSize: 4,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1600,
    },
  },
  {
    id: "sublimation-preview",
    label: "Sublimation Preview - Color Trace",
    settings: {
      layerCount: 8,
      minRegionPercent: 0.15,
      optTolerance: 0.4,
      turdSize: 3,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: false,
      bgColor: "#ffffff",
      turnPolicy: "minority",
      maxTraceSide: 1800,
    },
  },
  {
    id: "print-then-cut",
    label: "Print Then Cut - Simplified",
    settings: {
      layerCount: 7,
      minRegionPercent: 0.3,
      optTolerance: 0.45,
      turdSize: 4,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1600,
    },
  },
];

type ServerResult = {
  svg?: string;
  error?: string;
  width?: number;
  height?: number;
  retryAfterMs?: number;
  code?: string;
  gate?: { running: number; queued: number };
  layers?: ServerLayer[];
  palette?: string[];
};

type LayerState = EditableSvgLayer & {
  pixelPercent: number;
  pathTags?: string;
};

type HistoryItem = {
  svg: string;
  width: number;
  height: number;
  stamp: number;
  layers: LayerState[];
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
    return "Large file; updates run less frequently to keep things smooth.";
  return "";
}

/* ========================
   Page
======================== */
export default function ImageToLayeredSvgForCricut({
  loaderData,
}: Route.ComponentProps) {
  const fetcher = useFetcher<ServerResult>();

  const [file, setFile] = React.useState<File | null>(null);
  const [originalFileSize, setOriginalFileSize] = React.useState<number | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] =
    React.useState<string>("layered-color");

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

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressLiveRef = React.useRef(false);
  const retryRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmitRef = React.useRef<{
    file: File;
    settings: Settings;
  } | null>(null);

  const busy = fetcher.state !== "idle";

  React.useEffect(() => setHydrated(true), []);

  React.useEffect(() => {
    if (!fetcher.data?.svg || !fetcher.data.layers?.length) return;

    const item: HistoryItem = {
      svg: fetcher.data.svg,
      width: fetcher.data.width ?? 0,
      height: fetcher.data.height ?? 0,
      stamp: Date.now(),
      layers: fetcher.data.layers.map((layer, index) => ({
        id: layer.id,
        label: layer.label || `Layer ${index + 1}`,
        color: layer.color,
        originalColor: layer.originalColor || layer.color,
        visible: layer.visible !== false,
        kind: layer.kind || "fill",
        pixelPercent: layer.pixelPercent,
        pathTags: layer.pathTags,
      })),
    };

    setHistory((prev) => [item, ...prev].slice(0, 10));
    setInfo(null);
  }, [fetcher.data?.svg, fetcher.data?.width, fetcher.data?.height]);

  React.useEffect(() => {
    if (!fetcher.data?.error) return;

    if (fetcher.data.code === "BUSY" && lastSubmitRef.current) {
      const retryAfterMs = Math.max(1500, fetcher.data.retryAfterMs ?? 2500);
      const retryPayload = lastSubmitRef.current;
      setInfo("Server is busy. Retrying automatically.");

      if (retryRef.current) clearTimeout(retryRef.current);

      retryRef.current = setTimeout(() => {
        submitConvert(retryPayload.file, retryPayload.settings);
      }, retryAfterMs);

      return;
    }

    setErr(fetcher.data.error);
  }, [fetcher.data?.error, fetcher.data?.code, fetcher.data?.retryAfterMs]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
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

    suppressLiveRef.current = true;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryRef.current) clearTimeout(retryRef.current);

    setFile(null);

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPreviewUrl(null);
    setSettings(DEFAULTS);
    setActivePreset("layered-color");
    setHistory([]);
    setErr(null);
    setInfo(null);
    setDims(null);
    setOriginalFileSize(f.size);
    lastSubmitRef.current = null;

    let chosen = f;

    try {
      if (f.size > LIVE_MED_MAX) {
        setInfo("Compressing large image locally for live layered preview.");
        chosen = await compressToTarget25MB(f);
      }

      await validateBeforeSubmit(chosen);
    } catch (e: any) {
      suppressLiveRef.current = false;
      setInfo(null);
      setErr(e?.message || "Image is too large.");
      return;
    }

    setFile(chosen);
    setAutoMode(getAutoMode(chosen.size));

    const url = URL.createObjectURL(chosen);
    setPreviewUrl(url);

    await measureAndSet(chosen);

    suppressLiveRef.current = false;

    setTimeout(() => {
      submitConvert(chosen, DEFAULTS);
    }, 0);
  }

  async function submitConvert(
    fileOverride?: File | null,
    settingsOverride?: Settings,
  ) {
    const sourceFile = fileOverride ?? file;
    const sourceSettings = settingsOverride ?? settings;

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

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    lastSubmitRef.current = {
      file: sourceFile,
      settings: sourceSettings,
    };

    const fd = new FormData();
    fd.append("file", sourceFile);
    fd.append("layerCount", String(sourceSettings.layerCount));
    fd.append("maxTraceSide", String(sourceSettings.maxTraceSide));
    fd.append("minRegionPercent", String(sourceSettings.minRegionPercent));
    fd.append("optTolerance", String(sourceSettings.optTolerance));
    fd.append("turdSize", String(sourceSettings.turdSize));
    fd.append("turnPolicy", sourceSettings.turnPolicy);
    fd.append("posterize", String(sourceSettings.posterize));
    fd.append("removeWhite", String(sourceSettings.removeWhite));
    fd.append("removeTransparent", String(sourceSettings.removeTransparent));
    fd.append("transparent", String(sourceSettings.transparent));
    fd.append("bgColor", sourceSettings.bgColor);
    appendAdvancedTraceSettings(fd, sourceSettings);

    setErr(null);

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action:
        typeof window === "undefined"
          ? "?index"
          : `${window.location.pathname}?index`,
    });
  }

  function applyPreset(preset: Preset) {
    const nextSettings: Settings = {
      ...DEFAULTS,
      ...preset.settings,
    };

    setActivePreset(preset.id);
    setSettings(nextSettings);

    if (file) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
      submitConvert(file, nextSettings);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  function handleCopySvg(svg: string) {
    navigator.clipboard.writeText(svg).then(() => {
      showToast("Layered SVG copied");
    });
  }

  function updateHistoryItemLayers(
    stamp: number,
    updater: (layers: LayerState[]) => LayerState[],
  ) {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp === stamp
          ? {
              ...item,
              layers: updater(item.layers),
            }
          : item,
      ),
    );
  }

  const buttonDisabled = isServer || !hydrated || busy || !file;

  return (
    <>
      <main className="bg-slate-50 text-slate-900">
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
                Image to Layered SVG for Cricut
              </h1>

              <p className="mb-3 text-center text-sm text-slate-600">
                Split a PNG or JPG into color-based SVG layers for Cricut Design
                Space. Each result appears in the preview area just like the
                main converter.
              </p>

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
                    Advanced layered SVG settings
                  </span>
                  <ChevronDownIcon open={showAdvanced} />
                </button>

                {showAdvanced && (
                  <LayeredAdvancedSettingsPanel
                    id="advanced-settings"
                    open={showAdvanced}
                    settings={settings}
                    setSettings={setSettings}
                    capabilities={routeCapabilities}
                    detectedColorItems={history}
                    sourceFile={file}
                    removeColorsEnabled={!(file && (file.type === "image/svg+xml" || /\.svg$/i.test(file.name || "")))}
                    buttonDisabled={buttonDisabled}
                    onUpdatePreview={() => void submitConvert(file, settings)}
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
                        if (debounceRef.current) {
                          clearTimeout(debounceRef.current);
                        }
                        if (retryRef.current) clearTimeout(retryRef.current);
                        setFile(null);
                        setPreviewUrl(null);
                        setAutoMode("off");
                        setDims(null);
                        setErr(null);
                        setInfo(null);
                        setOriginalFileSize(null);
                        lastSubmitRef.current = null;
                        setHistory([]);
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
                  onClick={() => submitConvert(file, settings)}
                  disabled={buttonDisabled}
                  suppressHydrationWarning
                  className={[
                    "flex items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors",
                    "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0]",
                    "disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer",
                  ].join(" ")}
                >
                  <Icons
                    name="convert"
                    size={18}
                    className="mr-1"
                    title="Convert"
                  />
                  {busy ? "Building layers…" : "Convert to Layered SVG"}
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

              {/* Input preview below controls, same pattern as homepage */}
              {previewUrl && (
                <div className="hidden md:flex flex-col mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <p className="text-slate-700 ml-2 mt-1">
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

            {/* RESULTS, same behavior pattern as homepage */}
            <div className="bg-slate-600 border border-slate-200 rounded-xl p-4 h-full max-h-[124.25em] overflow-auto shadow-sm min-w-0">
              {busy && (
                <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
              )}

              {history.length > 0 ? (
                <div className="grid gap-3">
                  {history.map((item) => {
                    const editedSvg = getHistoryItemSvg(item);

                    return (
                      <div
                        key={item.stamp}
                        className="rounded-xl border border-slate-200 bg-white p-2"
                      >
                        <div className="flex gap-3 items-center flex-wrap justify-between">
                          <span className="text-[13px] text-slate-700">
                            {item.width > 0 && item.height > 0
                              ? `${item.width} × ${item.height} px`
                              : "size unknown"}{" "}
                            • {item.layers.length} layers
                          </span>
                        </div>

                        <div className="flex gap-2 flex-wrap my-2">
                          <button
                            type="button"
                            onClick={() => {
                              const b = new Blob([editedSvg], {
                                type: "image/svg+xml;charset=utf-8",
                              });
                              const u = URL.createObjectURL(b);
                              const a = document.createElement("a");
                              a.href = u;
                              a.download =
                                "image-to-layered-svg-for-cricut.svg";
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
                            Download Layered SVG
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopySvg(editedSvg)}
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

                        <LayerControls
                          layers={item.layers}
                          onChange={(nextLayers) =>
                            updateHistoryItemLayers(
                              item.stamp,
                              () => nextLayers,
                            )
                          }
                          onLayerChange={(layerId, patch) =>
                            updateHistoryItemLayers(item.stamp, (layers) =>
                              layers.map((layer) =>
                                layer.id === layerId
                                  ? { ...layer, ...patch }
                                  : layer,
                              ),
                            )
                          }
                          onReset={() =>
                            updateHistoryItemLayers(item.stamp, (layers) =>
                              layers.map((layer) => ({
                                ...layer,
                                color: layer.originalColor,
                                visible: true,
                              })),
                            )
                          }
                        />

                        <div className="rounded-xl border border-slate-200 bg-white transparent-checkerboard min-h-[240px] flex items-center justify-center p-2">
                          <img
                            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                              editedSvg,
                            )}`}
                            alt="Layered SVG result"
                            className="max-w-full h-auto"
                          />
                        </div>
                      </div>
                    );
                  })}
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
                    ? "Building layered SVG…"
                    : "Layered SVG files appear here..."}
                </p>
              )}
            </div>
          </section>
        </div>

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
      `Image too large: ${w}×${h} (~${mp.toFixed(
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

function getHistoryItemSvg(item: HistoryItem): string {
  if (!item.layers?.length) return item.svg;
  return applyLayerEditsToSvg(item.svg, item.layers);
}

function applyLayerEditsToSvg(svg: string, layers: LayerState[]): string {
  let out = String(svg || "");

  for (const layer of layers) {
    const id = escapeRegExp(layer.id);
    const color = sanitizeHexColor(layer.color, layer.originalColor || "#000000");
    const visible = layer.visible !== false;
    const kind = layer.kind || "fill";

    out = out.replace(
      new RegExp(`(<g\\b(?=[^>]*\\bdata-layer-id=["']${id}["'])([^>]*)>)([\\s\\S]*?)(<\\/g>)`, "gi"),
      (_match, _openTag, attrs, inner, closeTag) => {
        let nextAttrs = String(attrs);
        nextAttrs = setOrRemoveSvgAttr(nextAttrs, "data-layer-color", color);
        nextAttrs = setOrRemoveSvgAttr(nextAttrs, kind === "stroke" ? "stroke" : "fill", color);
        nextAttrs = setOrRemoveSvgAttr(nextAttrs, "display", visible ? null : "none");
        nextAttrs = setOrRemoveSvgAttr(nextAttrs, "data-layer-editor-hidden", visible ? null : "true");

        let nextInner = String(inner);
        nextInner = kind === "stroke" ? stripPaintAttrs(nextInner, "stroke") : stripPaintAttrs(nextInner, "fill");

        return `<g${nextAttrs}>${nextInner}${closeTag}`;
      },
    );

    out = out.replace(
      new RegExp(`(<(?!g\\b)([a-zA-Z][\\w:-]*)\\b(?=[^>]*\\bdata-fill-layer-id=["']${id}["'])([^>]*?)(\\/?>))`, "gi"),
      (match, _whole, tagName, attrs) => {
        const full = String(match);
        const selfClose = /\/\s*>$/.test(full);
        let nextAttrs = String(attrs);
        nextAttrs = setOrRemoveSvgAttr(nextAttrs, "fill", color);
        nextAttrs = setOrRemoveSvgAttr(nextAttrs, "display", visible ? null : "none");
        nextAttrs = setOrRemoveSvgAttr(nextAttrs, "data-layer-editor-hidden", visible ? null : "true");
        return `<${tagName}${nextAttrs}${selfClose ? " />" : ">"}`;
      },
    );

    out = out.replace(
      new RegExp(`(<(?!g\\b)([a-zA-Z][\\w:-]*)\\b(?=[^>]*\\bdata-stroke-layer-id=["']${id}["'])([^>]*?)(\\/?>))`, "gi"),
      (match, _whole, tagName, attrs) => {
        const full = String(match);
        const selfClose = /\/\s*>$/.test(full);
        let nextAttrs = String(attrs);
        nextAttrs = setOrRemoveSvgAttr(nextAttrs, "stroke", color);
        nextAttrs = setOrRemoveSvgAttr(nextAttrs, "display", visible ? null : "none");
        nextAttrs = setOrRemoveSvgAttr(nextAttrs, "data-layer-editor-hidden", visible ? null : "true");
        return `<${tagName}${nextAttrs}${selfClose ? " />" : ">"}`;
      },
    );
  }

  return out;
}

function stripPaintAttrs(markup: string, attrName: "fill" | "stroke") {
  const attrPattern = new RegExp(`\\s${attrName}\\s*=\\s*(["'])(.*?)\\1`, "gi");

  return markup.replace(/<([a-zA-Z][\w:-]*)\b([^>]*?)>/g, (tag, tagName, attrs) => {
    if (/^(svg|defs|style|title|desc|metadata|linearGradient|radialGradient|pattern|clipPath|mask|filter|marker|symbol|use|image|foreignObject|stop)$/i.test(tagName)) {
      return tag;
    }

    const selfClose = /\/\s*>$/.test(tag);
    const cleanedAttrs = String(attrs)
      .replace(attrPattern, "")
      .replace(/\s*\/\s*$/, "");
    return `<${tagName}${cleanedAttrs}${selfClose ? " />" : ">"}`;
  });
}

function setOrRemoveSvgAttr(attrs: string, name: string, value: string | null) {
  const pattern = new RegExp(`\\s${escapeRegExp(name)}\\s*=\\s*(["'])(.*?)\\1`, "i");
  const next = String(attrs || "");

  if (value == null) {
    if (name === "display" && !/\sdata-layer-editor-hidden\s*=\s*(["'])true\1/i.test(next)) {
      return next;
    }
    return next.replace(pattern, "");
  }

  const escaped = escapeXmlAttr(value);

  if (pattern.test(next)) {
    return next.replace(pattern, ` ${name}="${escaped}"`);
  }

  return `${next} ${name}="${escaped}"`;
}

function escapeRegExp(value: string) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const [draft, setDraft] = React.useState(String(value));

  React.useEffect(() => {
    setDraft((current) => (current === String(value) ? current : String(value)));
  }, [value]);

  function commitDraft() {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft((current) => (current === String(value) ? current : String(value)));
      return;
    }

    const next = clampNumber(parsed, min, max);
    setDraft((current) => (current === String(next) ? current : String(next)));
    if (next !== value) onChange(next);
  }

  return (
    <input
      type="number"
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitDraft}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commitDraft();
          e.currentTarget.blur();
        }
      }}
      className="w-[110px] px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 hover:bg-slate-50"
    />
  );
}

function LayerControls({
  layers,
  onChange,
  onLayerChange,
  onReset,
}: {
  layers: LayerState[];
  onChange: (layers: LayerState[]) => void;
  onLayerChange: (layerId: string, patch: Partial<LayerState>) => void;
  onReset: () => void;
}) {
  void onChange;

  return (
    <div className="my-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-sky-950 m-0">Edit SVG layers</h2>

        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          Reset layers
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        {layers.map((layer, index) => (
          <LayerControlRow
            key={layer.id}
            layer={layer}
            index={index}
            onLayerChange={onLayerChange}
          />
        ))}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        These edits update this specific result. Hide small unwanted layers or
        recolor each color group before downloading.
      </p>
    </div>
  );
}

function LayerControlRow({
  layer,
  index,
  onLayerChange,
}: {
  layer: LayerState;
  index: number;
  onLayerChange: (layerId: string, patch: Partial<LayerState>) => void;
}) {
  const COLOR_COMMIT_THROTTLE_MS = 110;
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

    if (color !== layer.color) {
      onLayerChange(layer.id, { color });
    }
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

  function resetLayer() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    latestColorRef.current = layer.originalColor;
    setLocalColor((current) => (current === layer.originalColor ? current : layer.originalColor));
    onLayerChange(layer.id, {
      color: layer.originalColor,
      visible: true,
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={layer.visible}
          onChange={(e) =>
            onLayerChange(layer.id, { visible: e.target.checked })
          }
          className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
          title="Show or hide layer"
        />

        <input
          type="color"
          value={localColor}
          onChange={(e) => queueColorCommit(e.target.value)}
          onPointerUp={() => commitColorNow()}
          onMouseUp={() => commitColorNow()}
          onTouchEnd={() => commitColorNow()}
          onBlur={() => commitColorNow()}
          className="w-10 h-8 rounded-md border border-slate-200 bg-white cursor-pointer"
          title="Change layer color"
        />

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-800">
            {layer.label || `Layer ${index + 1}`}
          </div>
          <div className="text-xs text-slate-500">
            Original {layer.originalColor.toUpperCase()} • current {localColor.toUpperCase()} • {layer.pixelPercent}% of traced pixels
          </div>
        </div>

        <button
          type="button"
          onClick={resetLayer}
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/* ========================
   SEO sections
======================== */
function SeoSections() {
  const faqs = [
    {
      q: "What is a layered SVG for Cricut?",
      a: "A layered SVG separates artwork into multiple color-based vector groups. In Cricut Design Space, those groups can be recolored, cut from different materials, or handled separately.",
    },
    {
      q: "Can this convert a PNG into a layered SVG?",
      a: "Yes. Upload a PNG or JPG, choose how many color layers you want, preview the traced layers, then download the SVG.",
    },
    {
      q: "Does this create true separate layers?",
      a: "Yes. The converter traces each color group as its own SVG group. You can recolor or hide layers before downloading.",
    },
    {
      q: "Why are there tiny unwanted layers?",
      a: "Small color fragments usually come from photo noise, shadows, anti-aliasing, or compression artifacts. Increase minimum layer size, raise speckle removal, or use fewer layers.",
    },
    {
      q: "What layer count should I use for Cricut?",
      a: "Start with 3 to 5 layers. Use fewer layers for vinyl and easier weeding. Use more layers for stickers, cartoon art, and multi-color paper crafts.",
    },
    {
      q: "Should I remove the white background?",
      a: "Enable white background removal when the white area is just paper or canvas. Leave it off if white is an actual part of the design.",
    },
    {
      q: "Can I edit each layer color?",
      a: "Yes. After conversion, each detected layer has its own color picker and visibility toggle. The downloaded SVG uses your edited layer colors.",
    },
    {
      q: "Is this good for photos?",
      a: "It can make posterized photo-style layers, but Cricut cuts work best with simplified artwork, clean logos, stickers, cartoons, and high-contrast images.",
    },
    {
      q: "Are layered SVG conversions rate limited?",
      a: "Only backend layered SVG conversions are rate limited: up to 120 conversions per minute, 400 per five minutes, 1,500 per hour, and 3,000 per day from the same connection and browser profile. Local downloads, copy actions, and layer color edits are not rate limited.",
    },
  ];

  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-8 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 md:p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                PNG/JPEG to layered Cricut SVG
              </p>

              <h2 className="text-2xl md:text-3xl font-bold leading-tight text-sky-950">
                Convert images into layered SVG files for Cricut Design Space
              </h2>

              <p className="text-slate-600">
                This tool turns flat raster images into color-separated SVG
                layers. It is built for Cricut users who need more than a basic
                black-and-white trace: multi-color decals, sticker art, paper
                crafts, simple logos, cartoon artwork, and vinyl projects with
                separate cut layers.
              </p>

              <p className="text-slate-600">
                Upload a PNG or JPG, choose how many layers to extract, remove
                unwanted white or transparent background areas, tune cleanup,
                then recolor or hide individual layers before downloading the
                final SVG.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    k: "Color layers",
                    v: "Split artwork into separate SVG groups",
                  },
                  {
                    k: "Layer editing",
                    v: "Recolor or hide each layer before export",
                  },
                  {
                    k: "Cricut-focused",
                    v: "Presets for vinyl, stickers, logos, and cuts",
                  },
                  {
                    k: "Cleaner output",
                    v: "Control speckles, small regions, and smoothing",
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

          <section className="mt-8">
            <h3 className="text-lg font-bold text-sky-950">
              Best uses for this layered SVG converter
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Layered Cricut designs",
                "Vinyl decals",
                "HTV designs",
                "Sticker artwork",
                "Multi-color logos",
                "Paper crafts",
                "Shadow layers",
                "Color-separated SVGs",
                "Simple clipart",
                "Print then cut prep",
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
                  For vinyl and cut projects
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Use fewer layers, higher speckle removal, and a larger minimum
                  layer size. This keeps the SVG cleaner and reduces tiny pieces
                  that are hard to cut or weed.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold">
                  For stickers and colorful artwork
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Use 5 to 8 layers when you want more color separation. Then
                  recolor the detected layers before downloading the SVG.
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
                How to convert an image to layered SVG for Cricut
              </h3>
              <span className="text-xs text-slate-500">
                Upload → choose layer preset → edit colors → download
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload a PNG or JPG",
                  body: "Use a clean image with clear colors. Logos, stickers, cartoons, and simple art produce better layers than noisy photos.",
                },
                {
                  title: "Choose a layered SVG preset",
                  body: "Use cleaner cut presets for vinyl, more-color presets for stickers, and logo presets for cleaner multi-color artwork.",
                },
                {
                  title: "Set the number of layers",
                  body: "Start with 3 to 5 layers. More layers can capture more color, but may create more Cricut pieces.",
                },
                {
                  title: "Clean up small fragments",
                  body: "Increase minimum layer size or speckle removal if the SVG has tiny unwanted pieces.",
                },
                {
                  title: "Recolor or hide layers",
                  body: "Use the layer controls inside each result card to change SVG group colors or hide unwanted layers.",
                },
                {
                  title: "Download the layered SVG",
                  body: "Upload the SVG into Cricut Design Space and handle each color layer separately for your project.",
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
              Which layered SVG preset should you use?
            </h3>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Layered SVG - Balanced",
                  body: "Best first try for most images. It gives a practical layer count without being too aggressive.",
                },
                {
                  title: "Cricut Cut - Clean Layers",
                  body: "Best for cut projects where tiny fragments are a problem. It removes white background and simplifies the result.",
                },
                {
                  title: "Vinyl - Fewer Pieces",
                  body: "Best for simpler vinyl designs. It reduces layer count and filters out small regions.",
                },
                {
                  title: "HTV - Simple Press Layers",
                  body: "Best for heat transfer vinyl where you want fewer stacked pieces and cleaner color separation.",
                },
                {
                  title: "Sticker - Bold Color Blocks",
                  body: "Best for sticker-style artwork where clear color regions matter more than exact photo detail.",
                },
                {
                  title: "Logo - Multi-Color Trace",
                  body: "Best for clean logos and icons where color edges are already sharp.",
                },
                {
                  title: "Photo - Posterized Layers",
                  body: "Best for stylized results from photos. Expect cleanup because photos usually create more fragments.",
                },
                {
                  title: "2 Color - Simple Cut",
                  body: "Best when you only need a foreground and background-style separation.",
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
              Layered SVG settings explained
            </h3>

            <p className="mt-2 text-sm text-slate-600 max-w-[80ch]">
              Layered SVG conversion is different from regular tracing. The
              converter first reduces the image into color groups, then traces
              each color group as its own SVG layer.
            </p>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Layer count",
                  body: "Controls how many color groups the image is reduced into. More layers can look closer to the original but may be harder to cut.",
                },
                {
                  title: "Minimum layer size",
                  body: "Filters out tiny color regions. Raise it when Cricut creates small unwanted pieces.",
                },
                {
                  title: "Posterize colors",
                  body: "Simplifies similar colors before tracing. Keep it on for most Cricut projects.",
                },
                {
                  title: "Remove white background",
                  body: "Removes near-white areas before layer tracing. Use it when the white area is just paper or canvas.",
                },
                {
                  title: "Speckle removal",
                  body: "Removes tiny traced islands inside each layer. Higher values make cleaner cut files.",
                },
                {
                  title: "Curve tolerance",
                  body: "Higher values smooth curves and reduce nodes. Lower values preserve more detail.",
                },
                {
                  title: "Trace detail size",
                  body: "Controls internal conversion size. Higher detail can improve edges but takes longer and may create larger SVGs.",
                },
                {
                  title: "Layer color controls",
                  body: "After conversion, every result includes layer controls so you can recolor or hide specific layers.",
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
            <h3 className="text-lg font-bold text-sky-950">
              How this layered SVG converter works
            </h3>

            <div className="mt-3 grid md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-sm">
                  1. The image is simplified into colors
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  The converter samples the raster image, reduces it into a
                  smaller palette, and removes background pixels when requested.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-sm">
                  2. Each color becomes a mask
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Every color group is isolated as its own black-and-white mask
                  so it can be traced separately.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-sm">
                  3. Masks become SVG groups
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Each traced color is exported as its own SVG group, making the
                  final file easier to recolor, hide, cut, or edit.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-bold text-sky-950">
              Backend conversion limits
            </h3>
            <p className="mt-2 text-sm text-slate-600 max-w-[80ch]">
              This image to layered SVG for Cricut conversion page only limits
              server-side layered SVG conversions. Upload tracing and image
              processing can use backend compute, so those conversion requests
              are limited to 120 per minute, 400 per five minutes, 1,500 per
              hour, and 3,000 per day from the same connection and browser
              profile. Browser-only actions like recoloring layers, toggling
              layer visibility, copying SVG output, and downloading the current
              result do not count against those backend conversion limits.
            </p>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold text-sky-950">
              Tips for cleaner Cricut layered SVGs
            </h3>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Use clean artwork when possible",
                  body: "Flat-color logos and illustrations convert better than noisy photos or low-quality screenshots.",
                },
                {
                  title: "Use fewer layers for vinyl",
                  body: "Vinyl projects are easier with fewer layers and fewer tiny pieces. Start with 2 to 4 layers.",
                },
                {
                  title: "Use more layers for stickers",
                  body: "Sticker art can tolerate more detail. Use 5 to 8 layers when visual color separation matters.",
                },
                {
                  title: "Remove white only when it is background",
                  body: "Do not remove white if white is part of the actual artwork, such as eyes, highlights, or lettering.",
                },
                {
                  title: "Raise minimum layer size for messy images",
                  body: "This removes tiny regions that usually come from noise, shadows, gradients, or compression.",
                },
                {
                  title: "Check each result before export",
                  body: "Every result card keeps its own layer edits, so you can compare attempts and download the best one.",
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

          <section
            className="mt-12"
            itemScope
            itemType="https://schema.org/FAQPage"
          >
            <h3 className="text-lg font-bold text-sky-950">
              Image to layered SVG for Cricut FAQ
            </h3>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {faqs.map((x) => (
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
