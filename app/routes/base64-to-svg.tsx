import * as React from "react";
import type { Route } from "./+types/base64-to-svg";
import { json } from "@remix-run/node";
import { useFetcher, type ActionFunctionArgs } from "react-router";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import Icons from "~/client/assets/icons/Icons";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "Base64 to SVG Converter - Decode Base64 SVG Online";
  const description =
    "Convert Base64 SVG code, SVG data URLs, encoded SVG strings, and Base64 raster images into downloadable SVG files. Decode, clean, preview, recolor, copy, and export SVG online.";
  const canonical = "https://www.ilovesvg.com/base64-to-svg";

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

const BACKEND_CONVERSION_RATE_LIMITS = {
  perMinute: 120,
  perFiveMinutes: 400,
  perHour: 1500,
  perDay: 3000,
} as const;

const RATE_LIMIT_ROUTE_KEY = "base64-to-svg";
const RATE_LIMIT_USER_AGENT_MAX_LENGTH = 160;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

type RateLimitWindow = {
  windowStart: number;
  count: number;
};

type RateLimitEntry = {
  minute: RateLimitWindow;
  fiveMinutes: RateLimitWindow;
  hour: RateLimitWindow;
  day: RateLimitWindow;
  lastSeen: number;
};

type RateLimitCheck = {
  allowed: boolean;
  retryAfterSeconds: number;
  limitName: "minute" | "fiveMinutes" | "hour" | "day" | null;
  remaining: {
    minute: number;
    fiveMinutes: number;
    hour: number;
    day: number;
  };
};

const RATE_LIMIT_WINDOW_MS = {
  minute: 60 * 1000,
  fiveMinutes: 5 * 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
} as const;

const rateLimitStore = new Map<string, RateLimitEntry>();
let lastRateLimitCleanup = 0;

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("true-client-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("fly-client-ip") ||
    request.headers.get("fastly-client-ip") ||
    "unknown-ip"
  );
}

function getRateLimitKey(request: Request) {
  const ip = getRequestIp(request);
  const userAgent =
    request.headers
      .get("user-agent")
      ?.slice(0, RATE_LIMIT_USER_AGENT_MAX_LENGTH) || "unknown-user-agent";

  return `${RATE_LIMIT_ROUTE_KEY}:${ip}:${userAgent}`;
}

function createWindow(now: number): RateLimitWindow {
  return { windowStart: now, count: 0 };
}

function updateRateLimitWindow(
  current: RateLimitWindow,
  now: number,
  windowMs: number,
) {
  if (now - current.windowStart >= windowMs) {
    return { windowStart: now, count: 1 };
  }

  return { ...current, count: current.count + 1 };
}

function secondsUntilReset(
  window: RateLimitWindow,
  now: number,
  windowMs: number,
) {
  return Math.max(1, Math.ceil((window.windowStart + windowMs - now) / 1000));
}

function cleanupRateLimitStore(now: number) {
  if (now - lastRateLimitCleanup < RATE_LIMIT_CLEANUP_INTERVAL_MS) return;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.lastSeen > RATE_LIMIT_WINDOW_MS.day) {
      rateLimitStore.delete(key);
    }
  }

  lastRateLimitCleanup = now;
}

function checkRateLimit(
  request: Request,
  limits: typeof BACKEND_CONVERSION_RATE_LIMITS = BACKEND_CONVERSION_RATE_LIMITS,
  keySuffix = "route",
): RateLimitCheck {
  const now = Date.now();
  const key = `${getRateLimitKey(request)}:${keySuffix}`;
  const existing = rateLimitStore.get(key) ?? {
    minute: createWindow(now),
    fiveMinutes: createWindow(now),
    hour: createWindow(now),
    day: createWindow(now),
    lastSeen: now,
  };

  const nextEntry: RateLimitEntry = {
    minute: updateRateLimitWindow(
      existing.minute,
      now,
      RATE_LIMIT_WINDOW_MS.minute,
    ),
    fiveMinutes: updateRateLimitWindow(
      existing.fiveMinutes,
      now,
      RATE_LIMIT_WINDOW_MS.fiveMinutes,
    ),
    hour: updateRateLimitWindow(existing.hour, now, RATE_LIMIT_WINDOW_MS.hour),
    day: updateRateLimitWindow(existing.day, now, RATE_LIMIT_WINDOW_MS.day),
    lastSeen: now,
  };

  rateLimitStore.set(key, nextEntry);
  cleanupRateLimitStore(now);

  const remaining = {
    minute: Math.max(0, limits.perMinute - nextEntry.minute.count),
    fiveMinutes: Math.max(
      0,
      limits.perFiveMinutes - nextEntry.fiveMinutes.count,
    ),
    hour: Math.max(0, limits.perHour - nextEntry.hour.count),
    day: Math.max(0, limits.perDay - nextEntry.day.count),
  };

  if (nextEntry.minute.count > limits.perMinute) {
    return {
      allowed: false,
      retryAfterSeconds: secondsUntilReset(
        nextEntry.minute,
        now,
        RATE_LIMIT_WINDOW_MS.minute,
      ),
      limitName: "minute",
      remaining,
    };
  }

  if (nextEntry.fiveMinutes.count > limits.perFiveMinutes) {
    return {
      allowed: false,
      retryAfterSeconds: secondsUntilReset(
        nextEntry.fiveMinutes,
        now,
        RATE_LIMIT_WINDOW_MS.fiveMinutes,
      ),
      limitName: "fiveMinutes",
      remaining,
    };
  }

  if (nextEntry.hour.count > limits.perHour) {
    return {
      allowed: false,
      retryAfterSeconds: secondsUntilReset(
        nextEntry.hour,
        now,
        RATE_LIMIT_WINDOW_MS.hour,
      ),
      limitName: "hour",
      remaining,
    };
  }

  if (nextEntry.day.count > limits.perDay) {
    return {
      allowed: false,
      retryAfterSeconds: secondsUntilReset(
        nextEntry.day,
        now,
        RATE_LIMIT_WINDOW_MS.day,
      ),
      limitName: "day",
      remaining,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    limitName: null,
    remaining,
  };
}

function formatRetryAfterText(totalSeconds: number) {
  const seconds = Math.max(1, Math.ceil(totalSeconds));

  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }

  const minutes = Math.ceil(seconds / 60);

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.ceil(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  const days = Math.ceil(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function loader({ context }: Route.LoaderArgs) {
  return {
    message: context.VALUE_FROM_EXPRESS,
    backendConversionRateLimits: BACKEND_CONVERSION_RATE_LIMITS,
  };
}

/* ========================
   Raster Base64 layered SVG action
======================== */
const MAX_RASTER_TRACE_BYTES = 30 * 1024 * 1024;
const MAX_RASTER_TRACE_MP = 30;
const MAX_RASTER_TRACE_SIDE = 8000;
const MIN_LAYER_COUNT = 2;
const MAX_LAYER_COUNT = 10;
const MAX_TRACE_SIDE_DEFAULT = 1600;
const DARK_BG_DEFAULT = "#0b1020";

const BASE64_RASTER_TRACE_DEFAULTS: LayeredOptions = {
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

export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method.toUpperCase() !== "POST") {
      return json(
        { error: "Method not allowed" },
        { status: 405, headers: { Allow: "POST" } },
      );
    }

    const rateLimit = checkRateLimit(
      request,
      BACKEND_CONVERSION_RATE_LIMITS,
      "raster-trace",
    );

    if (!rateLimit.allowed) {
      return json(
        {
          error: `Too many conversions from this connection. Please try again in ${formatRetryAfterText(rateLimit.retryAfterSeconds)}.`,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
            "X-RateLimit-Limit-Minute": String(
              BACKEND_CONVERSION_RATE_LIMITS.perMinute,
            ),
            "X-RateLimit-Limit-Five-Minutes": String(
              BACKEND_CONVERSION_RATE_LIMITS.perFiveMinutes,
            ),
            "X-RateLimit-Limit-Hour": String(
              BACKEND_CONVERSION_RATE_LIMITS.perHour,
            ),
            "X-RateLimit-Limit-Day": String(
              BACKEND_CONVERSION_RATE_LIMITS.perDay,
            ),
            "X-RateLimit-Remaining-Minute": String(rateLimit.remaining.minute),
            "X-RateLimit-Remaining-Five-Minutes": String(
              rateLimit.remaining.fiveMinutes,
            ),
            "X-RateLimit-Remaining-Hour": String(rateLimit.remaining.hour),
            "X-RateLimit-Remaining-Day": String(rateLimit.remaining.day),
          },
        },
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let rasterDataUrl = "";
    let transparent = true;
    let bgColor = "#ffffff";
    let rasterMode: "layered" | "single" = "layered";
    let formValues: FormData | Record<string, any> | null = null;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      formValues = body || {};
      rasterDataUrl = String(body?.rasterDataUrl || "");
      transparent = Boolean(body?.transparent ?? true);
      bgColor = sanitizeHexColor(String(body?.bgColor || "#ffffff"), "#ffffff");
      rasterMode = body?.rasterMode === "single" ? "single" : "layered";
    } else {
      const form = await request.formData();
      formValues = form;
      rasterDataUrl = String(form.get("rasterDataUrl") || "");
      transparent = String(form.get("transparent") ?? "true") === "true";
      bgColor = sanitizeHexColor(
        String(form.get("bgColor") || "#ffffff"),
        "#ffffff",
      );
      rasterMode =
        String(form.get("rasterMode") || "layered") === "single"
          ? "single"
          : "layered";
    }

    const parsed = parseRasterDataUrlForServer(rasterDataUrl);

    if (!parsed) {
      return json(
        { error: "Paste a valid Base64 PNG, JPG, JPEG, or WEBP image string." },
        { status: 400 },
      );
    }

    if (parsed.buffer.length > MAX_RASTER_TRACE_BYTES) {
      return json(
        {
          error:
            "Base64 image too large for layered SVG conversion. Try a smaller image.",
        },
        { status: 413 },
      );
    }

    await validateRasterInputForLayering(parsed.buffer);

    if (rasterMode === "single") {
      const result = await rasterToSingleColorSvg(
        parsed.buffer,
        readSingleTraceOptions(formValues, transparent, bgColor),
      );
      return json(result);
    }

    const result = await rasterToLayeredSvg(
      parsed.buffer,
      readLayeredTraceOptions(formValues, transparent, bgColor),
    );

    return json(result);
  } catch (err: any) {
    return json(
      {
        error:
          err?.message ||
          "Layered SVG conversion failed. Try a smaller or higher-contrast image.",
      },
      { status: 500 },
    );
  }
}

function getFormValue(
  source: FormData | Record<string, any> | null,
  key: string,
  fallback: string,
) {
  if (!source) return fallback;
  if (typeof (source as FormData).get === "function") {
    const value = (source as FormData).get(key);
    return value == null ? fallback : String(value);
  }
  const value = (source as Record<string, any>)[key];
  return value == null ? fallback : String(value);
}

function readLayeredTraceOptions(
  source: FormData | Record<string, any> | null,
  transparent: boolean,
  bgColor: string,
): LayeredOptions {
  return {
    layerCount: clampInt(
      Number(
        getFormValue(
          source,
          "layerCount",
          String(BASE64_RASTER_TRACE_DEFAULTS.layerCount),
        ),
      ),
      MIN_LAYER_COUNT,
      MAX_LAYER_COUNT,
    ),
    maxTraceSide: clampInt(
      Number(
        getFormValue(
          source,
          "maxTraceSide",
          String(BASE64_RASTER_TRACE_DEFAULTS.maxTraceSide),
        ),
      ),
      600,
      2400,
    ),
    minRegionPercent: clampNumber(
      Number(
        getFormValue(
          source,
          "minRegionPercent",
          String(BASE64_RASTER_TRACE_DEFAULTS.minRegionPercent),
        ),
      ),
      0,
      5,
    ),
    optTolerance: clampNumber(
      Number(
        getFormValue(
          source,
          "layerOptTolerance",
          String(BASE64_RASTER_TRACE_DEFAULTS.optTolerance),
        ),
      ),
      0.05,
      1.2,
    ),
    turdSize: clampInt(
      Number(
        getFormValue(
          source,
          "layerTurdSize",
          String(BASE64_RASTER_TRACE_DEFAULTS.turdSize),
        ),
      ),
      0,
      20,
    ),
    posterize:
      getFormValue(
        source,
        "posterize",
        String(BASE64_RASTER_TRACE_DEFAULTS.posterize),
      ).toLowerCase() === "true",
    removeWhite:
      getFormValue(
        source,
        "removeWhite",
        String(BASE64_RASTER_TRACE_DEFAULTS.removeWhite),
      ).toLowerCase() === "true",
    removeTransparent:
      getFormValue(
        source,
        "removeTransparent",
        String(BASE64_RASTER_TRACE_DEFAULTS.removeTransparent),
      ).toLowerCase() === "true",
    transparent,
    bgColor,
    turnPolicy: readTurnPolicy(
      getFormValue(
        source,
        "layerTurnPolicy",
        BASE64_RASTER_TRACE_DEFAULTS.turnPolicy,
      ),
    ),
  };
}

function readSingleTraceOptions(
  source: FormData | Record<string, any> | null,
  transparent: boolean,
  bgColor: string,
): SingleTraceOptions {
  const invert =
    getFormValue(source, "invert", "false").toLowerCase() === "true";
  let lineColor = sanitizeHexColor(
    getFormValue(source, "lineColor", "#000000"),
    "#000000",
  );
  let outTransparent = transparent;
  let outBgColor = bgColor;

  if (invert) {
    outTransparent = false;
    if (
      !outBgColor ||
      outBgColor.toLowerCase() === "#ffffff" ||
      outBgColor.toLowerCase() === "#fff"
    ) {
      outBgColor = DARK_BG_DEFAULT;
    }
    if (lineColor.toLowerCase() === "#000000") {
      lineColor = "#ffffff";
    }
  }

  return {
    threshold: clampInt(
      Number(getFormValue(source, "threshold", "224")),
      0,
      255,
    ),
    turdSize: clampInt(Number(getFormValue(source, "turdSize", "2")), 0, 20),
    optTolerance: clampNumber(
      Number(getFormValue(source, "optTolerance", "0.28")),
      0.05,
      1.2,
    ),
    turnPolicy: readTurnPolicy(getFormValue(source, "turnPolicy", "minority")),
    lineColor,
    invert,
    transparent: outTransparent,
    bgColor: outBgColor,
    preprocess:
      getFormValue(source, "preprocess", "none") === "edge" ? "edge" : "none",
    blurSigma: clampNumber(
      Number(getFormValue(source, "blurSigma", "0.8")),
      0,
      3,
    ),
    edgeBoost: clampNumber(
      Number(getFormValue(source, "edgeBoost", "1.0")),
      0.5,
      2,
    ),
  };
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

function parseRasterDataUrlForServer(dataUrl: string) {
  const trimmed = String(dataUrl || "").trim();
  const match = trimmed.match(
    /^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=\s]+)$/i,
  );

  if (!match) return null;

  const mime =
    match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, "");

  // @ts-ignore Buffer exists in the Remix node runtime.
  const buffer: Buffer = Buffer.from(base64, "base64");

  if (!buffer.length) return null;

  return { mime, buffer };
}

async function validateRasterInputForLayering(input: Buffer) {
  try {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const sharp = req("sharp") as typeof import("sharp");
    const meta = await sharp(input).metadata();

    const w = meta.width ?? 0;
    const h = meta.height ?? 0;

    if (!w || !h) {
      throw new Error("Could not read the Base64 image dimensions.");
    }

    const mp = (w * h) / 1_000_000;

    if (
      w > MAX_RASTER_TRACE_SIDE ||
      h > MAX_RASTER_TRACE_SIDE ||
      mp > MAX_RASTER_TRACE_MP
    ) {
      throw new Error(
        `Base64 image too large: ${w}×${h} (~${mp.toFixed(
          1,
        )} MP). Max ${MAX_RASTER_TRACE_SIDE}px per side or ${MAX_RASTER_TRACE_MP} MP.`,
      );
    }
  } catch (error: any) {
    if (error?.message) throw error;
    throw new Error(
      "Could not read the Base64 image. Try a PNG, JPG, or WEBP image.",
    );
  }
}

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

type ServerLayer = {
  id: string;
  name: string;
  color: string;
  pixelPercent: number;
  pathTags: string;
};

type SingleTraceOptions = {
  threshold: number;
  turdSize: number;
  optTolerance: number;
  turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  lineColor: string;
  invert: boolean;
  transparent: boolean;
  bgColor: string;
  preprocess: "none" | "edge";
  blurSigma: number;
  edgeBoost: number;
};

function annotateSingleTraceSvg(svg: string, layerId: string) {
  return String(svg).replace(
    /<path\b([^>]*?)(\s*\/?)>/gi,
    (match, attrs = "", selfClose = "") => {
      const currentAttrs = String(attrs || "");

      if (/\bdata-fill-layer-id\s*=/i.test(currentAttrs)) return match;

      return `<path${currentAttrs} data-fill-layer-id="${escapeXmlAttr(layerId)}"${selfClose}>`;
    },
  );
}

async function rasterToSingleColorSvg(
  input: Buffer,
  options: SingleTraceOptions,
): Promise<{
  svg: string;
  width: number;
  height: number;
  layers: ServerLayer[];
  palette: string[];
}> {
  const prepped = await normalizeForSingleTrace(input, options);
  const traced = await traceBitmapToSvg(prepped, {
    threshold: options.threshold,
    turdSize: options.turdSize,
    optTolerance: options.optTolerance,
    turnPolicy: options.turnPolicy,
  });

  const ensured = ensureViewBoxResponsiveString(coerceSvgString(traced));
  const colored = recolorSvgPaths(ensured.svg, options.lineColor);
  const stripped = stripFullWhiteBackgroundRectString(
    colored,
    ensured.width,
    ensured.height,
  );
  const svgBase = options.transparent
    ? stripped
    : injectBackgroundRectString(
        stripped,
        ensured.width,
        ensured.height,
        options.bgColor,
      );
  const svg = annotateSingleTraceSvg(svgBase, "single-color-trace");

  const pathTags = extractPathTags(svg);

  return {
    svg,
    width: ensured.width,
    height: ensured.height,
    layers: pathTags.trim()
      ? [
          {
            id: "single-color-trace",
            name: "Single color trace",
            color: options.lineColor,
            pixelPercent: 100,
            pathTags,
          },
        ]
      : [],
    palette: [options.lineColor],
  };
}

async function normalizeForSingleTrace(
  input: Buffer,
  opts: SingleTraceOptions,
): Promise<Buffer> {
  try {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const sharp = req("sharp") as typeof import("sharp");

    try {
      (sharp as any).concurrency?.(1);
      (sharp as any).cache?.({ files: 0, memory: 32 });
    } catch {}

    let base = sharp(input).rotate().resize({
      width: MAX_TRACE_SIDE_DEFAULT,
      height: MAX_TRACE_SIDE_DEFAULT,
      fit: "inside",
      withoutEnlargement: true,
    });

    if (opts.preprocess === "edge") {
      const { data, info } = await base
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .removeAlpha()
        .grayscale()
        .blur(opts.blurSigma > 0 ? opts.blurSigma : undefined)
        .raw()
        .toBuffer({ resolveWithObject: true });

      const width = info.width | 0;
      const height = info.height | 0;

      if (width <= 1 || height <= 1) {
        return await base
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .removeAlpha()
          .grayscale()
          .gamma()
          .normalize()
          .png()
          .toBuffer();
      }

      const src = data as Buffer;
      const out = Buffer.alloc(width * height, 255);
      const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let gx = 0;
          let gy = 0;
          let n = 0;
          for (let j = -1; j <= 1; j++) {
            for (let i = -1; i <= 1; i++) {
              const v = src[(y + j) * width + (x + i)];
              gx += v * kx[n];
              gy += v * ky[n];
              n++;
            }
          }
          let magnitude = Math.sqrt(gx * gx + gy * gy) * opts.edgeBoost;
          if (magnitude > 255) magnitude = 255;
          out[y * width + x] = 255 - magnitude;
        }
      }

      if (isFlatTraceBuffer(out)) {
        return await base
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .removeAlpha()
          .grayscale()
          .gamma()
          .normalize()
          .png()
          .toBuffer();
      }

      return await sharp(out, { raw: { width, height, channels: 1 } })
        .png()
        .toBuffer();
    }

    return await base
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .removeAlpha()
      .grayscale()
      .gamma()
      .normalize()
      .png()
      .toBuffer();
  } catch {
    return input;
  }
}

function isFlatTraceBuffer(buf: Buffer, sampleStep = 53): boolean {
  if (!buf.length) return true;

  let min = 255;
  let max = 0;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < buf.length; i += sampleStep) {
    const value = buf[i];
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
    count++;
  }

  const mean = sum / Math.max(count, 1);
  const range = max - min;

  if (range <= 2) return true;
  if (mean <= 8 || mean >= 247) return true;

  let varianceTotal = 0;
  for (let i = 0; i < buf.length; i += sampleStep) {
    const diff = buf[i] - mean;
    varianceTotal += diff * diff;
  }

  return varianceTotal / Math.max(count - 1, 1) < 8;
}

async function traceBitmapToSvg(
  input: Buffer,
  options: {
    threshold: number;
    turdSize: number;
    optTolerance: number;
    turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  },
): Promise<string> {
  const potrace = await import("potrace");
  const traceFn: any = (potrace as any).trace;
  const PotraceClass: any = (potrace as any).Potrace;

  const opts: any = {
    color: "#000000",
    threshold: options.threshold,
    turdSize: options.turdSize,
    optTolerance: options.optTolerance,
    turnPolicy: options.turnPolicy,
    invert: false,
    blackOnWhite: true,
  };

  return await new Promise((resolve, reject) => {
    if (typeof traceFn === "function") {
      traceFn(input, opts, (err: any, out: string) =>
        err ? reject(err) : resolve(out),
      );
    } else if (PotraceClass) {
      const p = new PotraceClass(opts);
      p.loadImage(input, (err: any) => {
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
}

function coerceSvgString(svgRaw: string | null | undefined): string {
  const fallback =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"></svg>';
  if (!svgRaw) return fallback;
  const trimmed = String(svgRaw).trim();
  if (/^<svg\b/i.test(trimmed)) return trimmed;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${trimmed}</svg>`;
}

function ensureViewBoxResponsiveString(svg: string): {
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
  const width = widthMatch ? Number(widthMatch[1]) : 1024;
  const height = heightMatch ? Number(heightMatch[1]) : 1024;

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

  return { svg: svg.replace(openTag, newOpen), width, height };
}

function recolorSvgPaths(svg: string, fillColor: string): string {
  let out = svg.replace(
    /<path\b([^>]*?)\sfill\s*=\s*["'][^"']*["']([^>]*?)>/gi,
    (_match, a, b) => `<path${a} fill="${fillColor}"${b}>`,
  );

  out = out.replace(/<path\b((?:(?!>)[\s\S])*?)>/gi, (match, attrs) => {
    if (/fill\s*=/.test(attrs)) return match;
    return `<path${attrs} fill="${fillColor}">`;
  });

  return out;
}

function stripFullWhiteBackgroundRectString(
  svg: string,
  width: number,
  height: number,
): string {
  const whitePattern =
    /(#ffffff|#fff|white|rgb\(255\s*,\s*255\s*,\s*255\)|rgba\(255\s*,\s*255\s*,\s*255\s*,\s*1\))/i;

  const numeric = new RegExp(
    `<rect\\b[^>]*x\\s*=\\s*["']0["'][^>]*y\\s*=\\s*["']0["'][^>]*width\\s*=\\s*["']${escapeRegExpString(String(width))}["'][^>]*height\\s*=\\s*["']${escapeRegExpString(String(height))}["'][^>]*fill\\s*=\\s*["']${whitePattern.source}["'][^>]*>`,
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
  const rect = `<rect x="0" y="0" width="${width}" height="${height}" fill="${sanitizeHexColor(color, "#ffffff")}"/>`;
  const index = svg.indexOf(openTag) + openTag.length;
  return svg.slice(0, index) + rect + svg.slice(index);
}

function escapeRegExpString(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  const sharp = req("sharp") as typeof import("sharp");

  try {
    (sharp as any).concurrency?.(1);
    (sharp as any).cache?.({ files: 0, memory: 48 });
  } catch {}

  const { data, info } = await sharp(input)
    .rotate()
    .resize({
      width: options.maxTraceSide,
      height: options.maxTraceSide,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width | 0;
  const height = info.height | 0;

  if (!width || !height) {
    throw new Error("Could not decode JPG image.");
  }

  const pixels = collectPixels(data as Buffer, width, height, {
    removeTransparent: options.removeTransparent,
    removeWhite: options.removeWhite,
    posterize: options.posterize,
  });

  if (pixels.length < 20) {
    throw new Error(
      "Not enough visible JPG image data to build layers. Try disabling white background removal.",
    );
  }

  const paletteRgb = buildPalette(pixels, options.layerCount);

  const assignments = assignAllPixelsToPalette(data as Buffer, width, height, {
    palette: paletteRgb,
    removeTransparent: options.removeTransparent,
    removeWhite: options.removeWhite,
    posterize: options.posterize,
  });

  const totalAssignable = assignments.assignableCount || 1;

  const rawLayerItems = paletteRgb
    .map((rgb, index) => {
      const count = assignments.counts[index] || 0;
      const percent = (count / totalAssignable) * 100;

      return {
        index,
        rgb,
        color: rgbToHex(rgb),
        count,
        percent,
      };
    })
    .filter((x) => x.count > 0 && x.percent >= options.minRegionPercent)
    .sort((a, b) => {
      const lumDiff = luminance(b.rgb) - luminance(a.rgb);
      if (Math.abs(lumDiff) > 8) return lumDiff;
      return b.count - a.count;
    });

  if (rawLayerItems.length === 0) {
    throw new Error(
      "No usable JPG color layers were found. Try lowering minimum layer size or disabling white background removal.",
    );
  }

  const layers: ServerLayer[] = [];

  for (let i = 0; i < rawLayerItems.length; i++) {
    const item = rawLayerItems[i];

    const mask = Buffer.alloc(width * height, 255);

    for (let px = 0; px < assignments.layerForPixel.length; px++) {
      if (assignments.layerForPixel[px] === item.index) {
        mask[px] = 0;
      }
    }

    if (!maskHasInk(mask)) continue;

    const maskPng = await sharp(mask, {
      raw: { width, height, channels: 1 },
    })
      .png()
      .toBuffer();

    const pathTags = await traceMaskToPathTags(maskPng, {
      turdSize: options.turdSize,
      optTolerance: options.optTolerance,
      turnPolicy: options.turnPolicy,
    });

    if (!pathTags.trim()) continue;

    layers.push({
      id: `layer-${i + 1}`,
      name: `Layer ${i + 1}`,
      color: item.color,
      pixelPercent: Number(item.percent.toFixed(2)),
      pathTags,
    });
  }

  if (layers.length === 0) {
    throw new Error(
      "The JPG did not produce traceable layers. Try fewer layers, lower speckle removal, or a higher-contrast JPG.",
    );
  }

  const svg = buildLayeredSvgString({
    width,
    height,
    layers,
    transparent: options.transparent,
    bgColor: options.bgColor,
  });

  return {
    svg,
    width,
    height,
    layers,
    palette: layers.map((layer) => layer.color),
  };
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
  const potrace = await import("potrace");
  const traceFn: any = (potrace as any).trace;
  const PotraceClass: any = (potrace as any).Potrace;

  const opts: any = {
    color: "#000000",
    threshold: 128,
    turdSize: options.turdSize,
    optTolerance: options.optTolerance,
    turnPolicy: options.turnPolicy,
    invert: false,
    blackOnWhite: true,
  };

  const svgRaw: string = await new Promise((resolve, reject) => {
    if (typeof traceFn === "function") {
      traceFn(maskPng, opts, (err: any, out: string) =>
        err ? reject(err) : resolve(out),
      );
    } else if (PotraceClass) {
      const p = new PotraceClass(opts);
      p.loadImage(maskPng, (err: any) => {
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
      const safeLabel = escapeXmlAttr(layer.name || `Layer ${index + 1}`);

      return `<g id="${safeId}" data-layer-id="${safeId}" data-layer-name="${safeLabel}" data-layer-color="${fill}" fill="${fill}">${layer.pathTags || ""}</g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Layered SVG from Base64 image">${background}${body}</svg>`;
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
   Types
======================== */
type InputKind =
  | "empty"
  | "svg"
  | "svg-data-url"
  | "plain-base64-svg"
  | "raster-data-url"
  | "plain-base64-raster"
  | "invalid";

type BackgroundMode = "transparent" | "solid";
type ColorMode = "preserve" | "force-fill" | "force-stroke";
type SizeUnit = "px" | "in" | "cm";

type RasterTraceMode = "layered" | "single";
type RasterPreprocessMode = "none" | "edge";
type TraceTurnPolicy =
  | "black"
  | "white"
  | "left"
  | "right"
  | "minority"
  | "majority";

type Settings = {
  input: string;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  colorMode: ColorMode;
  forceColor: string;
  removeScripts: boolean;
  removeMetadata: boolean;
  removeRasterImages: boolean;
  removeComments: boolean;
  normalizeViewBox: boolean;
  responsiveSvg: boolean;
  minifyOutput: boolean;
  addSvgNote: boolean;
  targetWidth: number;
  unit: SizeUnit;
  rasterMode: RasterTraceMode;
  layerCount: number;
  maxTraceSide: number;
  minRegionPercent: number;
  layerOptTolerance: number;
  layerTurdSize: number;
  layerTurnPolicy: TraceTurnPolicy;
  posterize: boolean;
  removeWhite: boolean;
  removeTransparent: boolean;
  threshold: number;
  turdSize: number;
  optTolerance: number;
  turnPolicy: TraceTurnPolicy;
  lineColor: string;
  invert: boolean;
  preprocess: RasterPreprocessMode;
  blurSigma: number;
  edgeBoost: number;
};

type DecodedResult = {
  kind: InputKind;
  svg: string;
  displaySvg: string;
  error: string | null;
  warning: string | null;
  width: number;
  height: number;
  viewBox: string;
  byteSize: number;
  elementCount: number;
  pathCount: number;
  hasRasterImage: boolean;
  hasScript: boolean;
  hasText: boolean;
  note: string;
  layers?: LayerState[];
};

type RasterLayeredServerResult = {
  svg?: string;
  error?: string;
  width?: number;
  height?: number;
  layers?: ServerLayer[];
  palette?: string[];
  retryAfterSeconds?: number;
};

type LayerState = {
  id: string;
  name: string;
  color: string;
  originalColor: string;
  visible: boolean;
  pixelPercent: number;
  pathTags?: string;
};

type HistoryItem = {
  stamp: number;
  svg: string;
  displaySvg: string;
  width: number;
  height: number;
  kind: InputKind;
  layers?: LayerState[];
  transparent: boolean;
  bgColor: string;
};

type Preset = {
  id: string;
  label: string;
  help: string;
  settings: Partial<Settings>;
};

function cloneLayers(layers?: LayerState[]) {
  return layers?.map((layer) => ({ ...layer }));
}

const SAMPLE_BASE64_SVG =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDI0IDEwMjQiIHZlcnNpb249IjEuMSI+PHBhdGggZD0iTSAxNTAuMzQ0IDY0IEMgMTM2LjA4NSA2Ni45NjMsIDEyNiA3OC43OTAsIDEyNiA5Mi41NDcgQyAxMjYgOTkuNDU3LCAxMjguNzc4IDEwMiwgMTM2LjMyOSAxMDIgQyAxNDYuNzg3IDEwMiwgMTUwLjk1MSAxMDAuMTE0LCAxNTAuOTg1IDk1LjM2MSBDIDE1MS4wMTEgOTEuNjcwLCAxNTQuMjY0IDg4LjU5OSwgMTU3LjMzMSA4OS4zNjggQyAxNjEuNDAzIDkwLjM5MCwgMTYwLjU5MiA5Mi43MjAsIDE1NC4wMTkgOTguODg4IEMgMTQ3LjIxOCAxMDUuMjY4LCAxNDUgMTA5LjcyNiwgMTQ1IDExNy4wMTMgQyAxNDUgMTIxLjA5NywgMTQ1LjQ5MCAxMjIuNTgxLCAxNDcuNTAxIDEyNC41OTIgQyAxNDkuODY3IDEyNi45NTgsIDE0OS45MjIgMTI3LjI1MSwgMTQ4LjUwMSAxMjkuOTk3IEMgMTQ1Ljg2OCAxMzUuMDkwLCAxNDYuNTM4IDEzOS4zODcsIDE1MC41MDkgMTQyLjg3NCBMIDE1NC4wMTggMTQ1Ljk1NSAxNTIuODgwIDE1OC4yMjcgQyAxNDkuMjk5IDE5Ni44MTgsIDE1Ny44NTQgMjc4LjAzNiwgMTczLjQ4MSAzNTMuNzkzIEMgMTc1LjM3NiAzNjIuOTgyLCAxNzcuODYwIDM3OC44MjUsIDE3OSAzODkgQyAxODEuNjYzIDQxMi43NTgsIDE4Mi45NDMgNDE3LjMwNCwgMTg4LjQ2NSA0MjIuNjEwIEMgMTkyLjU2MCA0MjYuNTQ0LCAxOTMuMDkyIDQyNi43NTAsIDIwMC45NjYgNDI3LjQzNyBDIDIwNS40ODkgNDI3LjgzMSwgMjEzLjUzNSA0MjguMDc4LCAyMTguODQ1IDQyNy45ODYgQyAyMzMuMDYzIDQyNy43MzgsIDIzMyA0MjcuNzI5LCAyMzMgNDMwLjAxMiBDIDIzMyA0MzEuMzQzLCAyMzEuMjIyIDQzMy4xNzMsIDIyNy43NTAgNDM1LjQxMyBDIDIxOS4wNDQgNDQxLjAzMiwgMjE0LjUzMCA0NDYuNjY1LCAyMTIuNTE4IDQ1NC40MjUgQyAyMTEuNTA4IDQ1OC4zMTgsIDIxMS40NDMgNDU4LjM2MSwgMjA0LjUwMCA0NTkuNzQ4IEMgMTg1LjUwNyA0NjMuNTQyLCAxODQuMTgxIDQ2OC4zMDYsIDIwMC44MzggNDcyLjg5OCBDIDIyOC44MzQgNDgwLjYxNywgMzQxLjkzNyA0ODIuNjY1LCAzOTUgNDc2LjQxMyBDIDQzMC42MjUgNDcyLjIxNiwgNDQwLjA4OCA0NjUuMTkyLCA0MTcuMjUwIDQ1OS44OTkgQyA0MTIuNTg1IDQ1OC44MTcsIDQxMS45OTkgNDU4LjM5MywgNDExLjk5MCA0NTYuMDkxIEMgNDExLjk2MiA0NDguNzM2LCA0MDQuNjE5IDQzOS4zNzQsIDM5NS4wODggNDM0LjU0NSBDIDM5MC43MjcgNDMyLjMzNSwgMzg5IDQzMC40NzEsIDM4OSA0MjcuOTc2IEMgMzg5IDQyNy41MDMsIDQwMS40ODggNDI2Ljk3NywgNDE2Ljc1MCA0MjYuODA4IEMgNDU5LjgzNSA0MjYuMzMwLCA0NTkuMTA5IDQyNy4zNjUsIDQ1NS41NjIgMzcxLjUwMCBDIDQ1NC42NTQgMzU3LjIwMCwgNDUyLjM0NSAzMjYuODI1LCA0NTAuNDMxIDMwNCBDIDQ0My43MzkgMjI0LjIxOSwgNDQxLjk3MSAyMDMuNDIyLCA0NDAuOTkwIDE5MyBDIDQzOS4zMjAgMTc1LjI1NiwgNDM5LjM4OCAxNzQuODI4LCA0NDQuMjQ4IDE3Mi41MDAgQyA0NTIuMDcwIDE2OC43NTQsIDQ1NC44MzEgMTU4LjcyMywgNDUxLjg3NSAxNDQuNzk5IEMgNDQ4LjQ2MiAxMjguNzMwLCA0MzcuNzMzIDExOC4wMjAsIDQyMC41MDAgMTEzLjQ4NCBDIDQxMy4xNzMgMTExLjU1NSwgMzQ0LjA5NSAxMTAuMTUwLCAyNDYuMjQ4IDEwOS45NDAgQyAyMTEuNDYwIDEwOS44NjUsIDE4Mi43OTkgMTA5LjQ4NCwgMTgyLjU1NyAxMDkuMDkyIEMgMTgyLjMxNSAxMDguNzAxLCAxODMuNDQxIDEwNS43NTcsIDE4NS4wNTkgMTAyLjU0OSBDIDE5Mi40MjIgODcuOTUyLCAxODUuMjY2IDcxLjIzOSwgMTY5LjIzMSA2NS41ODIgQyAxNjMuNzk0IDYzLjY2MywgMTU1LjM2MyA2Mi45NTcsIDE1MC4zNDQgNjQgTSAxNTIuNTAwIDY5LjAxNiBDIDE0MC4wMDkgNzEuNTcwLCAxMzEuMDIwIDgxLjYxMywgMTMyLjE4MCA5MS43MTcgQyAxMzIuNzgzIDk2Ljk2MywgMTQ2IDk1Ljg5NCwgMTQ2IDkwLjYwMCBDIDE0NiA4NC41NzIsIDE1NC4xNjIgNzkuNzg3LCAxNjAuMTY0IDgyLjI5NiBDIDE2OC41NTYgODUuODA0LCAxNjguNjgzIDk0LjEyMSwgMTYwLjQzNSAxMDAgQyAxNTUuMTcyIDEwMy43NTEsIDE1MS44MTIgMTA5Ljk0MywgMTUyLjE5MCAxMTUuMTkxIEwgMTUyLjUwMCAxMTkuNTAwIDE1OC45NTkgMTE5LjUwMCBMIDE2NS40MTggMTE5LjUwMCAxNjYuMTI5IDExNi4wMjQgQyAxNjYuNTIwIDExNC4xMTIsIDE2Ny44ODggMTExLjcyNCwgMTY5LjE3MCAxMTAuNzE4IEMgMTc4LjgwNiAxMDMuMTQ5LCAxODIuMjMxIDk3LjcwMSwgMTgyLjIzMSA4OS45NDIgQyAxODIuMjMxIDc2LjQyMCwgMTY3LjM4NiA2NS45NzIsIDE1Mi41MDAgNjkuMDE2IE0gNjE0LjkzOSAxMDYuMzMzIEMgNjA5LjQ2MSAxMDcuODQ5LCA2MDUuNzUzIDExMC4zNzQsIDYwMC4yNTkgMTE2LjMzNSBDIDU4OS40MjcgMTI4LjA4NiwgNTg2Ljg5MCAxNDEuNTk4LCA1ODQuOTI2IDE5OCBDIDU4My45NTggMjI1Ljc3MywgNTgzLjYwMiAyMjkuOTMwLCA1ODEuOTE0IDIzMy4xMzYgQyA1NzkuNTc3IDIzNy41NzYsIDU3OS41MjYgMjM5LjYxMiwgNTgxLjY1NSAyNDMuNTAwIEMgNTg0LjM3NyAyNDguNDcyLCA1ODUuMDI5IDI1NS44NTYsIDU4Mi44MDggMjU2LjU2MSBDIDU3Ny4xMTggMjU4LjM2NywgNTc2LjUzMiAyNzAuNDA2LCA1ODEuOTAyIDI3NS4yMDMgTCA1ODUgMjc3Ljk3MiA1ODUgMjkzLjI5OCBMIDU4NSAzMDguNjI1IDU3NS4zMDYgMzE0Ljk3MiBDIDU2My4xMzIgMzIyLjk0MiwgNTUzLjI5NSAzMzIuNjYxLCA1NDkuNDI3IDM0MC41MzggQyA1NDQuOTM2IDM0OS42ODYsIDU0NS4xMzEgMzYxLjc2MiwgNTQ5LjkyOSAzNzEuNTIzIEMgNTUzLjY0OSAzNzkuMDk0LCA1NjIuNDEwIDM4OS4wOTksIDU2Ni45NzUgMzkwLjk4OSBDIDU2OC41NDQgMzkxLjY0MCwgNTcwLjM3OSAzOTMuNTAxLCA1NzEuMDUyIDM5NS4xMjcgQyA1NzQuNzAyIDQwMy45MzYsIDU4NC43NTEgNDExLjk3MiwgNTkyLjE0MyA0MTEuOTkxIEMgNTk0LjE2OSA0MTEuOTk2LCA1OTYuMDA0IDQxMi41NjcsIDU5Ni4yNzYgNDEzLjI3OCBDIDU5Ni41NDYgNDEzLjk4MCwgNTk5LjE3OSA0MTUuODY4LCA2MDIuMTI3IDQxNy40NzMgQyA2MDcuMTM4IDQyMC4yMDAsIDYwOC41MzEgNDIwLjQ0NiwgNjIzLjQ5NCA0MjEuMjU0IEMgNjMyLjI5NyA0MjEuNzI5LCA2NDEuODIxIDQyMi4zNDQsIDY0NC42NTggNDIyLjYxOSBMIDY0OS44MTUgNDIzLjEyMSA2NTAuMTg3IDQyOC4zMTAgQyA2NTAuMzkyIDQzMS4xNjUsIDY1MC4yNDggNDMzLjYzNywgNjQ5Ljg2NyA0MzMuODA0IEMgNjQxLjgwMyA0MzcuMzQ3LCA2MzMuMDYxIDQ0Ny45MDUsIDYzMi4wNDIgNDU1LjMzMiBDIDYzMS41MTYgNDU5LjE1NywgNjMxLjMzNSA0NTkuMzE5LCA2MjYuMDMyIDQ2MC42NzQgQyA2MjAuMDUwIDQ2Mi4yMDIsIDYxNC44ODQgNDY0Ljg0OCwgNjE0LjI2NiA0NjYuNzAxIEMgNjE0LjA1MCA0NjcuMzUxLCA2MTUuMzUxIDQ2OC42NDcsIDYxNy4xNTggNDY5LjU4MiBDIDYzMS4wNDcgNDc2Ljc2NCwgNjgyLjU3OCA0ODAuNTgyLCA3NTMuNTAwIDQ3OS42ODQgQyA4MDEuNzI1IDQ3OS4wNzQsIDgyMC4yNDEgNDc3Ljc3OSwgODQxLjI5NSA0NzMuNTQ0IEMgODU4LjUyNiA0NzAuMDc4LCA4NjIuMjU2IDQ2Ni43NzAsIDg1My4zNjggNDYyLjgzOSBDIDg0OS45NzQgNDYxLjMzNywgODMzLjQ5MCA0NTcuMTgzLCA4MzAuMjUwIDQ1Ny4wMTMgQyA4MzAuMTEyIDQ1Ny4wMDYsIDgzMCA0NTYuMzk3LCA4MzAgNDU1LjY2MCBDIDgzMCA0NTQuOTIzLCA4MjguNjMzIDQ1MS41ODQsIDgyNi45NjIgNDQ4LjI0MCBDIDgyNC40NTAgNDQzLjIxMiwgODIyLjc2NCA0NDEuMzY5LCA4MTcuMjEyIDQzNy41NzggQyA4MTMuNTIwIDQzNS4wNTgsIDgwOS45NjQgNDMyLjk5NiwgODA5LjMwOSA0MzIuOTk4IEMgODA4LjY1NCA0MzIuOTk5LCA4MDcuODEzIDQzMi41MDYsIDgwNy40NDAgNDMxLjkwMyBDIDgwNi45NTAgNDMxLjExMCwgODE0LjY2NCA0MzEuMDA5LCA4MzUuMjU2IDQzMS41MzcgQyA4NjMuNjgyIDQzMi4yNjcsIDg2My43NTkgNDMyLjI2MywgODY3Ljc5MCA0MjkuOTk4IEMgODcyLjQyNiA0MjcuMzkyLCA4NzYuNTM5IDQyMC43MzUsIDg3Ny41OTYgNDE0LjEyNiBDIDg3OC4zMjUgNDA5LjU2OSwgODgwLjE3MSA0MDcsIDg4Mi43MTYgNDA3IEMgODg3LjEzMCA0MDcsIDg5OC43ODcgMzk5Ljg4MSwgOTA1LjEwMyAzOTMuMzI3IEMgOTE4LjYyMiAzNzkuMzAwLCA5MTkuNTQ4IDM2NC4yNTUsIDkwOC4xNzAgMzQzLjUwMCBMIDkwNC4zMzMgMzM2LjUwMCA5MDcuNjY4IDMzMS40NjEgQyA5MTIuNjgzIDMyMy44ODQsIDkxNS4xNDggMzE2LjEyMCwgOTEzLjkzNCAzMTEuNzI1IEMgOTExLjQ4MiAzMDIuODQzLCA5MDAuNDEyIDI5OC44MjIsIDg4OC41MDAgMzAyLjQ4OCBDIDg4Ni42NjMgMzAzLjA1MywgODg2LjUyNyAzMDIuNzEwLCA4ODYuODMxIDI5OC4yODMgTCA4ODcuMTYyIDI5My40NjMgODkwLjk1MSAyOTMuODI0IEMgOTAxLjIwMCAyOTQuODAxLCA5MDguMzQ4IDI4My4zNzUsIDkwMy40MzQgMjczLjg3MiBDIDkwMS42NTEgMjcwLjQyNCwgODk2LjczOCAyNjgsIDg5MS41MzIgMjY4IEMgODg4LjI5MyAyNjgsIDg4OCAyNjcuNzU3LCA4ODggMjY1LjA3MCBDIDg4OCAyNjIuMjQxLCA4ODguMTEyIDI2Mi4xNzIsIDg5MS4yNDMgMjYzLjA3MCBDIDg5NS44OTcgMjY0LjQwNSwgOTAwLjY0MiAyNjMuMjA1LCA5MDQuMDA0IDI1OS44NDIgQyA5MTIuNzUxIDI1MS4wOTUsIDkwNC44NzUgMjM2LjU5MiwgODkyLjM5MyAyMzguNDY0IEwgODg4IDIzOS4xMjMgODg4IDIxMi41MzYgTCA4ODggMTg1Ljk1MCA4OTEuMDE2IDE4NS4zNDcgQyA4OTYuMzg3IDE4NC4yNzMsIDkwMS44OTQgMTc4LjI1MSwgOTAyLjk4OCAxNzIuMjU3IEMgOTA0LjI1OCAxNjUuMzAzLCA5MDIuNTc4IDE1MS45OTcsIDg5OS42MTEgMTQ1LjUwMCBDIDg5NS4xMzIgMTM1LjY5NCwgODgzLjc5MiAxMjcuMTY0LCA4NzAuNDM3IDEyMy41NTYgQyA4NjMuMDIxIDEyMS41NTMsIDg1OC4xNjYgMTIxLjE1MCwgNzY3LjUwMCAxMTUuMDEzIEMgNzI2LjgwMCAxMTIuMjU4LCA2ODMuODI1IDEwOS4zMjUsIDY3MiAxMDguNDk0IEMgNjYwLjE3NSAxMDcuNjYzLCA2NDYuNjc1IDEwNi43NTIsIDY0MiAxMDYuNDY5IEMgNjM3LjMyNSAxMDYuMTg2LCA2MzAuMzUwIDEwNS43NTYsIDYyNi41MDAgMTA1LjUxMyBDIDYyMi40OTUgMTA1LjI2MSwgNjE3LjU0OCAxMDUuNjEyLCA2MTQuOTM5IDEwNi4zMzMgTSA2MzguMzcyIDExNi40MDYgQyA2NDIuNDk3IDEyMi40ODUsIDY0My4wMzUgMTM1LjA2NSwgNjM5LjU5NyAxNDUuMDQ1IEwgNjM4LjI5OSAxNDguODExIDY0Ny4zOTkgMTQ5LjQzOSBDIDY1Mi40MDUgMTQ5Ljc4NSwgNjU4LjU4MyAxNTAuMzEyLCA2NjEuMTMwIDE1MC42MTEgTCA2NjUuNzU5IDE1MS4xNTUgNjY3LjM4MCAxNDYuMzk5IEMgNjcwLjgyMiAxMzYuMjk2LCA2NjguOTcyIDEyMi45MzksIDY2My40NTkgMTE4LjA5OCBDIDY2MC4xNzEgMTE1LjIxMSwgNjU4LjUwOCAxMTQuODI2LCA2NDMuMTg4IDExMy40MDcgTCA2MzUuODc3IDExMi43MjkgNjM4LjM3MiAxMTYuNDA2IE0gNjY4LjY5OCAxMTguODUyIEMgNjczLjc1MSAxMjMuOTA0LCA2NzQuNzkxIDEzMS44MTEsIDY3Mi43MzMgMTQ5LjUwMCBDIDY3Mi41MTggMTUxLjM0NywgNjczLjMwMiAxNTEuNTU3LCA2ODMgMTUyLjI0NiBDIDY4OC43NzUgMTUyLjY1NiwgNzAzLjQwMCAxNTMuODk4LCA3MTUuNTAwIDE1NS4wMDUgQyA3MjcuNjAwIDE1Ni4xMTIsIDc0OS40MjUgMTU3LjkyMywgNzY0IDE1OS4wMjkgQyA3NzguNTc1IDE2MC4xMzUsIDc5NS4yMjUgMTYxLjQ3NywgODAxIDE2Mi4wMTEgQyA4MDYuNzc1IDE2Mi41NDYsIDgyNy4yNTAgMTY0LjM1MSwgODQ2LjUwMCAxNjYuMDI0IEMgODY1Ljc1MCAxNjcuNjk2LCA4ODMuODYyIDE2OS4zMzIsIDg4Ni43NTAgMTY5LjY1OSBMIDg5MiAxNzAuMjU0IDg5MiAxNjUuNjc2IEMgODkyIDE0MS4wNjMsIDg3OS40NzcgMTMxLjUyNiwgODQ0LjUwMCAxMjkuNTA0IEMgODEwLjc2MiAxMjcuNTUzLCA2ODguOTY0IDExOC4yOTQsIDY3MS41MTggMTE2LjM1NCBMIDY2NS41MzUgMTE1LjY4OSA2NjguNjk4IDExOC44NTIgTSAxOTMuOTI2IDEyMC44OTYgQyAxOTguNTgyIDEyNy40MzUsIDIwMC4yMjEgMTQ0LjAyOSwgMTk3LjAzNyAxNTIuNDAyIEMgMTk2LjIyNCAxNTQuNTQwLCAxOTYuMjgyIDE1NC41NDksIDIwOS4zMjIgMTU0LjI3MiBDIDIyNC44ODggMTUzLjk0MSwgMjI0LjQ2OCAxNTQuMjgyLCAyMjQuNDQ2IDE0MiBDIDIyNC40MjcgMTMxLjYyNSwgMjIyLjEyMyAxMjQuMTIzLCAyMTcuODUzIDEyMC41MzAgQyAyMTUuMDE4IDExOC4xNDUsIDIxNC4xODkgMTE4LCAyMDMuMzU1IDExOCBMIDE5MS44NjQgMTE4IDE5My45MjYgMTIwLjg5NiBNIDIyMSAxMTguNjcxIEMgMjIxIDExOC45MDAsIDIyMi4xMzcgMTIwLjMwNSwgMjIzLjUyNiAxMjEuNzk0IEMgMjI3LjQxOCAxMjUuOTYzLCAyMjkuMDk5IDEzMy4wNjMsIDIyOC45MDMgMTQ0LjUwMCBMIDIyOC43MzEgMTU0LjUwMCAyNzkuNjE2IDE1NS4xODYgQyAzMDcuNjAyIDE1NS41NjMsIDM1Mi40MTMgMTU2LjU3NSwgMzc5LjE5NiAxNTcuNDM2IEMgNDA1Ljk3OSAxNTguMjk2LCA0MzEuMDk4IDE1OSwgNDM1LjAxOCAxNTkgTCA0NDIuMTQ0IDE1OSA0NDEuNDk1IDE1My4yNTAgQyA0MzkuNDU4IDEzNS4xNzksIDQzMS40MDEgMTI1LjU1NCwgNDE1LjUwMCAxMjIuMTk0IEMgNDEyLjU1OCAxMjEuNTczLCAzODAuNjY1IDEyMC43MDAsIDMzOCAxMjAuMDc0IEMgMjk4LjEyNSAxMTkuNDg4LCAyNTUuNDg4IDExOC44NDAsIDI0My4yNTAgMTE4LjYzMyBDIDIzMS4wMTIgMTE4LjQyNSwgMjIxIDExOC40NDMsIDIyMSAxMTguNjcxIE0gNjA3LjY2MCAxMjcuMjUwIEMgNjAwLjIwMyAxNDMuMDA0LCA1OTcuODc4IDE1OS4yODksIDU5Ni4zODEgMjA2LjI1MCBMIDU5NS43ODMgMjI1IDU5My4xNDIgMjI1LjAxNSBDIDU5MS42ODkgMjI1LjAyNCwgNTg5LjgyNSAyMjUuNDcxLCA1ODkgMjI2LjAwOSBDIDU4Ny45NjcgMjI2LjY4MiwgNTg4LjkyNiAyMjYuNzk4LCA1OTIuMDgxIDIyNi4zODAgQyA1OTguNjc4IDIyNS41MDgsIDYwNi40NDcgMjI5Ljc4NCwgNjEyLjAyNyAyMzcuMzU4IEwgNjE0Ljg2OSAyNDEuMjE2IDYxNS4zODQgMjM3Ljg1OCBDIDYxNS42NjggMjM2LjAxMSwgNjE2LjIxMCAyMTkuNDI1LCA2MTYuNTg5IDIwMSBDIDYxNi45NjkgMTgyLjU3NSwgNjE3LjM3MiAxNjUuMjUwLCA2MTcuNDg0IDE2Mi41MDAgQyA2MTcuNjM5IDE1OC43MTcsIDYxNi45NjMgMTU1Ljk4NCwgNjE0LjcwNyAxNTEuMjczIEMgNjExLjg2MyAxNDUuMzM3LCA2MTEuNzI5IDE0NC40NjMsIDYxMS44MjMgMTMyLjUyMyBDIDYxMS44NzcgMTI1LjYzNSwgNjExLjczNCAxMjAsIDYxMS41MDYgMTIwIEMgNjExLjI3OCAxMjAsIDYwOS41NDcgMTIzLjI2MywgNjA3LjY2MCAxMjcuMjUwIE0gMTU3LjAxNyAxMjguMjg2IEMgMTU1LjY1MSAxMjguOTc3LCAxNTQuMTA2IDEzMC43NTcsIDE1My41ODQgMTMyLjI0MSBDIDE1MS42MjQgMTM3LjgxNCwgMTU5LjU2MCAxNDEuNDQwLCAxNjQgMTM3IEMgMTY2LjUzMyAxMzQuNDY3LCAxNjYuNTE4IDEzMi45MjksIDE2My45MjcgMTI5LjYzNSBDIDE2MS42MDIgMTI2LjY3OCwgMTYwLjU4NiAxMjYuNDgwLCAxNTcuMDE3IDEyOC4yODYgTSAxNzAuMTE1IDEzOC45NDUgQyAxNzAuMDUyIDEzOS43NDAsIDE2OC45MTcgMTQxLjU0MCwgMTY3LjU5NCAxNDIuOTQ1IEMgMTY1Ljg1MCAxNDQuNzk3LCAxNjQuODg2IDE0Ny40NzksIDE2NC4wOTQgMTUyLjY5MiBDIDE2Mi43NTMgMTYxLjUwOCwgMTYyLjY3MyAxOTAuNTk5LCAxNjMuOTQ5IDIwNS41MDAgQyAxNjQuNDY3IDIxMS41NTAsIDE2NS4zODkgMjIyLjU3NSwgMTY1Ljk5OSAyMzAgQyAxNjguMDg2IDI1NS40MjQsIDE3Mi45NzUgMjkwLjk4NiwgMTc4LjAyNyAzMTcuNTAwIEMgMTc5LjA3NiAzMjMsIDE4MS4wNDYgMzMzLjkwOCwgMTgyLjQwNiAzNDEuNzM5IEMgMTg1LjE0NyAzNTcuNTIwLCAxODkuMTE1IDM2Ni45NDIsIDE5NS45NDUgMzczLjg4NiBMIDE5OS41MDAgMzc3LjUwMCAxOTkuODEyIDM2OCBDIDIwMC4xNDcgMzU3Ljc4MCwgMTk2LjMyNyAzMjYsIDE5NC43NjMgMzI2IEMgMTk0LjI3OSAzMjYsIDE5NC4xNjAgMzI1LjU1MCwgMTk0LjUwMCAzMjUgQyAxOTQuODQwIDMyNC40NTAsIDE5NC41OTMgMzI0LCAxOTMuOTUxIDMyNCBDIDE5My4yMTUgMzI0LCAxOTMuMDA4IDMyMy4xMDUsIDE5My4zOTEgMzIxLjU3OSBDIDE5NC4zNjAgMzE3LjcxNywgMTkzLjE1OSAzMTYsIDE4OS40ODcgMzE2IEMgMTg1LjI2MyAzMTYsIDE4NS41ODYgMzEyLjMwMSwgMTg5Ljg1MiAzMTEuODA3IEMgMTkzLjA4NSAzMTEuNDMyLCAxOTMuMDY2IDMxMC4xOTYsIDE4OS4zODYgMjgxLjUwMCBDIDE4OC4wNDYgMjcxLjA1MCwgMTg1Ljg2NiAyNTEuNzAwLCAxODQuNTQyIDIzOC41MDAgQyAxODMuMjE4IDIyNS4zMDAsIDE4MS44ODkgMjEyLjQ3NSwgMTgxLjU4OSAyMTAgQyAxODAuMzgxIDIwMC4wNDAsIDE3OS4wMDggMTgxLjk5MSwgMTc4LjgxMSAxNzMuNTAwIEMgMTc4LjYzMyAxNjUuODIyLCAxNzguMjcwIDE2NC4wOTIsIDE3Ni4zNDAgMTYxLjcxOSBDIDE3My44NjggMTU4LjY4MSwgMTcyLjA0NyAxNTMuMjAwLCAxNzEuOTQ4IDE0OC41MDAgQyAxNzEuODc1IDE0NS4wNDgsIDE3MC4yODggMTM2Ljc3MywgMTcwLjExNSAxMzguOTQ1IE0gNjIyLjYyOSAxNjMuNjEwIEMgNjE5Ljc5MCAxOTYuMTE0LCA2MTkuMzc0IDMwMy42OTgsIDYyMS45NjMgMzM2IEMgNjIyLjUxNCAzNDIuODc1LCA2MjMuMjI0IDM1My4yMjUsIDYyMy41NDAgMzU5IEMgNjIzLjg1NyAzNjQuNzc1LCA2MjQuNDI3IDM3MS45NzUsIDYyNC44MDggMzc1IEwgNjI1LjUwMCAzODAuNTAwIDYzMS4yOTYgMzgxLjAxNiBDIDY0MC4xNDYgMzgxLjgwMywgNjQwLjk1NCAzODQuNDA4LCA2MzIuNDY4IDM4NC43OTYgQyA2MjguOTExIDM4NC45NTgsIDYyNiAzODUuNDQyLCA2MjYgMzg1Ljg2OSBDIDYyNiAzODcuMDM2LCA2MjkuMTgwIDQwNS40NjMsIDYyOS40MjkgNDA1LjczOSBDIDYyOS41NDggNDA1Ljg3MCwgNjQ5LjE4NyA0MDYuODg3LCA2NzMuMDcyIDQwNy45OTggQyA2OTYuOTU4IDQwOS4xMDksIDcyMy40NzUgNDEwLjQ2OCwgNzMyIDQxMS4wMTcgQyA4MDIuODU5IDQxNS41ODQsIDg1OC4yMjIgNDE4LjQxMiwgODYxLjM1NSA0MTcuNjI2IEMgODY0LjczOCA0MTYuNzc3LCA4NjYuODIxIDQxMi42MzAsIDg2Ny41MjkgNDA1LjMzNiBDIDg2Ny44NDAgNDAyLjEyNiwgODY4LjI4NyAzOTguMjYyLCA4NjguNTIzIDM5Ni43NTAgTCA4NjguOTUwIDM5NCA4NjEuNzI1IDM5My45OTUgQyA4NDYuMTg3IDM5My45ODQsIDgzNS4wNDEgMzkyLjgxNywgODM2LjUwMyAzOTEuMzU0IEMgODM3LjQ1MiAzOTAuNDA1LCA4NDAuNzA1IDM5MCwgODQ3LjM4MSAzOTAgTCA4NTYuOTA1IDM5MCA4NTIuMTE1IDM4NS4yMTEgQyA4NDcuMzI3IDM4MC40MjIsIDg0MyAzNzAuOTc0LCA4NDMgMzY1LjMwNiBDIDg0MyAzNjQuMDM4LCA4NDIuNTUwIDM2MywgODQyIDM2MyBDIDg0MS40NTAgMzYzLCA4NDEgMzYyLjUyMywgODQxIDM2MS45NDEgQyA4NDEgMzYxLjM1OSwgODQxLjQwMSAzNjEuMTMwLCA4NDEuODkwIDM2MS40MzIgQyA4NDIuMzgwIDM2MS43MzUsIDg0My4wNzMgMzYwLjI5OSwgODQzLjQzMSAzNTguMjQxIEMgODQ1LjIyOCAzNDcuODk5LCA4NTAuMjMxIDM0MC43NTIsIDg1OC4zNjUgMzM2LjkwNCBDIDg2MS43MzkgMzM1LjMwOCwgODY1LjQwMCAzMzMuOTk0LCA4NjYuNTAwIDMzMy45ODUgQyA4NjguMDA2IDMzMy45NzMsIDg2OC4xNjQgMzMzLjc1NywgODY3LjE0MSAzMzMuMTA4IEMgODY2LjE0OSAzMzIuNDgwLCA4NjUuOTczIDMzMS4xMTcsIDg2Ni40OTAgMzI4LjA1NiBDIDg2Ni44ODAgMzI1Ljc1MSwgODY3LjQ2OSAzMjQuMTM2LCA4NjcuODAwIDMyNC40NjcgQyA4NjguMTMxIDMyNC43OTgsIDg2OS44MzkgMzIyLjA1NiwgODcxLjU5NSAzMTguMzc0IEMgODc0LjU4MSAzMTIuMTE2LCA4NzQuODM2IDMxMC43MTMsIDg3NS41MDcgMjk2Ljg1MCBMIDg3Ni4yMjUgMjgyLjAyMSA4NzMuMTEzIDI3OC40NzYgQyA4NzEuNDAxIDI3Ni41MjYsIDg3MCAyNzQuNTk2LCA4NzAgMjc0LjE4OCBDIDg3MCAyNzIuMzc2LCA4NzMuMjkwIDI2OSwgODc1LjA1NyAyNjkgQyA4NzYuNjkzIDI2OSwgODc3IDI2OC4yOTAsIDg3NyAyNjQuNTAwIEMgODc3IDI2MC40NDYsIDg3Ni43NjggMjYwLCA4NzQuNjU1IDI2MCBDIDg3Mi4wMzcgMjYwLCA4NjkgMjU3LjE4NCwgODY5IDI1NC43NTYgQyA4NjkgMjUzLjg4NCwgODcxLjA5MSAyNTEuMzI5LCA4NzMuNjQ3IDI0OS4wODAgTCA4NzguMjk0IDI0NC45ODkgODc4Ljc3NCAyMTEuNjI0IEwgODc5LjI1NCAxNzguMjU5IDg3MS44NzcgMTc3LjYyNCBDIDg1MC4zMDIgMTc1Ljc2NiwgODE1LjQwMCAxNzIuNjYwLCA3OTEuNTAwIDE3MC40NzEgQyA3NTMuNTg4IDE2NywgNjczLjU0MSAxNjAuNDI1LCA2MzEuMzY2IDE1Ny4zMTggTCA2MjMuMjMxIDE1Ni43MTkgNjIyLjYyOSAxNjMuNjEwIE0gMTgzLjQ5OCAxNzcuMjUwIEMgMTg0LjEyNSAxOTEuNzc0LCAxODUuMDg1IDIwMi4zOTIsIDE4OS41MzcgMjQ0IEMgMTk0Ljg0OCAyOTMuNjM3LCAxOTUuODUxIDMwMC45NTQsIDE5Ny44NzAgMzA0Ljc4OSBDIDE5OC45NDUgMzA2LjgzMCwgMjAwLjA3NCAzMDkuMjg4LCAyMDAuMzgxIDMxMC4yNTAgQyAyMDAuNjk2IDMxMS4yNDAsIDIwMS45MjggMzEyLjAwMiwgMjAzLjIxOSAzMTIuMDA1IEMgMjA1LjM4MyAzMTIuMDA5LCAyMDUuMzMzIDMxMi4xNjYsIDIwMi4yNTAgMzE1LjA1NSBDIDE5OS4yOTggMzE3LjgyMiwgMTk4Ljk4OSAzMTguNjY5LCAxOTguODgyIDMyNC4zMDEgQyAxOTguNzg3IDMyOS4yNTEsIDE5OC42MTAgMzI5Ljg5NiwgMTk4IDMyNy41MDAgTCAxOTcuMjM3IDMyNC41MDAgMTk3LjExOCAzMjcuNzgxIEMgMTk3LjA0NyAzMjkuNzYzLCAxOTcuNTU1IDMzMS4yNzYsIDE5OC40MDIgMzMxLjYwMSBDIDE5OS4xNzMgMzMxLjg5NiwgMjAwLjA4OSAzMzMuNzk1LCAyMDAuNDM5IDMzNS44MTkgQyAyMDAuNzg4IDMzNy44NDQsIDIwMS41NTUgMzQxLjkzOCwgMjAyLjE0MiAzNDQuOTE3IEwgMjAzLjIxMSAzNTAuMzM0IDIwNi4zNTYgMzQ0LjQ2MSBDIDIxMC4xMTIgMzM3LjQ0NiwgMjE4LjY2MyAzMjguMzc0LCAyMjIuNDA0IDMyNy40MzUgQyAyMjcuMTAzIDMyNi4yNTUsIDIyNS4xOTAgMzI0LjQxNywgMjE0Ljc1NSAzMjAuMDg2IEMgMjA4LjU3MSAzMTcuNTIwLCAyMDYuOTc0IDMxNC4zNzYsIDIwOS4zMzYgMzA5LjQyMSBDIDIxMS42NzMgMzA0LjUyMiwgMjE3LjQxNCAzMDIuMDQ5LCAyMjYuNTAwIDMwMi4wMjggQyAyMzcuNjQ1IDMwMi4wMDEsIDI0MC41OTggMzAzLjIzMiwgMjQ4LjIxNiAzMTEuMDgxIEwgMjU0LjkzMiAzMTguMDAxIDI2NS43MTYgMzE2LjM4OCBDIDI3OC42NTAgMzE0LjQ1MywgMjg4LjMzMSAzMTUuMDEzLCAyOTQuNjI5IDMxOC4wNjMgQyAzMDUuMzkxIDMyMy4yNzIsIDMwNS40NDggMzMzLjkwNSwgMjk0Ljc1MiAzNDAuNzcxIEwgMjkwLjUwMCAzNDMuNTAwIDI5MC44MDMgMzQ5Ljk2NiBDIDI5MS4xOTIgMzU4LjI1NywgMjg5LjA1NyAzNjMuOTU2LCAyODMuMjI1IDM3MC4xOTAgQyAyNzguNjkwIDM3NS4wMzksIDI3MC42NjMgMzc5LCAyNjUuMzcxIDM3OSBDIDI2My45MDcgMzc5LCAyNjEuMTA0IDM4MC40NjcsIDI1OC44MDEgMzgyLjQzOCBDIDI1Ni41OTIgMzg0LjMzMCwgMjUyLjU1OCAzODYuNjc3LCAyNDkuODM3IDM4Ny42NTYgQyAyNDYuMTU4IDM4OC45NzksIDI0NS4zNDggMzg5LjU5NiwgMjQ2LjY3OSAzOTAuMDYzIEMgMjUwLjEwOCAzOTEuMjY2LCAyNDEuMzMxIDM5My4xNTQsIDIzMS40OTIgMzkzLjMzMCBDIDIyNi4yNzIgMzkzLjQyNCwgMjIyLjAwMSAzOTMuODM3LCAyMjIuMDAxIDM5NC4yNTAgQyAyMjIgMzk0LjY2MywgMjE5LjQ5NSAzOTUsIDIxNi40MzMgMzk1IEMgMjExLjU5MiAzOTUsIDIxMC45MzYgMzk1LjIyOCwgMjExLjQwNCAzOTYuNzUwIEMgMjExLjcwMSAzOTcuNzEyLCAyMTIuNjM1IDQwMS41MDksIDIxMy40NzkgNDA1LjE4NyBDIDIxNC4zMjQgNDA4Ljg2NSwgMjE1LjI1MyA0MTIuNDk1LCAyMTUuNTQ0IDQxMy4yNTMgQyAyMTYuMTk3IDQxNC45NTYsIDQzOS4xMDcgNDE1LjU0OCwgNDQyLjI3MSA0MTMuODU1IEMgNDQ1Ljg1NCA0MTEuOTM3LCA0NDYuMTgzIDQwOC41MDIsIDQ0NS4wMzIgMzg1LjAwOCBDIDQ0My41MjYgMzU0LjI2MSwgNDQ0LjUxMiAzNTcsIDQzNC45NTIgMzU3IEMgNDI4LjY4NCAzNTcsIDQyNy4xNzEgMzU2LjcxOSwgNDI3LjU4OCAzNTUuNjMwIEMgNDI3LjkzNiAzNTQuNzI1LCA0MzAuNDc5IDM1NC4wOTEsIDQzNS4wOTMgMzUzLjc2MSBDIDQzOC45MzEgMzUzLjQ4NywgNDQyLjI5NiAzNTMuMDM3LCA0NDIuNTcxIDM1Mi43NjMgQyA0NDIuODQ1IDM1Mi40ODgsIDQ0Mi4zOTEgMzQ0LjQ0MiwgNDQxLjU2MiAzMzQuODgyIEMgNDQwLjczMiAzMjUuMzIyLCA0MzguMDA5IDI4OC45MjUsIDQzNS41MTEgMjU0IEMgNDMzLjAxMyAyMTkuMDc1LCA0MzAuNDY1IDE4NS40ODcsIDQyOS44NDkgMTc5LjM2MSBMIDQyOC43MzAgMTY4LjIyMiA0MDkuMTE1IDE2Ny41OTYgQyAzNDQuODEyIDE2NS41NDQsIDIyNS44MjQgMTYzLjA1NiwgMTg5LjY5MiAxNjMuMDA5IEwgMTgyLjg4NCAxNjMgMTgzLjQ5OCAxNzcuMjUwIE0gNjM2LjM4NiAxNzUuNTIzIEMgNjMzLjYxMiAxNzguMjk3LCA2MzMuNTUxIDE4MS4yOTAsIDYzNi4yNTkgMTgxLjgxMSBDIDYzNy4zNzcgMTgyLjAyNywgNjM4LjM0MiAxODEuMjMxLCA2MzguOTcyIDE3OS41NzMgQyA2NDAuMDc0IDE3Ni42NzQsIDY0My4wNTggMTc2LjE2MCwgNjQ1LjAyNSAxNzguNTMwIEMgNjQ2Ljc3NyAxODAuNjQxLCA2NDUuNDc2IDE4My4xMzEsIDYzOC42MDQgMTkwLjgxMSBDIDYzNS40OTkgMTk0LjI4MywgNjMzLjIxOSAxOTcuNTQ1LCA2MzMuNTM4IDE5OC4wNjEgQyA2MzMuODU3IDE5OC41NzgsIDYzNy42OTEgMTk5LCA2NDIuMDU5IDE5OSBDIDY0OS4zMzMgMTk5LCA2NTAgMTk4LjgzMiwgNjUwIDE5NyBDIDY1MCAxOTUuMjgzLCA2NDkuMzMzIDE5NSwgNjQ1LjI5MiAxOTUgTCA2NDAuNTg0IDE5NSA2NDQuNjc1IDE5MC43NTAgQyA2NTEuNjc1IDE4My40NzksIDY1Mi42NjMgMTc5LjU3MiwgNjQ4LjU0NSAxNzUuNDU1IEMgNjQ1LjE3NSAxNzIuMDg0LCA2MzkuNzk1IDE3Mi4xMTQsIDYzNi4zODYgMTc1LjUyMyBNIDY3Ni4zMDggMTc2LjE5NCBDIDY3My40NDEgMTc3LjU4MCwgNjcyLjc1NCAxNzkuNTUxLCA2NzQuNjAyIDE4MS4wODUgQyA2NzUuNzI1IDE4Mi4wMTcsIDY3Ni4zNjYgMTgyLjAzNCwgNjc3LjI0MiAxODEuMTU4IEMgNjc4LjgwMSAxNzkuNTk5LCA2ODQuMDA0IDE3OS42NzAsIDY4My45ODUgMTgxLjI1MCBDIDY4My45NjIgMTgzLjA4MiwgNjgyLjc4NyAxODQuNTUwLCA2ODAuMjg3IDE4NS44NjYgQyA2NzcuNzA1IDE4Ny4yMjUsIDY3OC4xMDggMTg5LjEzNCwgNjgxLjI2OSAxOTAuNTIxIEMgNjg0LjQyNSAxOTEuOTA2LCA2ODQuMzUzIDE5Ni4zNzksIDY4MS4xNjggMTk2LjgzMCBDIDY3OS44ODUgMTk3LjAxMiwgNjc3Ljk4MSAxOTYuMzg3LCA2NzYuOTM2IDE5NS40NDIgQyA2NzUuNDIyIDE5NC4wNzIsIDY3NC43NDIgMTkzLjk2OSwgNjczLjU3OCAxOTQuOTM1IEMgNjcxLjY4NCAxOTYuNTA3LCA2NzIuNDc4IDE5OC40NDEsIDY3NS42MDIgMTk5Ljg2NSBDIDY4NC45NDcgMjA0LjEyMiwgNjkzLjgwNiAxOTYuMDMxLCA2ODcuNDk4IDE4OSBDIDY4Ni4zNjkgMTg3Ljc0MSwgNjg2LjM4MiAxODcuMTg4LCA2ODcuNTc2IDE4NS41NTkgQyA2OTIuMDkxIDE3OS40MDMsIDY4My44NDcgMTcyLjU1MiwgNjc2LjMwOCAxNzYuMTk0IE0gMzYyLjI2NSAxODkuMjUwIEMgMzUzLjk5MiAyMDUuNDkzLCAzNTQuMTMxIDIwNSwgMzU3LjgyOCAyMDUgQyAzNjAuMTY3IDIwNSwgMzYxLjI0MyAyMDQuMjUzLCAzNjIuODY3IDIwMS41MDAgQyAzNjQuNzk2IDE5OC4yMzIsIDM2NS4yNjggMTk4LCAzNzAuMDAyIDE5OCBDIDM3NS4wNTcgMTk4LCAzNzUuMDc2IDE5OC4wMTIsIDM3NyAyMDIuNTAwIEMgMzc4LjU0NCAyMDYuMTAzLCAzNzkuNDIzIDIwNywgMzgxLjQwNSAyMDcgQyAzODUuNDY0IDIwNywgMzg1LjM3MyAyMDUuNTQwLCAzODAuNDU1IDE5MS43MTggQyAzNzcuODY4IDE4NC40NDgsIDM3NS41OTYgMTc3LjkzOCwgMzc1LjQwNyAxNzcuMjUwIEMgMzc1LjIxOCAxNzYuNTYzLCAzNzMuNzAyIDE3NiwgMzcyLjAzOSAxNzYgQyAzNjkuMTY1IDE3NiwgMzY4LjY3OSAxNzYuNjU5LCAzNjIuMjY1IDE4OS4yNTAgTSAyMDAuMjA1IDE3OC41NTYgQyAxOTguMjgyIDE3OS4zNjUsIDE5Ni44MjcgMTgwLjg0MywgMTk2LjQ0MSAxODIuMzgwIEMgMTk1LjI5NCAxODYuOTUxLCAxOTguNjgyIDE4OC45MjMsIDIwMC41MTMgMTg0Ljc1MCBDIDIwMS42OTkgMTgyLjA0NywgMjA1Ljc0NSAxODEuMTczLCAyMDYuNjEyIDE4My40MzIgQyAyMDcuNzE0IDE4Ni4zMDIsIDIwNi4wNTkgMTg5Ljc3NSwgMjAwLjg5NyAxOTUuNDIzIEMgMTk0LjA2MSAyMDIuOTAyLCAxOTQuNTkyIDIwNCwgMjA1LjAzOCAyMDQgQyAyMTIuODY3IDIwNCwgMjEzLjEyOCAyMDMuOTI0LCAyMTIuODIwIDIwMS43NTAgQyAyMTIuNTU2IDE5OS44OTgsIDIxMS43MTggMTk5LjQxMiwgMjA4LjA3NyAxOTkgTCAyMDMuNjU1IDE5OC41MDAgMjA3LjgyNyAxOTMuNjg5IEMgMjEyLjI0NiAxODguNTk0LCAyMTMuMjU5IDE4NC4wODksIDIxMC43NTAgMTgwLjY4NyBDIDIwOC43ODYgMTc4LjAyNCwgMjAzLjg0NSAxNzcuMDI1LCAyMDAuMjA1IDE3OC41NTYgTSAyMzYuNTU2IDE3OS4xMzUgQyAyMzQuMTA1IDE4MS4wNjIsIDIzMy45OTIgMTgxLjQyMSwgMjM1LjM5MCAxODIuODE4IEMgMjM2Ljc4NyAxODQuMjE2LCAyMzcuMTI4IDE4NC4xOTQsIDIzOC44OTcgMTgyLjU5MyBDIDI0MS4zMDEgMTgwLjQxNywgMjQ1IDE4MS4yOTksIDI0NSAxODQuMDQ4IEMgMjQ1IDE4NS4yNTUsIDI0NC4wNzcgMTg2LjE5NCwgMjQyLjUwMCAxODYuNTg5IEMgMjM4Ljk2MiAxODcuNDc3LCAyMzkuMjYxIDE5MC41NDcsIDI0My4wMTMgMTkxLjg1NSBDIDI0Ni41MjIgMTkzLjA3OCwgMjQ3Ljc0MyAxOTUuMzk5LCAyNDUuOTg5IDE5Ny41MTMgQyAyNDQuNDMwIDE5OS4zOTEsIDI0MC45NjEgMTk5LjQyMywgMjM4LjQ0NCAxOTcuNTgzIEMgMjM1LjIwNCAxOTUuMjEzLCAyMzMuMzUxIDE5Ny42ODEsIDIzNi4xNDEgMjAwLjY1MCBDIDIzOS4zNDIgMjA0LjA1NywgMjQ1LjQ1MiAyMDMuOTAwLCAyNDkuMTk1IDIwMC4zMTMgQyAyNTIuNTM0IDE5Ny4xMTQsIDI1Mi43NTEgMTk0LjQyOCwgMjQ5LjkxNCAxOTEuNDA5IEMgMjQ4LjIzMiAxODkuNjE4LCAyNDguMDM5IDE4OC43OTYsIDI0OC45MTQgMTg3LjE2MCBDIDI1My4wMjEgMTc5LjQ4NiwgMjQzLjc1NyAxNzMuNDcxLCAyMzYuNTU2IDE3OS4xMzUgTSA2NjAuNjg4IDE4MC42NDYgQyA2NjAuMzA5IDE4MS4wMjQsIDY2MCAxODIuMTI4LCA2NjAgMTgzLjEwMCBDIDY2MCAxODQuMjgzLCA2NTkuMDkzIDE4NC45NzIsIDY1Ny4yNTkgMTg1LjE4NCBDIDY1My4yMTIgMTg1LjY1MSwgNjUyLjk3MyAxODguODQ1LCA2NTYuOTI1IDE4OS42MzUgQyA2NTguOTY3IDE5MC4wNDMsIDY2MCAxOTAuODQ0LCA2NjAgMTkyLjAxOCBDIDY2MCAxOTQuODkxLCA2NjIuODg3IDE5NS4yOTcsIDY2My41ODQgMTkyLjUyMiBDIDY2NC4wMDIgMTkwLjg1NywgNjY1LjAwNyAxOTAuMDIwLCA2NjYuODQ0IDE4OS44MDcgQyA2NzAuMzc5IDE4OS4zOTgsIDY3MC4zNTMgMTg2LjU5OSwgNjY2LjgxMSAxODYuMTg5IEMgNjY0Ljc1NyAxODUuOTUyLCA2NjQuMDQ4IDE4NS4yNjEsIDY2My44MTEgMTgzLjI2NyBDIDY2My40OTkgMTgwLjY0NCwgNjYxLjk3MSAxNzkuMzYyLCA2NjAuNjg4IDE4MC42NDYgTSAyMjIgMTg2LjQzNCBDIDIyMiAxODguMzQzLCAyMjEuNDA5IDE4OC45MzUsIDIxOS4yNTkgMTg5LjE4NCBDIDIxNS4yMTkgMTg5LjY1MCwgMjE0Ljg2NyAxOTMsIDIxOC44NTcgMTkzIEMgMjIxLjIxMSAxOTMsIDIyMS45MzAgMTkzLjQ4NywgMjIyLjE4MCAxOTUuMjUwIEMgMjIyLjM1NiAxOTYuNDg4LCAyMjMuMTc1IDE5Ny41MDAsIDIyNCAxOTcuNTAwIEMgMjI0LjgyNSAxOTcuNTAwLCAyMjUuNjQ0IDE5Ni40ODgsIDIyNS44MjAgMTk1LjI1MCBDIDIyNi4wNTEgMTkzLjYyMSwgMjI2LjgxMCAxOTMsIDIyOC41NzAgMTkzIEMgMjMyLjIwOCAxOTMsIDIzMS45MjEgMTg5LjIzOSwgMjI4LjI1MCAxODguODE2IEMgMjI2LjI4MSAxODguNTkwLCAyMjUuNDA5IDE4Ny44NjEsIDIyNS4xODAgMTg2LjI1MCBDIDIyNC43NDQgMTgzLjE3NywgMjIyIDE4My4zMzUsIDIyMiAxODYuNDM0IE0gODE2IDE4NC44MjMgQyA4MTYgMTg1LjI3NiwgODEyLjg1MCAxOTAuOTQ5LCA4MDkgMTk3LjQyOSBDIDgwMS4wNTEgMjEwLjgwOSwgODAxLjExOSAyMTAuNTk5LCA4MDQuNTI3IDIxMS4yNTAgQyA4MDYuNDgwIDIxMS42MjMsIDgwNy41MjUgMjExLjA3MSwgODA5LjEyOCAyMDguODIwIEMgODExLjA0OSAyMDYuMTIzLCA4MTEuNjEzIDIwNS45MjgsIDgxNi43MjUgMjA2LjIwMyBDIDgyMi4wNjIgMjA2LjQ5MCwgODIyLjI4NCAyMDYuNjE3LCA4MjMuMzczIDIxMCBDIDgyNC4zMjYgMjEyLjk1OSwgODI1LjAxNiAyMTMuNTQ5LCA4MjcuODM3IDIxMy44MjAgQyA4MzAuMjE1IDIxNC4wNDgsIDgzMS4wNzcgMjEzLjc2MSwgODMwLjgzNiAyMTIuODIwIEMgODMwLjY1MCAyMTIuMDk0LCA4MjguOTQxIDIwNS4zMTMsIDgyNy4wMzcgMTk3Ljc1MCBMIDgyMy41NzUgMTg0IDgxOS43ODcgMTg0IEMgODE3LjcwNCAxODQsIDgxNiAxODQuMzcxLCA4MTYgMTg0LjgyMyBNIDM2OC44MjQgMTg5LjAxMCBMIDM2Ny4xNDkgMTkzIDM3MC40MzUgMTkzIEwgMzczLjcyMiAxOTMgMzcyLjY1NCAxODkgQyAzNzEuMzI3IDE4NC4wMjgsIDM3MC45MTcgMTg0LjAyOSwgMzY4LjgyNCAxODkuMDEwIE0gMjU2IDE4OSBDIDI1NiAxOTAuODIyLCAyNTYuNjY3IDE5MSwgMjYzLjUwMCAxOTEgQyAyNzAuMzMzIDE5MSwgMjcxIDE5MC44MjIsIDI3MSAxODkgQyAyNzEgMTg3LjE3OCwgMjcwLjMzMyAxODcsIDI2My41MDAgMTg3IEMgMjU2LjY2NyAxODcsIDI1NiAxODcuMTc4LCAyNTYgMTg5IE0gMzkxLjU3NiAxOTAuNDkwIEMgMzg2LjgyNSAxOTUuMjQyLCAzODUuMDExIDIwMS4yNDksIDM4Ny40OTggMjAzLjk5NyBDIDM4OS41MzggMjA2LjI1MiwgMzk1Ljg0MSAyMDYuNzU5LCAzOTcuNzc2IDIwNC44MjQgQyAzOTguNjc4IDIwMy45MjIsIDM5OS4zODUgMjA0LjAzOCwgNDAwLjgwNSAyMDUuMzI0IEMgNDA0Ljg3OCAyMDkuMDEwLCA0MDUuNjYwIDIwNy43MDMsIDQwNS43ODUgMTk3IEwgNDA1LjkwMSAxODcgNDAwLjQ4NCAxODcgQyAzOTUuNjI5IDE4NywgMzk0LjcwNCAxODcuMzYyLCAzOTEuNTc2IDE5MC40OTAgTSA2OTUuMTg3IDE4OC43NTAgQyA2OTUuNDU4IDE5MC4xNzQsIDY5Ni43NzcgMTkwLjU1NSwgNzAyLjI2MCAxOTAuNzk2IEMgNzA4LjQ4MCAxOTEuMDY5LCA3MDkgMTkwLjkzNCwgNzA5IDE4OS4wNDYgQyA3MDkgMTg3LjE3OCwgNzA4LjM4NiAxODcsIDcwMS45MjcgMTg3IEMgNjk1LjczMCAxODcsIDY5NC44OTUgMTg3LjIxNywgNjk1LjE4NyAxODguNzUwIE0gMzk2LjMyMyAxOTMuNTQ1IEMgMzkyLjA1OSAxOTcuNTI0LCAzOTAuOTEyIDIwMS4yOTQsIDM5NC4xMDYgMjAwLjgzMiBDIDM5Ni42ODIgMjAwLjQ1OSwgNDAwLjM0MSAxOTUuMDEwLCAzOTkuODIzIDE5Mi4zMTkgQyAzOTkuNTQxIDE5MC44NTcsIDM5OS4wMDEgMTkxLjA0NywgMzk2LjMyMyAxOTMuNTQ1IE0gODE2LjMwMyAxOTUuMDE0IEMgODE0LjE3NSAxOTkuODQxLCA4MTQuNjQ3IDIwMC45NTcsIDgxOC44MjkgMjAwLjk4NSBDIDgyMC45MzggMjAwLjk5OSwgODIxLjA5MiAyMDAuNjkyLCA4MjAuNDUwIDE5Ny43NTAgQyA4MTguODU2IDE5MC40NDcsIDgxOC40MzkgMTkwLjE3MiwgODE2LjMwMyAxOTUuMDE0IE0gMjYwLjc1MCAxOTMuNzE1IEMgMjU3LjQ1NyAxOTMuOTg5LCAyNTYgMTk0LjU1MywgMjU2IDE5NS41NTUgQyAyNTYgMTk2LjY4OCwgMjU3LjYzNiAxOTcsIDI2My41NzMgMTk3IEMgMjcwLjI0NiAxOTcsIDI3MS4xMDcgMTk2Ljc5MiwgMjcwLjgxNSAxOTUuMjUwIEMgMjcwLjQ1NiAxOTMuMzU4LCAyNjguNTQ2IDE5My4wNjcsIDI2MC43NTAgMTkzLjcxNSBNIDY5NC4xODcgMTk0Ljc1MCBDIDY5NC40NjIgMTk2LjE5MSwgNjk1LjgwMCAxOTYuNTUyLCA3MDEuNzYxIDE5Ni43OTQgQyA3MDguNDgxIDE5Ny4wNjcsIDcwOSAxOTYuOTQxLCA3MDkgMTk1LjA0NCBDIDcwOSAxOTMuMTY1LCA3MDguMzg3IDE5MywgNzAxLjQyNyAxOTMgQyA2OTQuNzUzIDE5MywgNjkzLjg5MyAxOTMuMjA4LCA2OTQuMTg3IDE5NC43NTAgTSA4NDQuMTg2IDE5NS43NDAgQyA4NDIuOTE0IDE5NS45NjksIDgzOS44NzYgMTk4LjA2OSwgODM3LjQzNiAyMDAuNDA2IEMgODMzLjYxOCAyMDQuMDY1LCA4MzMgMjA1LjIyMSwgODMzIDIwOC43MDcgQyA4MzMgMjE0LjA1OCwgODM3LjExNSAyMTYuMjY5LCA4NDIuMzkxIDIxMy43NTMgQyA4NDUuMjM4IDIxMi4zOTYsIDg0NS43NTQgMjEyLjM4NiwgODQ2LjU3MCAyMTMuNjczIEMgODQ3LjA4MSAyMTQuNDgxLCA4NDguNDAwIDIxNS4yMjMsIDg0OS41MDAgMjE1LjMyMSBDIDg1MS4xNzcgMjE1LjQ3MSwgODUxLjQ1MCAyMTQuOTgyLCA4NTEuMTkyIDIxMi4yOTIgQyA4NTEuMDIyIDIxMC41MjcsIDg1MS4zNjEgMjA2LjUwMSwgODUxLjk0NCAyMDMuMzQ0IEMgODUyLjUyOCAyMDAuMTg4LCA4NTIuNjY2IDE5Ny4zMDIsIDg1Mi4yNTMgMTk2LjkzMiBDIDg1MS4xMTIgMTk1LjkxMSwgODQ2Ljc4NyAxOTUuMjcyLCA4NDQuMTg2IDE5NS43NDAgTSA4NDEuOTIzIDIwMi45MjMgQyA4MzguODMwIDIwNi4wMTYsIDgzOC4wMDUgMjEwLCA4NDAuNDU4IDIxMCBDIDg0MS43MjcgMjEwLCA4NDcgMjAyLjQ3MywgODQ3IDIwMC42NjIgQyA4NDcgMTk5LjE0NiwgODQ0LjY1NyAyMDAuMTg5LCA4NDEuOTIzIDIwMi45MjMgTSAyNDUuNjI1IDIyNy40NTEgQyAyMzEuNzEyIDIzNC4yNjYsIDIyMi41NDIgMjUyLjgwOCwgMjI3LjQyNiAyNjQuMjUwIEMgMjI4LjkzNSAyNjcuNzg1LCAyMzAuODg3IDI2OS43NTQsIDIyOS42MjcgMjY2LjQ3MCBDIDIyOC44NTUgMjY0LjQ1OSwgMjMxLjU0NSAyNTEuODAwLCAyMzMuNjEyIDI0Ny43MTEgQyAyMzkuNjY1IDIzNS43NDEsIDI1Mi43NjggMjI4Ljg2MCwgMjU4LjkxNiAyMzQuNDI0IEMgMjYzLjk0NiAyMzguOTc2LCAyNTguODQ2IDI0Ny4zNTUsIDI1MS45ODQgMjQ1LjgxMiBDIDI0OS44OTYgMjQ1LjM0MiwgMjQ3Ljk0NSAyNTEuNzY5LCAyNDguNTg5IDI1NyBDIDI0OS43MzggMjY2LjM0NCwgMjU2LjczNyAyNzIuOTkwLCAyNjUuNDM0IDI3Mi45OTYgQyAyODUuMjI4IDI3My4wMTEsIDI5My4xNjUgMjQ2Ljk3MiwgMjc3LjgzOCAyMzIuMzA3IEMgMjY5LjkwMyAyMjQuNzE0LCAyNTUuNjA5IDIyMi41NjAsIDI0NS42MjUgMjI3LjQ1MSBNIDM1OC41OTAgMjMxLjQxNSBDIDM0OS4yNjkgMjM1LjM0NSwgMzM5LjMxNCAyNDYuMjYzLCAzNDIuMDQ4IDI0OS41NTggQyAzNDMuMTE3IDI1MC44NDYsIDM0NC4wOTAgMjUwLjIyNywgMzQ4Ljg5NyAyNDUuMjAyIEMgMzU3LjAwNCAyMzYuNzI3LCAzNjYuMDE4IDIzMy44NjcsIDM3MS4zNjUgMjM4LjA3MyBDIDM3Ni42NDggMjQyLjIyOCwgMzczLjc1MSAyNDksIDM2Ni42OTAgMjQ5IEMgMzYyLjMyOSAyNDksIDM2MS41MDAgMjUwLjk2MCwgMzYyLjIxNSAyNTkuNTgxIEMgMzYzLjY5MSAyNzcuMzgxLCAzODUuNDI5IDI4NC40MjIsIDM5Ni40MjYgMjcwLjY2MSBDIDQwMC40OTQgMjY1LjU3MCwgNDAxLjM4MyAyNTMuOTE2LCAzOTguMjQ1IDI0Ni44MjAgQyAzOTEuNzI1IDIzMi4wODEsIDM3My42NTggMjI1LjA2MiwgMzU4LjU5MCAyMzEuNDE1IE0gNTg4LjU4OSAyMzMuMDc3IEMgNTg2LjAwOSAyMzYuMTQzLCA1ODUuMzM1IDIzOS40MDUsIDU4Ni44MDQgMjQxLjcxOCBDIDU4Ny4zMDYgMjQyLjUwOCwgNTkxLjI1MSAyNDMuMDU4LCA1OTguMDM5IDI0My4yODQgQyA2MTMuOTIwIDI0My44MTMsIDYxOS42NTYgMjQ4LCA2MDQuNTAwIDI0OCBMIDU5NiAyNDggNTk2IDI1MS42MTcgQyA1OTYgMjU0LjY3NiwgNTk2LjI5MiAyNTUuMTU3LCA1OTcuODk5IDI1NC43MzcgQyA2MDAuNzA5IDI1NC4wMDIsIDYxMC4zMDggMjU2Ljc0MywgNjExLjc1MCAyNTguNjkyIEMgNjEzLjkwMiAyNjEuNjAyLCA2MTMuMjE1IDI2Mi43MjgsIDYwNS4wMzYgMjY5LjcwNiBMIDU5Ny4wNzIgMjc2LjUwMCA1OTcuMDQyIDI4NiBDIDU5Ni45OTYgMzAwLjI2NiwgNTk5LjgzNCAzNDUuNDM0LCA2MDAuOTYzIDM0OC40MDMgQyA2MDEuNjcyIDM1MC4yNjcsIDYwMi42NzQgMzUxLCA2MDQuNTE1IDM1MSBDIDYwOC4wMjYgMzUxLCA2MTQuMzY5IDM1NC4zODMsIDYxNi45MDUgMzU3LjYwNyBDIDYxOC4wNTcgMzU5LjA3MSwgNjE4Ljk5MCAzNTkuODcyLCA2MTguOTc4IDM1OS4zODUgQyA2MTguOTY2IDM1OC44OTgsIDYxOC4zMDIgMzQ3LjcwMCwgNjE3LjUwMyAzMzQuNTAwIEMgNjE2LjcwNSAzMjEuMzAwLCA2MTUuNzQxIDI5NS45NDQsIDYxNS4zNjIgMjc4LjE1NCBMIDYxNC42NzMgMjQ1LjgwNyA2MDguNTU1IDIzOS40NDQgQyA1OTkuMjc4IDIyOS43OTUsIDU5My4wMjggMjI3LjgwMSwgNTg4LjU4OSAyMzMuMDc3IE0gNjc1LjYyNCAyMzguOTMyIEMgNjY4Ljc1MCAyNDEuNzEwLCA2NjMuNzcwIDI0NS4zOTUsIDY2MC4yODEgMjUwLjI4NyBDIDY1My44MjcgMjU5LjMzNCwgNjUzLjA0OSAyNjIuODg2LCA2NTcuMDUyIDI2NS4wMjggQyA2NjEuMDkwIDI2Ny4xODksIDY2My41NDYgMjY2LjE4MCwgNjY2LjkxOCAyNjAuOTc4IEMgNjc3LjE0NyAyNDUuMTkxLCA2OTYuOTkwIDI0NS40OTgsIDcwOC4wNzkgMjYxLjYxNSBDIDcxMi40NjIgMjY3Ljk4NiwgNzE3LjAxNiAyNjcuMDgyLCA3MTUuMzU3IDI2MC4xNzEgQyA3MTEuMzY3IDI0My41NDksIDY5MS4wNjEgMjMyLjY5NCwgNjc1LjYyNCAyMzguOTMyIE0gODg1IDI0NS45NzEgQyA4ODEuOTc1IDI0Ny41NTMsIDg3Ny45MjUgMjUwLjE4NiwgODc2IDI1MS44MjQgTCA4NzIuNTAwIDI1NC44MDIgODc2IDI1NS4zNTAgQyA4ODIuMTQwIDI1Ni4zMDksIDg5Ny41OTMgMjU2Ljg3MSwgODk4LjY2NiAyNTYuMTczIEMgOTAwLjYzMSAyNTQuODk1LCA5MDIuMTA5IDI1MC45MTcsIDkwMS40MzcgMjQ4LjcxMiBDIDg5OS40ODAgMjQyLjI4NywgODkzLjg0NiAyNDEuMzQ3LCA4ODUgMjQ1Ljk3MSBNIDc5Ny41MDAgMjQ1Ljg3MiBDIDc4OC4yMjQgMjQ4LjI5NywgNzc5LjQ0NiAyNTUuNjQ2LCA3NzYuNDQ3IDI2My41MDAgQyA3NzUuMDYzIDI2Ny4xMjQsIDc3NC45NzYgMjY4LjI2NiwgNzc1Ljk5MSAyNjkuNDg5IEMgNzc3Ljk0NSAyNzEuODQzLCA3NzkuNDEwIDI3MS4zMTgsIDc4Mi44NTggMjY3LjAyNyBDIDc5NC43NzQgMjUyLjE5OSwgODE3LjExMyAyNTQuNjM2LCA4MjMuNTQwIDI3MS40NjUgQyA4MjUuNTU0IDI3Ni43MzksIDgyOC43MjQgMjc4LjIyNywgODMyLjkyNCAyNzUuODY5IEMgODM2LjQyOCAyNzMuOTAyLCA4MzYuNTY2IDI3MS45MTcsIDgzMy42NDMgMjY1LjUzMiBDIDgyNy4wMzMgMjUxLjA5MywgODEwLjk2MyAyNDIuMzUyLCA3OTcuNTAwIDI0NS44NzIgTSA1ODUuNjU1IDI2MC44MjkgQyA1ODMuMzMxIDI2My4zOTcsIDU4My41NTcgMjY4LjU1NywgNTg2LjEwNCAyNzEuMTA0IEMgNTg5LjE4MCAyNzQuMTgwLCA1OTIuOTA5IDI3My4wMjMsIDYwMi4xNTggMjY2LjEyMyBMIDYxMC4wMjQgMjYwLjI1NSA2MDYuODg3IDI1OS42MjcgQyA1OTkuNzg0IDI1OC4yMDcsIDU4Ny4zOTMgMjU4LjkwOCwgNTg1LjY1NSAyNjAuODI5IE0gODc0LjY1MyAyNzIuNzUyIEMgODczLjkxNyAyNzMuOTQzLCA4ODguNzM5IDI4Ni44OTYsIDg5MS42ODUgMjg3LjYzNiBDIDg5Ni45MDAgMjg4Ljk0NSwgOTAxLjEzNiAyODAuMzAzLCA4OTcuNjMwIDI3NS41MDggQyA4OTUuNzczIDI3Mi45NjksIDg3NS45ODYgMjcwLjU5NiwgODc0LjY1MyAyNzIuNzUyIE0gNTg4LjI1MCAyNzguNjg5IEMgNTg5LjIxMiAyNzguOTQxLCA1OTAuNzg4IDI3OC45NDEsIDU5MS43NTAgMjc4LjY4OSBDIDU5Mi43MTIgMjc4LjQzOCwgNTkxLjkyNSAyNzguMjMyLCA1OTAgMjc4LjIzMiBDIDU4OC4wNzUgMjc4LjIzMiwgNTg3LjI4OCAyNzguNDM4LCA1ODguMjUwIDI3OC42ODkgTSA3MTAuMzA4IDI4Mi4wMTAgQyA3MDAuMTk0IDI4Ni4wODQsIDcwNC4xNjggMzEzLjg4NSwgNzE2LjkxMyAzMjguMjEzIEMgNzIzLjgzMCAzMzUuOTkwLCA3MzIuMjUwIDMzOS41MDAsIDc0My45ODUgMzM5LjUwMCBDIDc1NC44OTQgMzM5LjUwMCwgNzYwLjU1NSAzMzcuMTcwLCA3NjguNTcwIDMyOS4zODAgQyA3ODAuMTA2IDMxOC4xNjksIDc4Ni44MTAgMjk3LjU4NCwgNzgxLjMyMSAyOTAuMjI2IEMgNzc4LjY0MCAyODYuNjMxLCA3NzcuNjg4IDI4Ni41MTksIDc2Mi42NzYgMjg4LjA0MSBDIDc0Ny4zMjEgMjg5LjU5NywgNzM3LjQ4MiAyODguNjAzLCA3MjIuOTk4IDI4NC4wMzIgQyA3MTIuMzU4IDI4MC42NzUsIDcxMy4yNjMgMjgwLjgxOSwgNzEwLjMwOCAyODIuMDEwIE0gMzE1LjI1MyAyOTIuOTMyIEMgMzEwLjQwMiAyOTYuNDQ2LCAzMDUuNTc2IDMwMi41MDYsIDMwNi40NzMgMzAzLjk1NyBDIDMwNy42MDIgMzA1Ljc4MywgMzEwLjU3MyAzMDUuMDg0LCAzMTMuMDc2IDMwMi40MDUgQyAzMTkuMTY4IDI5NS44ODQsIDMyNC4zNzggMjk1LjkzOCwgMzI4LjkxMiAzMDIuNTY5IEMgMzMxLjQ0MCAzMDYuMjY2LCAzMzUuMTkwIDMwNy4wMjIsIDMzNS43NzQgMzAzLjk1MiBDIDMzNi4xODQgMzAxLjgwMiwgMzMwLjkzMyAyOTQuMjU0LCAzMjcuNDE0IDI5MS45MzQgQyAzMjMuMzM5IDI4OS4yNDgsIDMxOS45NTUgMjg5LjUyNSwgMzE1LjI1MyAyOTIuOTMyIE0gMjIwLjUwOCAzMDkuMzA4IEMgMjE1LjA3NSAzMTEuMDExLCAyMTQuODI3IDMxMy4zMzIsIDIxOS45MTQgMzE0Ljg1NiBDIDIzMC4wODUgMzE3LjkwMywgMjMyLjkxNiAzMjMuMDQzLCAyMzIuNzAxIDMzOC4wNjkgQyAyMzIuNTUyIDM0OC40NDYsIDIzMi43NzQgMzUwLjAwNywgMjM1LjEwOSAzNTUgQyAyMzguNzE2IDM2Mi43MTUsIDI0Mi4yMDUgMzY2LjQ2NCwgMjQ4Ljc2NiAzNjkuNjc0IEMgMjY1LjEzNyAzNzcuNjgzLCAyODUuMDQwIDM2Ny44NjEsIDI4NC45ODUgMzUxLjgwMCBDIDI4NC45NjQgMzQ1LjQ2MywgMjgzLjE4MCAzNDIuNzk0LCAyNzcuNDMyIDM0MC41MDAgQyAyNjkuOTg2IDMzNy41MjgsIDI3MC44MTEgMzM2LjU2MiwgMjgxLjI4MCAzMzYgQyAyOTQuMDk1IDMzNS4zMTIsIDI5OC4zNDMgMzMyLjI0NiwgMjk1LjAzOCAzMjYuMDcxIEMgMjkyLjUwNyAzMjEuMzQxLCAyNzMuMzAyIDMxOS44MjYsIDI2MC4zNTYgMzIzLjMzNSBDIDI1MS4wMDkgMzI1Ljg2OCwgMjUwLjQyOSAzMjUuNzA5LCAyNDYuNDgyIDMxOS41MzkgQyAyNDAuNjY4IDMxMC40NTAsIDIzMC4xMTkgMzA2LjI5NSwgMjIwLjUwOCAzMDkuMzA4IE0gODkxLjQ5MyAzMTAuMzUxIEMgODg1LjYxMSAzMTMuMDkwLCA4ODAuNjY1IDMxOC4zNzYsIDg3Ny4zNzggMzI1LjQzNSBDIDg3NC4zNzggMzMxLjg3OCwgODc0LjQwOCAzMzUuMTg3LCA4NzcuNTMxIDM0MS44OTUgQyA4ODAuNzQ2IDM0OC44MDIsIDg4MC4xMTIgMzQ5LjI4MCwgODc0LjU0MyAzNDQuMTQ2IEMgODY5LjMxMyAzMzkuMzI1LCA4NjYuNDUzIDMzOC45NDMsIDg2MC41MDAgMzQyLjI2NiBDIDg1MS41NTkgMzQ3LjI1OSwgODQ4LjYzMCAzNjIuOTgwLCA4NTQuNTgzIDM3NC4wMjYgQyA4NTkuMDM1IDM4Mi4yODcsIDg2NC44NjkgMzg1LjUwMCwgODc1LjQxOCAzODUuNTAwIEMgODc5Ljg2MyAzODUuNTAwLCA4ODQuNzgyIDM4NS4xNDMsIDg4Ni4zNDggMzg0LjcwNiBDIDg5MC43MjAgMzgzLjQ4OCwgODg5LjIwNiAzODUuOTc5LCA4ODMuOTMxIDM4OC42ODMgQyA4NzcuOTI3IDM5MS43NjAsIDg3NyAzOTIuNjc1LCA4NzcgMzk1LjUyMyBMIDg3NyAzOTcuOTY3IDg4My41MzYgMzk1LjU5NSBDIDkwNy4zODMgMzg2LjkzOCwgOTEzLjU1MyAzNjYuOTAwLCA4OTkuNTM2IDM0My42MjkgQyA4OTUuMTUzIDMzNi4zNTIsIDg5NS4xNDcgMzM2LjU0OSwgODk5Ljk5MCAzMjkuNjM2IEMgOTA1LjU4NyAzMjEuNjQ1LCA5MDcgMzE4LjYxNywgOTA3IDMxNC42MDYgQyA5MDcgMzA3Ljk2NiwgOTAwLjQ2NSAzMDYuMTczLCA4OTEuNDkzIDMxMC4zNTEgTSA1NzcuNDQxIDMyNC41NTggQyA1NzAuMTU3IDMyOC45MTksIDU2MC41NzggMzM4LjExOSwgNTU3LjcxNyAzNDMuNTAwIEMgNTUyLjczMCAzNTIuODgxLCA1NTUuNjUxIDM2OC41ODQsIDU2My45MjIgMzc2Ljg1NSBMIDU2Ny40ODcgMzgwLjQyMCA1NjguMTgxIDM3NS41NjggQyA1NjkuNDY2IDM2Ni41ODUsIDU3Mi44MDkgMzYwLjU5OSwgNTc5LjA4MCAzNTYuMDU3IEwgNTgyLjg5NyAzNTMuMjkyIDU3OS40NDggMzQ5Ljk1MCBDIDU3NS4wMzQgMzQ1LjY3MSwgNTc1LjEwMCAzNDQuOTIxLCA1NzkuNzUwIDM0Ni41NDUgQyA1ODUuODI0IDM0OC42NjcsIDU4Ni4zMjQgMzQ3LjQ5MiwgNTg1LjQ2NiAzMzMuMTE5IEMgNTg1LjA2OSAzMjYuNDU0LCA1ODQuNDM3IDMyMSwgNTg0LjA2MyAzMjEgQyA1ODMuNjg4IDMyMSwgNTgwLjcwOSAzMjIuNjAxLCA1NzcuNDQxIDMyNC41NTggTSAyMjAuMDI5IDMzNy45NzEgQyAyMTIuMzc1IDM0NS42MjUsIDIwNy4xMzUgMzYwLjA0OCwgMjA4LjU1OSAzNjkuNTQ0IEMgMjA5LjQ1NyAzNzUuNTMwLCAyMTIuODAxIDM3OS40MDQsIDIxOC40MzEgMzgwLjk4MSBDIDIyNi41MDcgMzgzLjI0MiwgMjQ4LjE1MCAzODEuMTIzLCAyNDcuOTY0IDM3OC4wODkgQyAyNDcuOTQ0IDM3Ny43NjUsIDI0NS42MDIgMzc1LjkyNSwgMjQyLjc1OSAzNzQgQyAyMzIuNzA2IDM2Ny4xOTIsIDIyNy4zMTMgMzU2LjgxMSwgMjI2LjI4OCAzNDIuMjkzIEMgMjI1Ljk2NiAzMzcuNzMyLCAyMjUuMzIwIDMzNCwgMjI0Ljg1MSAzMzQgQyAyMjQuMzgzIDMzNCwgMjIyLjIxMyAzMzUuNzg3LCAyMjAuMDI5IDMzNy45NzEgTSA1ODcuNjI1IDM1OC40NjkgQyA1NzUuODc3IDM2Mi42NTcsIDU3MS43OTMgMzc2LjYyOCwgNTc4LjEyMCAzOTAuOTg4IEMgNTg0LjY5OCA0MDUuOTE0LCA2MDEuNzEyIDQwOC4yMDMsIDYxMi43MzkgMzk1LjY0NSBDIDYyMi4zMjAgMzg0LjczMywgNjE4LjI4OCAzNzQuMDU5LCA2MDQuMjQ5IDM3My4xNjUgQyA1OTcuNDIwIDM3Mi43MzAsIDU5Ni4yNjQgMzcxLjEwNywgNjAxLjgyOCAzNjkuNzY1IEMgNjAzLjU3MyAzNjkuMzQ0LCA2MDYuNDYyIDM2OC42NDgsIDYwOC4yNTAgMzY4LjIxOCBDIDYxMy4xNjEgMzY3LjAzNywgNjEzLjQ3NyAzNjEuODcxLCA2MDguODEyIDM1OS4wMjcgQyA2MDQuODI0IDM1Ni41OTUsIDU5My43MDMgMzU2LjMwMywgNTg3LjYyNSAzNTguNDY5IE0gODM1LjI1MCAzNjIuNjg5IEMgODM2LjIxMiAzNjIuOTQxLCA4MzcuNzg4IDM2Mi45NDEsIDgzOC43NTAgMzYyLjY4OSBDIDgzOS43MTIgMzYyLjQzOCwgODM4LjkyNSAzNjIuMjMyLCA4MzcgMzYyLjIzMiBDIDgzNS4wNzUgMzYyLjIzMiwgODM0LjI4OCAzNjIuNDM4LCA4MzUuMjUwIDM2Mi42ODkgTSA2MTguNjUxIDM2OS40NjggQyA2MTguMzQxIDM3MC4yNzUsIDYxOC41MTggMzcxLjIwMiwgNjE5LjA0NCAzNzEuNTI3IEMgNjE5LjU3MCAzNzEuODUyLCA2MjAgMzcxLjE5MSwgNjIwIDM3MC4wNTkgQyA2MjAgMzY3LjY0NCwgNjE5LjQ0NCAzNjcuNDAxLCA2MTguNjUxIDM2OS40NjggTSAxODkuNTE2IDM4My4wMzIgQyAxOTAuNzUwIDM5Mi4wNzQsIDE5MC43MDcgMzkyLjAwMSwgMTk0Ljc2OSAzOTEuOTg5IEMgMjAyLjY2OCAzOTEuOTY2LCAyMDYuMDM1IDM5MC45MzQsIDIwNC45MzMgMzg4Ljg3NCBDIDIwNC4zODEgMzg3Ljg0MywgMjAzLjIxMSAzODcsIDIwMi4zMzMgMzg3IEMgMjAwLjQ3MyAzODcsIDE5NC41MTMgMzgzLjU4MywgMTkxLjIwMyAzODAuNjIwIEwgMTg4LjkwNyAzNzguNTY0IDE4OS41MTYgMzgzLjAzMiBNIDQwOSAzODcgQyA0MDQuNzk4IDM4Ny41MTUsIDQwNC4zMjYgMzg3LjcxNiwgNDA3IDM4Ny44NTIgQyA0MDkuNjc4IDM4Ny45ODksIDQxMC4xNDggMzg4LjI2MiwgNDA5IDM4OS4wMTQgQyA0MDcuOTk0IDM4OS42NzQsIDQxMy4yNTUgMzg5LjkxNiwgNDI0Ljk4NyAzODkuNzQ5IEMgNDQwLjczMSAzODkuNTI1LCA0NDIuNTA4IDM4OS4zMjYsIDQ0Mi44MTEgMzg3Ljc1MCBDIDQ0My4xMTkgMzg2LjE0MywgNDQxLjk3NSAzODYuMDEzLCA0MjguODIzIDM4Ni4xNjMgQyA0MjAuOTQ1IDM4Ni4yNTMsIDQxMi4wMjUgMzg2LjYyOSwgNDA5IDM4NyBNIDIxMCAzOTAuMTczIEMgMjEwIDM5MC42MjgsIDIxMS4zNTAgMzkxLCAyMTMgMzkxIEMgMjE0LjY1MCAzOTEsIDIxNiAzOTAuODI2LCAyMTYgMzkwLjYxMyBDIDIxNiAzOTAuNDAxLCAyMTQuNjUwIDM5MC4wMjksIDIxMyAzODkuNzg3IEMgMjExLjM1MCAzODkuNTQ1LCAyMTAgMzg5LjcxOCwgMjEwIDM5MC4xNzMgTSAyNDAuMjUwIDM5MC42ODkgQyAyNDEuMjEzIDM5MC45NDEsIDI0Mi43ODcgMzkwLjk0MSwgMjQzLjc1MCAzOTAuNjg5IEMgMjQ0LjcxMyAzOTAuNDM4LCAyNDMuOTI1IDM5MC4yMzIsIDI0MiAzOTAuMjMyIEMgMjQwLjA3NSAzOTAuMjMyLCAyMzkuMjg3IDM5MC40MzgsIDI0MC4yNTAgMzkwLjY4OSBNIDc5Ny4yODcgMzkwLjc0MCBDIDgwMC40NjkgMzkwLjkzOSwgODA1LjQxOSAzOTAuOTM3LCA4MDguMjg3IDM5MC43MzYgQyA4MTEuMTU0IDM5MC41MzUsIDgwOC41NTAgMzkwLjM3MiwgODAyLjUwMCAzOTAuMzc0IEMgNzk2LjQ1MCAzOTAuMzc2LCA3OTQuMTA0IDM5MC41NDEsIDc5Ny4yODcgMzkwLjc0MCBNIDIyMy43NzYgMzkxLjczMyBDIDIyNi4xMjggMzkxLjk0NSwgMjI5LjcyOCAzOTEuOTQyLCAyMzEuNzc2IDM5MS43MjcgQyAyMzMuODI0IDM5MS41MTIsIDIzMS45MDAgMzkxLjMzOSwgMjI3LjUwMCAzOTEuMzQzIEMgMjIzLjEwMCAzOTEuMzQ2LCAyMjEuNDI0IDM5MS41MjIsIDIyMy43NzYgMzkxLjczMyBNIDE5MiAzOTcuOTA3IEMgMTkyIDQwMy4xODQsIDE5NC4xNTIgNDExLjE1MiwgMTk2LjEwNSA0MTMuMTA1IEMgMTk3LjU3NSA0MTQuNTc1LCAxOTkuNDU0IDQxNSwgMjA0LjQ3NSA0MTUgTCAyMTAuOTUwIDQxNSAyMTAuMzAxIDQxMS43NTAgQyAyMDkuOTQ0IDQwOS45NjIsIDIwOC45MTUgNDA1LjU3NSwgMjA4LjAxNSA0MDIgTCAyMDYuMzc5IDM5NS41MDAgMTk5LjE4OSAzOTUuMjA2IEwgMTkyIDM5NC45MTIgMTkyIDM5Ny45MDcgTSA2MTkuMzA0IDQwMC41MDggQyA2MTUuNzE4IDQwNS4yOTMsIDYxNS44OTMgNDA2LCA2MjAuNjY3IDQwNiBDIDYyMy43NzUgNDA2LCA2MjMuOTk1IDQwNS43ODEsIDYyMy45MzAgNDAyLjc1MCBDIDYyMy43OTEgMzk2LjM0NiwgNjIyLjc4NyAzOTUuODYwLCA2MTkuMzA0IDQwMC41MDggTSA3MTIuNjY2IDQyNS42NjMgQyA3MTIuNTc1IDQyNS43NTMsIDcxMi42MzcgNDMxLjk0MSwgNzEyLjgwNCA0MzkuNDEzIEwgNzEzLjEwOCA0NTMgNzMwLjExNCA0NTMgTCA3NDcuMTIwIDQ1MyA3NDYuNDM5IDQ0MC43NTAgQyA3NDYuMDY1IDQzNC4wMTIsIDc0NS40NzUgNDI4LjE5OSwgNzQ1LjEyOSA0MjcuODMxIEMgNzQ0LjYwMiA0MjcuMjcxLCA3MTMuMTY3IDQyNS4xNzIsIDcxMi42NjYgNDI1LjY2MyBNIDI5My4zNTIgNDMyLjI1MCBDIDI5My42OTkgNDM1LjEzNywgMjkzLjk4NyA0NDAuOTg4LCAyOTMuOTkxIDQ0NS4yNTAgTCAyOTQgNDUzIDMxMS41MDAgNDUzIEwgMzI5IDQ1MyAzMjguOTkzIDQ0Ni43NTAgQyAzMjguOTg5IDQ0My4zMTMsIDMyOC42OTkgNDM3LjQ2MiwgMzI4LjM0OCA0MzMuNzUwIEwgMzI3LjcxMSA0MjcgMzEwLjIxNiA0MjcgTCAyOTIuNzIxIDQyNyAyOTMuMzUyIDQzMi4yNTAgTSA2NjMgNDMzLjUwNyBDIDY2MyA0MzUuMDE4LCA2NjQuMTA2IDQzNS45NTEsIDY2Ny4xNzcgNDM3LjAzMSBDIDY3My42NjAgNDM5LjMxMSwgNjczLjI2MyA0NDEsIDY2Ni4yNDMgNDQxIEMgNjU0LjU1OSA0NDEsIDY0NCA0NDguNzU5LCA2NDQgNDU3LjM0NSBDIDY0NCA0NjQuNDc1LCA2NTUuMjk5IDQ2Ny4yMDksIDY3Ni4zOTQgNDY1LjE4NCBDIDY5Ni45MjggNDYzLjIxMywgNzAwLjIxNSA0NjEuNDM4LCA3MDEuNDM3IDQ1MS42NjIgQyA3MDIuNDgwIDQ0My4zMDgsIDcwMS41MzIgNDQwLjMxMiwgNjk3LjEzNSA0MzguMDY5IEMgNjkwLjk3NCA0MzQuOTI2LCA2ODIuNDIxIDQzMi44NzIsIDY3Mi40NjEgNDMyLjE0MyBDIDY2My4zNTggNDMxLjQ3OCwgNjYzIDQzMS41MjksIDY2MyA0MzMuNTA3IE0gMjQ0IDQzMy40MjcgQyAyNDQgNDM0LjQ2MywgMjQ1LjczNCA0MzUuODgwLCAyNDguNTAwIDQzNy4xMDMgQyAyNTQuNjc5IDQzOS44MzYsIDI1NC4xNDEgNDQxLCAyNDYuNjk2IDQ0MSBDIDIzMy4xOTAgNDQxLCAyMjAuNDUwIDQ1Mi40OTksIDIyNC44NDkgNDYwLjcxOSBDIDIyNy4wNDUgNDY0LjgyMSwgMjM5LjY5MyA0NjYuNTY4LCAyNTYuNTE0IDQ2NS4wOTMgQyAyNzcuODM2IDQ2My4yMjMsIDI4MS4wOTAgNDYxLjE2MCwgMjgxLjc5MCA0NDkuMDY3IEwgMjgyLjI0OCA0NDEuMTU5IDI3Ny4zNzQgNDM4LjY5MSBDIDI3MC4xMTIgNDM1LjAxNCwgMjYzLjIzNCA0MzMuMjQ3LCAyNTMuMDk3IDQzMi40NTQgQyAyNDQuOTUyIDQzMS44MTYsIDI0NCA0MzEuOTE4LCAyNDQgNDMzLjQyNyBNIDM2Mi4wNzUgNDMzLjA4NyBDIDM1Ni4yMDkgNDM0LjIzOCwgMzQ4LjM4MSA0MzYuODMyLCAzNDMuNzQ0IDQzOS4xNjAgTCAzMzkuOTg4IDQ0MS4wNDcgMzQwLjU5NCA0NDYuNzczIEMgMzQxLjU5OCA0NTYuMjY4LCAzNDIuNzE3IDQ1OS40MDMsIDM0NS43MjcgNDYxLjE2MiBDIDM1MC42MTQgNDY0LjAxNywgMzYwLjA1MyA0NjUuNDA4LCAzNzQuNTAwIDQ2NS40MDAgQyAzOTUuNzU5IDQ2NS4zOTAsIDQwMS4xODQgNDYyLjk1NSwgMzk4Ljg4MiA0NTQuNDYwIEMgMzk2LjcyNyA0NDYuNTEwLCAzODkuNjMyIDQ0MS45NTQsIDM3OC4yNTAgNDQxLjIxMCBDIDM3MC4xNDUgNDQwLjY4MSwgMzY5LjIwNCA0MzkuNjQyLCAzNzQuNzUwIDQzNy4zNDQgQyAzNzkuMzcwIDQzNS40MjksIDM3OS4xNzcgNDM1LjYyNCwgMzc4LjQxNyA0MzMuNjQzIEMgMzc3LjcwNiA0MzEuNzkxLCAzNzAuMDE1IDQzMS41MzAsIDM2Mi4wNzUgNDMzLjA4NyBNIDc4NiA0MzMuMDU1IEMgNzc2LjU2NSA0MzMuNzU4LCA3NjcuNDM5IDQzNi4wOTcsIDc2MS43NjIgNDM5LjI2NyBMIDc1OC4wMjQgNDQxLjM1NSA3NTguNjEyIDQ0Ni45MjcgQyA3NTkuNDExIDQ1NC41MDAsIDc2MC43NTQgNDU5LjU1MSwgNzYyLjMxNCA0NjAuODQ2IEMgNzY4Ljk3MCA0NjYuMzcwLCA4MDcuMDM2IDQ2Ny40ODMsIDgxNC44MjIgNDYyLjM4MSBDIDgxNi45MTUgNDYxLjAwOSwgODE3LjE3MyA0NjAuMjI0LCA4MTYuNzUyIDQ1Ni40OTEgQyA4MTUuNzI3IDQ0Ny4zOTYsIDgwOC4yMjAgNDQyLjAzNSwgNzk1LjM1NSA0NDEuMjA5IEMgNzg3LjAwMSA0NDAuNjczLCA3ODYuMjgzIDQzOS45MDQsIDc5MiA0MzcuNjE3IEMgNzk1LjU4NCA0MzYuMTgzLCA3OTcuMjUwIDQzMy42OTgsIDc5NS4yNTAgNDMyLjc3MCBDIDc5NC44MzcgNDMyLjU3OSwgNzkwLjY3NSA0MzIuNzA3LCA3ODYgNDMzLjA1NSBNIDEzNC41MDAgNTU3Ljc4OSBDIDEyMi43NTEgNTYzLjM3NSwgMTE2LjAxNiA1NzQuNDA3LCAxMTMuMDA2IDU5MyBDIDEwOS43ODIgNjEyLjkxNywgMTA5LjgxNyA2ODcuMjM1LCAxMTMuMDc1IDczOC45MTYgTCAxMTQuMTA5IDc1NS4zMzIgMTA4LjcxNSA3NjAuOTE2IEMgOTUuNDAxIDc3NC42OTksIDkwLjkyOSA3ODIuOTM1LCA5MC44MjYgNzkzLjg1NyBDIDkwLjY4MCA4MDkuMzk4LCAxMDAuNzg3IDgyMS43NjQsIDExNi4yNDIgODI0Ljk1NCBMIDEyMS45ODQgODI2LjEzOSAxMjMuNDQxIDgzMS4zMTkgQyAxMjQuMjQxIDgzNC4xNjksIDEyNS44NzggODQxLjIyNSwgMTI3LjA3NiA4NDcgQyAxMjkuNTg0IDg1OS4wNzcsIDEzMC41MzQgODYxLjI1NiwgMTM1LjI5MyA4NjUuODI4IEMgMTM5Ljk2MSA4NzAuMzE0LCAxNDMuNTI4IDg3MC45NDgsIDE2NC4yNTAgODcwLjk3NiBMIDE4MiA4NzEgMTgyIDg3NS40NzQgQyAxODIgODc5LjUxNCwgMTgxLjY4NCA4ODAuMTExLCAxNzguNzUwIDg4MS42MTUgQyAxNjguMjU2IDg4Ni45OTUsIDE2MS44MTYgODk0LjIxMiwgMTYwLjQ4NiA5MDIuMDgxIEMgMTU5Ljk0NyA5MDUuMjcxLCAxNTkuMzI0IDkwNi4xMTksIDE1Ny4xNjIgOTA2LjYwNiBDIDEyNC4zOTUgOTEzLjk4NCwgMTM3LjE2NCA5MjEuNzg5LCAxODguNTAwIDkyNS43NjIgQyAyMTYuNDcxIDkyNy45MjcsIDMwNS4zMDUgOTI4LjIwOCwgMzI4LjUwMCA5MjYuMjA1IEMgMzczLjI0MCA5MjIuMzQxLCAzOTEuMjAyIDkxNi41MTcsIDM3Ny43NTAgOTEwLjIzNiBDIDM3My4xMzggOTA4LjA4MiwgMzYwLjY1OSA5MDUsIDM1Ni41NTMgOTA1IEMgMzU0LjU1NSA5MDUsIDM1NCA5MDQuNTAwLCAzNTQgOTAyLjY5NiBDIDM1NCA4OTUuNTU4LCAzNDMuNjY0IDg4NC4wMjQsIDMzNC41NzkgODgxLjAyNiBDIDMzMS40NjMgODc5Ljk5OCwgMzMwIDg3Ny4zOTQsIDMzMCA4NzIuODc1IEMgMzMwIDg3Mi4zOTQsIDM0MS45NDMgODcyLCAzNTYuNTQwIDg3MiBDIDM5Ni4zOTAgODcyLCAzOTUuNjcwIDg3Mi43OTEsIDM5OS4yNjMgODI1LjA3NiBMIDQwMC41MDAgODA4LjY1MiA0MDYgODA3LjUxOSBDIDQwOS4wMjUgODA2Ljg5NiwgNDEzLjUwOSA4MDUuMzQxLCA0MTUuOTYzIDgwNC4wNjQgQyA0MjAuMTgwIDgwMS44NzAsIDQyMS4wOTEgODAxLjc4MCwgNDMyLjQ1NCA4MDIuNDQ1IEMgNDM5LjA3MCA4MDIuODMyLCA0NDQuNjcwIDgwMy4zMzcsIDQ0NC45MDEgODAzLjU2NyBDIDQ0NS4xMzEgODAzLjc5OCwgNDQzLjQyMCA4MDguODI3LCA0NDEuMDk3IDgxNC43NDMgQyA0MzguNzc1IDgyMC42NTksIDQzMy41MDYgODM0LjUwMCwgNDI5LjM4OCA4NDUuNTAwIEMgNDI1LjI3MCA4NTYuNTAwLCA0MjAuNjA3IDg2OC42NTAsIDQxOS4wMjcgODcyLjUwMCBDIDQxNC4zNzUgODgzLjgyOSwgNDE0LjUxMyA4ODUuMjQxLCA0MjAuMzY4IDg4Ni4yNDggQyA0MjMuMDQ2IDg4Ni43MDksIDQyOC4yMDUgODg2Ljk1NCwgNDMxLjgzNCA4ODYuNzkzIEwgNDM4LjQzMSA4ODYuNTAwIDQ0MC4zMjggODgxIEMgNDQzLjgyNyA4NzAuODUzLCA0NjcuMTkyIDgwOC41MjIsIDQ2OC4yMTYgODA2LjYwMiBDIDQ2OS4xNzEgODA0LjgxMiwgNDcwLjE1MyA4MDQuNzQzLCA0ODUuMzIxIDgwNS4zOTEgQyA0OTQuMTcxIDgwNS43NjksIDUwMS42MjUgODA2LjI5MSwgNTAxLjg4NCA4MDYuNTUxIEMgNTAyLjMwMCA4MDYuOTY2LCA1MDMuMjQ0IDgyMC45NDIsIDUwNS41NDEgODYwLjY1NyBMIDUwNi4xODYgODcxLjgxMyA1MTUuODQzIDg3Mi4yMTQgQyA1MjEuMTU0IDg3Mi40MzQsIDUyNS44ODcgODcyLjI5MiwgNTI2LjM2MCA4NzEuODk3IEMgNTI3LjA4NyA4NzEuMjkwLCA1MjYuNzYxIDg1OS40MzEsIDUyNC43MzkgODEzIEwgNTI0LjUwMCA4MDcuNTAwIDUyNy45NTQgODA3LjUwMCBMIDUzMS40MDggODA3LjUwMCA1MzMuMjIyIDgxNi41MDAgQyA1MzQuMjE5IDgyMS40NTAsIDUzNy41NTYgODQwLjM1MCwgNTQwLjYzOCA4NTguNTAwIEMgNTQzLjcyMCA4NzYuNjUwLCA1NDYuNDExIDg5MS42ODYsIDU0Ni42MTggODkxLjkxNCBDIDU0Ni44MjUgODkyLjE0MiwgNTUxLjY3NSA4OTIuNTM2LCA1NTcuMzk0IDg5Mi43OTAgQyA1NzIuMjQ0IDg5My40NTEsIDU3MS43NDcgODk4LjkyNiwgNTYxLjY4MyA4NDUuNTAwIEMgNTU4LjY3OCA4MjkuNTUwLCA1NTUuOTI1IDgxNC44MTMsIDU1NS41NjQgODEyLjc1MCBMIDU1NC45MDkgODA5IDU2MS4yMDUgODA5LjAxNSBDIDU2OC42ODcgODA5LjAzNCwgNTY5LjEwMSA4MDkuMjU3LCA1NzEuOTA5IDgxNC43OTUgQyA1NzUuMDg2IDgyMS4wNjAsIDU4MC4yOTggODI2LjM5MSwgNTg1LjgwNCA4MjkuMDA1IEwgNTkwLjYzNiA4MzEuMzAwIDU5MS43ODYgODM4LjkwMCBDIDU5NC4wNTAgODUzLjg2OSwgNTk3LjY3MyA4NjAuODYwLCA2MDUuNTYzIDg2NS40ODQgQyA2MTAuNzExIDg2OC41MDEsIDYyMS4yNzIgODY5Ljc4MiwgNjQyLjI1MCA4NjkuOTM2IEwgNjUxIDg3MCA2NTEgODczLjQyNyBDIDY1MSA4NzYuNTEyLCA2NTAuNDc2IDg3Ny4xNTMsIDY0NS43NTAgODc5Ljg2MiBDIDYzNS44MTMgODg1LjU1OCwgNjMwLjkxOCA4OTIuODAwLCA2MzAuODQ3IDkwMS45MTAgTCA2MzAuODExIDkwNi42MDYgNjI0LjA3MyA5MDguMzQxIEMgNTk2LjAxMSA5MTUuNTcwLCA2MjIuODY3IDkyNC4zNTQsIDY4MSA5MjYuOTYxIEMgNzMwLjUxOCA5MjkuMTgyLCA3NjQuODQ0IDkyOS45MTQsIDc3MS4yMTkgOTI4Ljg4NiBDIDc3NS43MTggOTI4LjE2MSwgNzgwLjM0NyA5MjguMjIxLCA3ODcuNTM4IDkyOS4wOTkgQyA3OTguNzYzIDkzMC40NzAsIDgxOC4wNTYgOTI4Ljg3MSwgODM3LjQ1MSA5MjQuOTYzIEMgODU1Ljc2OCA5MjEuMjcyLCA4NjIgOTE4LjcyMywgODYyIDkxNC45MjIgQyA4NjIgOTEyLjUyMiwgODUzLjI5OCA5MDguMTE4LCA4NDYuODQ2IDkwNy4yNTMgQyA4NDQuNjM2IDkwNi45NTYsIDg0Mi42OTMgOTA2LjIxNSwgODQyLjUyOCA5MDUuNjA3IEMgODQyLjM2MyA5MDQuOTk4LCA4NDEuNzE1IDkwMi42MDYsIDg0MS4wODcgOTAwLjI5MiBDIDgzOS45MTUgODk1Ljk3MywgODM0LjI4MiA4ODksIDgzMS45NjUgODg5IEMgODMxLjI1MSA4ODksIDgzMi4zMjEgODkwLjY1NCwgODM0LjM0MiA4OTIuNjc1IEMgODQwLjYxOCA4OTguOTUxLCA4NDEuMzE1IDkwNS43NzQsIDgzNi40NDMgOTEzLjIyMiBDIDgzMy4xMzggOTE4LjI3NCwgODI5LjAzMyA5MjAuMjAyLCA4MjEuNjA2IDkyMC4xOTAgQyA4MTcuOTYwIDkyMC4xODQsIDgxNC44OTYgOTIwLjcxMSwgODE0IDkyMS40OTkgQyA4MDguMTk2IDkyNi42MDYsIDc5Mi4xODMgOTI3LjMyNSwgNzgzLjIwNSA5MjIuODgyIEwgNzc4IDkyMC4zMDYgNzcyLjk4NiA5MjIuNzg3IEMgNzY0LjgzNSA5MjYuODIxLCA3NTUuNzMxIDkyNy4wMDEsIDc0Ny44MjQgOTIzLjI4NiBDIDczOC4zMDMgOTE4LjgxMiwgNzMyLjIzOSA5MTIuNzQ3LCA3MzAuNzI2IDkwNi4xODYgTCA3MjkuNTAwIDkwMC44NzIgNzIwLjgzMSA5MDEuMTg2IEwgNzEyLjE2MiA5MDEuNTAwIDcxMi4wNDkgODg2LjI1MCBMIDcxMS45MzcgODcxIDcxNi44MTcgODcxIEMgNzE5LjUwMiA4NzEsIDcyNS4xMDkgODcxLjI4OCwgNzI5LjI3NyA4NzEuNjQxIEwgNzM2Ljg1NiA4NzIuMjgxIDczNy41NDUgODc5LjY0MSBDIDczNy45MjUgODgzLjY4OCwgNzM4LjQxNyA4ODcsIDczOC42MzkgODg3IEMgNzM4Ljg2MSA4ODcsIDc0MC44MTQgODg1LjgyOCwgNzQyLjk3OCA4ODQuMzk2IEMgNzQ1LjE2NCA4ODIuOTQ5LCA3NDkuMTI2IDg4MS41MDUsIDc1MS44OTQgODgxLjE0NiBDIDc1Ni4xMzMgODgwLjU5NiwgNzU3LjIyNCA4NzkuOTgyLCA3NTkuMjEyIDg3Ny4wMjQgQyA3NjEuODYyIDg3My4wODAsIDc2Ny4xNDkgODY5LjE5OCwgNzcwLjk0MSA4NjguNDEyIEMgNzc1LjM0OCA4NjcuNDk4LCA3NzYuMTk1IDg2Ni41OTcsIDc3Ny45MzggODYwLjk3MiBDIDc4Mi40MTEgODQ2LjUzNiwgNzk2LjIyNCA4MjYuMTM0LCA4MDguNzc4IDgxNS40MjIgQyA4NTQuNzExIDc3Ni4yMzAsIDkyMy41NTMgNzg0LjQ1MiwgOTYwLjUwMCA4MzMuNTQ0IEMgOTY1LjkyNiA4NDAuNzUyLCA5NzQuMDU0IDg1Ni4xMTAsIDk3Ni4xNTUgODYzLjEyMiBDIDk3Ny4xODAgODY2LjU0NSwgOTc3LjUyOSA4NjYuNzg0LCA5ODIuMzI1IDg2Ny4zNTIgQyA5ODcuODEwIDg2OC4wMDIsIDk5NC4zOTMgODcxLjk0MiwgOTk5LjE2NyA4NzcuNDMyIEMgMTAwMy4yMDQgODgyLjA3NSwgMTAwMy43MjUgODc4LjkxMiwgMTAwMS4xMDkgODY1LjY1NCBDIDk5Ni4yNzIgODQxLjEzOCwgOTgzLjQxMSA4MTcuOTIzLCA5NjQuMzk3IDc5OS4zODQgQyA5NTQuMDkwIDc4OS4zMzUsIDkzMy4wMTggNzc0LjY0OSwgOTMxLjMyOSA3NzYuMzM3IEMgOTMxLjA2MyA3NzYuNjA0LCA5MjcuNjE3IDc3NS40NjMsIDkyMy42NzIgNzczLjgwMiBDIDkwOC4wNjcgNzY3LjIzMSwgODkxLjg0MSA3NjQuMTY0LCA4NzEuNTAwIDc2My45NDEgQyA4NjYuNTUwIDc2My44ODcsIDg2My4wNjMgNzYzLjYxNSwgODYzLjc1MCA3NjMuMzM4IEMgODY0LjQzNyA3NjMuMDYwLCA4NjUgNzYxLjYwNCwgODY1IDc2MC4xMDIgQyA4NjUgNzU3Ljk4MywgODY1Ljc1OCA3NTcuMDA5LCA4NjguMzgyIDc1NS43NTggQyA4NzAuMjQyIDc1NC44NzAsIDg3My43MzAgNzUxLjgxOCwgODc2LjEzMiA3NDguOTc0IEMgODc4LjUzNCA3NDYuMTMwLCA4ODMuNDkxIDc0MC4yOTIsIDg4Ny4xNDYgNzM2IEMgODk0Ljg4MSA3MjYuOTE4LCA5MDAuMTU4IDcxNy44ODAsIDkwMi41MTEgNzA5LjY4NCBDIDkwNC4zMDYgNzAzLjQzMCwgOTA1LjY2MyA3MDIuMjE0LCA5MDguOTEyIDcwMy45NTMgQyA5MTQuODY5IDcwNy4xNDEsIDkxNS4zOTcgNzE3LCA5MTAuMTU1IDcyNy4xNjQgQyA5MDYuNTg2IDczNC4wODMsIDkwNi42NjEgNzM0LjUyNiwgOTExLjU0NSA3MzUuNDQyIEMgOTIyLjE2MCA3MzcuNDM0LCA5MjguODMyIDc1NS4wNTQsIDkyMS4yMzQgNzYxLjAzMSBDIDkxNC4wNTQgNzY2LjY3OCwgOTA0Ljg0OCA3NTcuMTI1LCA5MDcuODQyIDc0Ny4xMzQgQyA5MTAuMTcxIDczOS4zNTksIDkwOC45MTYgNzMzLjY2MiwgOTA2LjExMCA3MzkuMjc3IEMgOTA0LjE5MyA3NDMuMTE0LCA4OTkuMzkzIDc0NC4wMjcsIDg5My42ODAgNzQxLjY0MCBDIDg5MC4zMTEgNzQwLjIzMiwgODg5IDc0MC4zNzcsIDg4OSA3NDIuMTU2IEMgODg5IDc0Mi42MDksIDg5MS40NzUgNzQ0LjYyMywgODk0LjUwMCA3NDYuNjMxIEMgODk5LjY4MCA3NTAuMDcxLCA5MDAgNzUwLjUyMiwgOTAwLjAwNCA3NTQuMzkyIEMgOTAwLjAxMSA3NjIuNzI0LCA5MDMuNjQ1IDc2NS45MTMsIDkxNy4yMjEgNzY5LjUwNCBMIDkyMy45NDIgNzcxLjI4MSA5MjcuNDcyIDc2OC41ODkgQyA5MzcuMzExIDc2MS4wODQsIDkzNy4xNjIgNzQ1LjgxOSwgOTI3LjE1MiA3MzUuOTE2IEMgOTI0LjU5MyA3MzMuMzg1LCA5MjEuNzI5IDczMC44OTcsIDkyMC43ODcgNzMwLjM4OCBDIDkxOS4xOTcgNzI5LjUyOSwgOTE5LjE4NyA3MjkuMTQyLCA5MjAuNjQ5IDcyNC45ODEgQyA5MjUuNzQ3IDcxMC40NjYsIDkxOC40MDUgNjk2LCA5MDUuOTQxIDY5NiBDIDkwMC40ODAgNjk2LCA4OTYuNzQ2IDY5OS4yODcsIDg5NS40NjEgNzA1LjIyNiBDIDg5My42NDQgNzEzLjYxOSwgODg4LjU1NiA3MjEuMzc4LCA4NzcuMjY5IDczMi45NjggTCA4NjYuMDM4IDc0NC41MDAgODY2LjAxOSA3NDAuNjg0IEMgODY2LjAwOSA3MzguNTg1LCA4NjUuMzQ1IDcyNS45ODUsIDg2NC41NDQgNzEyLjY4NCBDIDg2My43NDMgNjk5LjM4MywgODYyLjYxMiA2ODAuMTc1LCA4NjIuMDMxIDY3MCBDIDg2MS40NTAgNjU5LjgyNSwgODYwLjcwNiA2NDguMzUwLCA4NjAuMzc5IDY0NC41MDAgTCA4NTkuNzg0IDYzNy41MDAgODY0Ljg4NyA2MzUuNzExIEMgODcyLjgwOSA2MzIuOTMzLCA4NzQuMjc2IDYyOC40NTQsIDg3MS45NTMgNjE0LjEzOCBDIDg2OS4wNDcgNTk2LjIzMCwgODU0LjczMCA1ODQuMTM3LCA4MzQuNTAwIDU4Mi41MDQgQyA4MzAuNjUwIDU4Mi4xOTMsIDgwMS44NTAgNTgwLjYwMSwgNzcwLjUwMCA1NzguOTY1IEMgNjk2LjYyNyA1NzUuMTEwLCA2ODAuNjgxIDU3NC4yNDksIDY1MC41MDAgNTcyLjQ4NCBDIDYwNS4zMjMgNTY5Ljg0MiwgNTk5LjQzOSA1NzAuNjA1LCA1ODkuNjcxIDU4MC4zNzMgQyA1NzkuMjE2IDU5MC44MjgsIDU3Ny43OTcgNTk3LjY2MSwgNTc3LjYyNiA2MzguMzk3IEwgNTc3LjUwMCA2NjguMjk0IDU1Ny41MDAgNjY3LjY1MCBDIDU0Ni41MDAgNjY3LjI5NSwgNTMzLjUzMCA2NjcuMDA0LCA1MjguNjc4IDY2Ny4wMDMgTCA1MTkuODU2IDY2NyA1MjAuNjI0IDY2MS4yNTAgQyA1MjIuMDk4IDY1MC4yMjQsIDUyMC45NDMgNjQ4LCA1MTMuNzQzIDY0OCBDIDUwNy4xMDYgNjQ4LCA1MDYuMjk5IDY0OC45NzcsIDUwNS41MDIgNjU3Ljk3OCBMIDUwNC43OTIgNjY2IDQ5NC4xNDYgNjY1LjkzOCBDIDQ4OC4yOTEgNjY1LjkwMywgNDcwLjkwMCA2NjUuNDkwLCA0NTUuNTAwIDY2NS4wMjAgTCA0MjcuNTAwIDY2NC4xNjQgNDI1LjQyOSA2NjYuNDMwIEMgNDIzLjg2MiA2NjguMTQ0LCA0MjMuMDcwIDY3MS4xMDQsIDQyMi4xNzYgNjc4LjU5OCBDIDQyMC43NjMgNjkwLjQyOSwgNDE0Ljk5OCA3MzMuNjEzLCA0MTQuNDMyIDczNi42MDkgQyA0MTQuMTA2IDczOC4zMjksIDQxMy4wNzQgNzM4LjgzMSwgNDA4LjgyNSA3MzkuMzM0IEMgNDA1Ljk2MSA3MzkuNjc0LCA0MDMuNTQwIDczOS44NTAsIDQwMy40NDUgNzM5LjcyNiBDIDQwMy4zNDkgNzM5LjYwMSwgNDAzLjAxNCA3MTQuODkyLCA0MDIuNzAwIDY4NC44MTUgTCA0MDIuMTI5IDYzMC4xMzEgNDA1LjExOSA2MjkuNDc0IEMgNDEwLjExMyA2MjguMzc3LCA0MTUuNjIyIDYyMi4yNDgsIDQxNi40MDEgNjE2LjkyMSBDIDQxNy4yMTQgNjExLjM2NSwgNDE1LjQ3OCA1OTkuMzgxLCA0MTIuODM0IDU5Mi4yOTggQyA0MDguODk0IDU4MS43NDUsIDM5Ny4yNzMgNTcyLjU3MCwgMzg0LjcxOSA1NzAuMTAzIEMgMzc5LjM2MyA1NjkuMDUxLCAzNDkuMzY0IDU2Ny4wNjgsIDI3MC41MDAgNTYyLjU1NCBDIDI1NS42NTAgNTYxLjcwNCwgMjI3LjUyNSA1NjAuMDg2LCAyMDggNTU4Ljk1OSBDIDE1MS40MzEgNTU1LjY5NSwgMTM5LjMxMiA1NTUuNTAyLCAxMzQuNTAwIDU1Ny43ODkgTSAxNTYuMjY5IDU2NS45MDggQyAxNTcuNzI3IDU2Ny42NDEsIDE1OS4yMjEgNTcwLjY2MywgMTU5LjU4OSA1NzIuNjI0IEMgMTYwLjM1NiA1NzYuNzEyLCAxNTkuNTg1IDU5NC42NTksIDE1OC41MzMgNTk3LjE5MiBDIDE1Ny44OTggNTk4LjcyMCwgMTU5LjA2NyA1OTguOTEzLCAxNzAuNjY1IDU5OS4xOTIgQyAxNzcuNzI0IDU5OS4zNjEsIDE4My44NzMgNTk5LjIxNywgMTg0LjMyOCA1OTguODcyIEMgMTg2LjA0OCA1OTcuNTY3LCAxODcuMDM4IDU4My42ODIsIDE4NS44NDQgNTc3LjYxMyBDIDE4My44NjQgNTY3LjU0OSwgMTgxLjEwNiA1NjUuMzgxLCAxNjkuMjUxIDU2NC41NzQgQyAxNjMuODg4IDU2NC4yMDksIDE1OC4xNzcgNTYzLjY1MCwgMTU2LjU1OSA1NjMuMzMzIEwgMTUzLjYxOCA1NjIuNzU3IDE1Ni4yNjkgNTY1LjkwOCBNIDE4Ni4yMTIgNTY4LjkzNSBDIDE5MS42MjMgNTc1LjI1NiwgMTkzLjE1MSA1ODUuODQ5LCAxOTAuMzUxIDU5Ny42MjUgQyAxODkuODY0IDU5OS42NzMsIDE5MC4yNzUgNTk5Ljc3NSwgMjAxLjY3MyA2MDAuNDMyIEMgMjA4LjE3OCA2MDAuODA3LCAyMjYuNzc1IDYwMS45NzgsIDI0MyA2MDMuMDM2IEMgMjU5LjIyNSA2MDQuMDkzLCAyOTEuMTc1IDYwNi4wOTcsIDMxNCA2MDcuNDg5IEMgMzYwLjAzOCA2MTAuMjk2LCAzOTIuNzY4IDYxMi42MDgsIDQwMC43NTAgNjEzLjYxNiBMIDQwNiA2MTQuMjc5IDQwNS45ODMgNjExLjM4OSBDIDQwNS45MTIgNTk5LjY1NCwgNDAwLjU3OCA1ODcuODMyLCAzOTMuMjgwIDU4My4yMzggQyAzODQuNTc1IDU3Ny43NTgsIDM4My4wMzAgNTc3LjUxOCwgMzQzLjUwMCA1NzUuNTAxIEMgMzI3LjU1MCA1NzQuNjg4LCAzMTAuOTAwIDU3My43ODAsIDMwNi41MDAgNTczLjQ4NCBDIDI5OS4wMTEgNTcyLjk4MCwgMjE2Ljk2NSA1NjcuNzQ5LCAxOTYgNTY2LjQzOCBDIDE5MC43NzUgNTY2LjExMiwgMTg1LjYyOSA1NjUuNTk4LCAxODQuNTY0IDU2NS4yOTYgQyAxODMuMDk0IDU2NC44NzksIDE4My40OTAgNTY1Ljc1NSwgMTg2LjIxMiA1NjguOTM1IE0gMTMxLjUzNiA1NzMuOTI5IEMgMTIyLjQ2OCA1OTEuODIzLCAxMTkuNDgxIDYyNy42NTksIDEyMS45MDMgNjg5LjUwMCBDIDEyMy40MzkgNzI4LjY5OSwgMTI3LjEyNSA3NzkuMjY3LCAxMjguNTY0IDc4MC44NjIgQyAxMjguNzQzIDc4MS4wNjEsIDEzMi43MTkgNzgwLjE2MSwgMTM3LjM5OSA3NzguODYyIEMgMTQ0LjgwOSA3NzYuODA1LCAxNDUuODU2IDc3Ni4yNDIsIDE0NS41MDUgNzc0LjUwMCBDIDE0NS4yODQgNzczLjQwMCwgMTQ0LjgxOCA3NjkuNDYyLCAxNDQuNDcyIDc2NS43NTAgQyAxNDMuODY5IDc1OS4zMDUsIDE0My43MjAgNzU4Ljk5NCwgMTQxLjE3MCA3NTguODY0IEMgMTM4LjgxNCA3NTguNzQ0LCAxMzguNzY1IDc1OC42NzcsIDE0MC43NTAgNzU4LjI5NCBDIDE0My40NjggNzU3Ljc3MSwgMTQzLjQzMyA3NTguNjk3LCAxNDEuODA0IDczMC4xMDIgQyAxNDAuNzM0IDcxMS4zMDYsIDE0MC4zNzYgNzA4LjY1MCwgMTM4Ljg2MiA3MDguMjU0IEMgMTM3Ljg4MSA3MDcuOTk3LCAxMzcuMzY5IDcwNy4yMDIsIDEzNy42NzQgNzA2LjQwNyBDIDEzNy45NjkgNzA1LjY0MCwgMTM4LjY3MCA3MDUuMjk2LCAxMzkuMjMyIDcwNS42NDMgQyAxMzkuOTI0IDcwNi4wNzEsIDE0MC4wMjkgNjk5LjM3MSwgMTM5LjU1OCA2ODQuODg3IEMgMTM4LjA0NCA2MzguMzQ4LCAxMzcuNTYyIDYwOC4xMDQsIDEzOC4zMjMgNjA3LjM0NCBDIDEzOC41OTYgNjA3LjA3MSwgMTM3LjY0NyA2MDQuMjk0LCAxMzYuMjEzIDYwMS4xNzQgQyAxMzMuMjI2IDU5NC42NzEsIDEzMi4wOTggNTgxLjY2OCwgMTMzLjg1NyA1NzQuMDI3IEMgMTM1LjI2OSA1NjcuOTAwLCAxMzQuNjA1IDU2Ny44NzIsIDEzMS41MzYgNTczLjkyOSBNIDYxNyA1NzguOTg2IEMgNjE4LjM3NSA1ODAuMDY5LCA2MTkuNzU1IDU4MC45NjYsIDYyMC4wNjYgNTgwLjk3OCBDIDYyMC4zNzcgNTgwLjk5MCwgNjIxLjY3OSA1ODIuODY0LCA2MjIuOTYwIDU4NS4xNDIgQyA2MjUuNjQ0IDU4OS45MTgsIDYyNi43MjUgNjAwLjE0MiwgNjI1LjIyOCA2MDYuNjA1IEwgNjI0LjI3OCA2MTAuNzA5IDYzNi44NTcgNjExLjMwNCBDIDY0My43NzUgNjExLjYzMCwgNjQ5LjY3MyA2MTEuNjYwLCA2NDkuOTY0IDYxMS4zNjkgQyA2NTEuNDA2IDYwOS45MjcsIDY1MS4xMTAgNTk0Ljg0OCwgNjQ5LjU0OCA1OTAuMTQ0IEMgNjQ2LjkyMyA1ODIuMjQyLCA2NDMuMjI3IDU4MC4wNDIsIDYzMC43MTEgNTc4LjkzNSBDIDYyNS4wOTUgNTc4LjQzOCwgNjE5LjE1MCA1NzcuODAzLCA2MTcuNTAwIDU3Ny41MjQgTCA2MTQuNTAwIDU3Ny4wMTUgNjE3IDU3OC45ODYgTSA2NDkuMjY2IDU4Mi45MjkgQyA2NTQuMjYxIDU4Ny4zMTQsIDY1Ni4zMDggNTkzLjg5MCwgNjU1Ljg0NSA2MDQuMDY4IEMgNjU1LjU0OCA2MTAuNjIyLCA2NTUuNzQ3IDYxMi4wMDMsIDY1Ni45OTMgNjEyLjAxOSBDIDY1Ny44MjIgNjEyLjAzMCwgNjY2LjE1MCA2MTIuNDYzLCA2NzUuNTAwIDYxMi45ODMgQyA2ODQuODUwIDYxMy41MDIsIDcwOS42MDAgNjE0Ljg1MiwgNzMwLjUwMCA2MTUuOTgzIEMgNzUxLjQwMCA2MTcuMTE0LCA3NzguNjI1IDYxOC43MDMsIDc5MSA2MTkuNTE1IEMgODQwLjk1MyA2MjIuNzkxLCA4NjIuMzQ0IDYyMy45ODksIDg2Mi43OTcgNjIzLjUzNyBDIDg2My44MzQgNjIyLjUwMCwgODYwLjY3MSA2MTAuMjE3LCA4NTguMTgzIDYwNS42MjEgQyA4NTQuOTc0IDU5OS42OTMsIDg0OC40NTEgNTk0LjUxNSwgODQxLjU5OCA1OTIuNDU0IEMgODM4LjE3MCA1OTEuNDI0LCA4MjQuODY4IDU5MC4yODIsIDgwMSA1ODguOTcwIEMgNzgxLjQ3NSA1ODcuODk2LCA3NDkuOTc1IDU4Ni4xMjksIDczMSA1ODUuMDQyIEMgNzEyLjAyNSA1ODMuOTU1LCA2ODcuNzI1IDU4Mi42MDQsIDY3NyA1ODIuMDM5IEMgNjY2LjI3NSA1ODEuNDc0LCA2NTQuODM2IDU4MC43MzEsIDY1MS41ODEgNTgwLjM4OCBMIDY0NS42NjIgNTc5Ljc2NCA2NDkuMjY2IDU4Mi45MjkgTSA1OTYuMzA5IDU4OS41ODcgQyA1OTMuMTY0IDU5NS40NzQsIDU5MC4xMDUgNjA4LjM5MSwgNTg4Ljg2NyA2MjEuMDA5IEMgNTg3LjA1OSA2MzkuNDUzLCA1OTAuMjg4IDcwNS42OTUsIDU5NS40OTQgNzU2LjkxNCBDIDU5Ny43NTQgNzc5LjE1NywgNTk4LjAwMSA3ODAuNDU1LCA2MDAuNDI4IDc4Mi44ODMgTCA2MDIuOTgzIDc4NS40MzggNjA5LjYzMiA3ODIuMTU5IEwgNjE2LjI4MCA3NzguODgxIDYxNS42NjAgNzcyLjE5MCBDIDYxNS4zMTkgNzY4LjUxMSwgNjE0LjEzNCA3NTYuNzI1LCA2MTMuMDI3IDc0NiBDIDYxMS45MTkgNzM1LjI3NSwgNjExLjAwNCA3MjQuNDc1LCA2MTAuOTkzIDcyMiBDIDYxMC45NjUgNzE1LjgzMSwgNjEwLjA2OCA3MTMuMDAzLCA2MDguMTMzIDcxMi45ODUgQyA2MDYuNzEzIDcxMi45NzEsIDYwNi42OTYgNzEyLjg0MywgNjA4IDcxMiBDIDYwOC44MjUgNzExLjQ2NywgNjA5LjA1MCA3MTEuMDE3LCA2MDguNTAwIDcxMSBDIDYwNy45NTAgNzEwLjk4MywgNjA4LjA0NyA3MTAuNjIyLCA2MDguNzE2IDcxMC4xOTYgQyA2MDkuNjUxIDcwOS42MDMsIDYwOS43MTggNzA2LjA2OSwgNjA5LjAwNiA2OTQuOTYyIEMgNjA4LjQ5NiA2ODcuMDA4LCA2MDcuNTk2IDY2OS43MDAsIDYwNy4wMDcgNjU2LjUwMCBDIDYwNi40MTggNjQzLjMwMCwgNjA1Ljc3OCA2MjguOTU5LCA2MDUuNTg1IDYyNC42MzEgQyA2MDUuMzkxIDYyMC4zMDMsIDYwNC43NDggNjE2LjQ2MiwgNjA0LjE1NSA2MTYuMDk2IEMgNjAxLjU0MiA2MTQuNDgxLCA1OTkuNjM0IDYwNy4xMjIsIDU5OS4wNzMgNTk2LjUwMCBMIDU5OC40OTMgNTg1LjUwMCA1OTYuMzA5IDU4OS41ODcgTSAxNDMuNjY4IDYwNi43MjggQyAxNDMuMzY3IDYwNy4yMTYsIDE0My4yODQgNjA4LjQ4OSwgMTQzLjQ4NCA2MDkuNTU3IEMgMTQzLjY4MyA2MTAuNjI2LCAxNDMuODgxIDYxMS43OTUsIDE0My45MjMgNjEyLjE1NiBDIDE0My45NjYgNjEyLjUxNywgMTQ0LjkwMCA2MTIuNTc3LCAxNDYgNjEyLjI5MCBDIDE0Ny4zOTEgNjExLjkyNiwgMTQ4IDYxMi4yNTksIDE0OCA2MTMuMzgzIEMgMTQ4IDYxNC40NjUsIDE0Ny4xMjQgNjE1LCAxNDUuMzU1IDYxNSBMIDE0Mi43MDkgNjE1IDE0My4zOTQgNjUwLjc1MCBDIDE0NC4xNzMgNjkxLjM5NiwgMTQ1LjU0OCA3MjUuNzI3LCAxNDcuMTMwIDc0NCBDIDE0OC4yMzAgNzU2LjcxMCwgMTQ4LjQ1MCA3NjAuMTM0LCAxNDguODAyIDc3MC4xMDggTCAxNDkgNzc1LjcxNyAxNTkuNzUwIDc3Ni4yMzMgQyAxNzEuNjY2IDc3Ni44MDUsIDE3Ni41NDEgNzc4LjMyOSwgMTc5LjgzMiA3ODIuNTE0IEMgMTg0LjYxMCA3ODguNTg4LCAxODEuMTU1IDc5OC42MjIsIDE3My4xNDMgODAxLjk0MSBDIDE3MC4zMTkgODAzLjExMCwgMTcwLjI4MyA4MDMuMjI4LCAxNzAuNzI1IDgwOS44MTQgQyAxNzEuMjc1IDgxOC4wMDMsIDE2OC42MjAgODIzLjg0OSwgMTYyLjIzOCA4MjguNTAwIEMgMTU5LjYwMCA4MzAuNDIzLCAxNTguMTAwIDgzMi4zMDgsIDE1OC4wNjEgODMzLjc1MCBDIDE1OC4wMDQgODM1Ljg2NCwgMTU4LjQwOCA4MzYuMDAyLCAxNjQuNzUwIDgzNi4wMzIgQyAxNzAuODM5IDgzNi4wNjAsIDE3NSA4MzcuNDEyLCAxNzUgODM5LjM2MCBDIDE3NSA4MzkuNzEyLCAxNzEuNDExIDg0MCwgMTY3LjAyNSA4NDAgTCAxNTkuMDUwIDg0MCAxNTkuNjIzIDg0My4yNTAgQyAxNTkuOTM4IDg0NS4wMzgsIDE2MC44NjggODQ5LjAyMSwgMTYxLjY4OSA4NTIuMTAzIEwgMTYzLjE4MSA4NTcuNzA2IDI0OC44NDEgODU4LjYwMyBDIDI5NS45NTMgODU5LjA5NiwgMzQ1LjQ3NiA4NTkuNTAwLCAzNTguODkxIDg1OS41MDAgTCAzODMuMjgzIDg1OS41MDAgMzg1LjIxNCA4NTYuOTE0IEMgMzg2LjgzOCA4NTQuNzQwLCAzODcuNDE5IDg1MC43ODUsIDM4OC44NTkgODMyLjExNiBDIDM4OS44MDEgODE5LjkwMCwgMzkwLjM2OCA4MDkuNzAyLCAzOTAuMTE5IDgwOS40NTMgQyAzODkuODcwIDgwOS4yMDQsIDM4NS42NzYgODA5LCAzODAuNzk4IDgwOSBDIDM3Mi4xOTkgODA5LCAzNzEuOTYzIDgwOC45MzgsIDM3My4wMTUgODA2Ljk3MiBDIDM3My42MTIgODA1Ljg1NywgMzc0LjU0NCA4MDUuMjE4LCAzNzUuMDg3IDgwNS41NTQgQyAzNzUuNjMwIDgwNS44ODksIDM3OS40MzIgODA1Ljg0OSwgMzgzLjUzNyA4MDUuNDY0IEwgMzkxIDgwNC43NjUgMzkxIDgwMS41MzcgQyAzOTEgNzk5LjQ5NSwgMzkxLjc4OCA3OTcuNjExLCAzOTMuMTQ2IDc5Ni40MDUgQyA0MDAuNjQ2IDc4OS43NDksIDQwMy4xODQgNzgwLjc5MSwgMzk5LjI0NSA3NzQuODg0IEMgMzkwLjUyMyA3NjEuODExLCAzODkuMzE3IDc2MC42MzEsIDM4NS42MTggNzYxLjU2MCBDIDM4Mi41NzkgNzYyLjMyMiwgMzgyLjQ4NiA3NjIuOTg3LCAzODQuNDg5IDc2OS41OTEgQyAzODYuNDE5IDc3NS45NTMsIDM4Ni40MTMgNzc2LCAzODMuNjM2IDc3NiBDIDM3OS40NTggNzc2LCAzNzQgNzY4LjE0NiwgMzc0IDc2Mi4xMzQgQyAzNzQgNzYwLjE3NCwgMzc3LjkwMCA3NTcsIDM4MC4zMDkgNzU3IEMgMzgxLjg3NyA3NTcsIDM4NC4yMDQgNzU1LjE2MywgMzg3LjU1OSA3NTEuMjc1IEwgMzkyLjUwMCA3NDUuNTUwIDM5Mi41MDAgNjg0LjM1OCBDIDM5Mi41MDAgNjUwLjcwMiwgMzkyLjI2MCA2MjIuOTI2LCAzOTEuOTY4IDYyMi42MzQgQyAzOTEuMzM4IDYyMi4wMDUsIDMzNS4zNDkgNjE3LjczNCwgMjkxLjUwMCA2MTQuOTcxIEMgMjc0LjQ1MCA2MTMuODk2LCAyNTAuMzc1IDYxMi4zNDAsIDIzOCA2MTEuNTEzIEMgMjI1LjYyNSA2MTAuNjg1LCAyMDEuNTUwIDYwOS4zMzUsIDE4NC41MDAgNjA4LjUxMyBDIDE2Ny40NTAgNjA3LjY5MCwgMTUxLjQxMSA2MDYuNzUzLCAxNDguODU4IDYwNi40MzAgQyAxNDYuMzA1IDYwNi4xMDYsIDE0My45NjkgNjA2LjI0MSwgMTQzLjY2OCA2MDYuNzI4IE0gNjEwLjcxMyA2MzEuNzUwIEMgNjExLjcyMSA2NjkuMzU3LCA2MTUuNzE1IDczMy43ODEsIDYxOC41NDIgNzU3Ljk5NCBDIDYxOS4zNDQgNzY0Ljg2NiwgNjIwIDc3MS45NTMsIDYyMCA3NzMuNzQ0IEMgNjIwIDc3NS41MzUsIDYyMC4xOTYgNzc3LCA2MjAuNDM3IDc3NyBDIDYyMC42NzcgNzc3LCA2MjQuNjE0IDc3Ni4xMDMsIDYyOS4xODcgNzc1LjAwNyBDIDYzOS41MDggNzcyLjUzMywgNjUxLjg1NiA3NzIuMzYzLCA2NTYuNjMzIDc3NC42MzAgQyA2NjEuMzkxIDc3Ni44ODgsIDY2MyA3NzkuNjEyLCA2NjMgNzg1LjQwNiBDIDY2MyA3OTAuMDUwLCA2NjIuNjgwIDc5MC42NzYsIDY1OC4wMDMgNzk1LjE4NCBDIDY1NS4yNTUgNzk3LjgzMywgNjUyLjMzMCA4MDAsIDY1MS41MDMgODAwIEMgNjQ5LjY2NyA4MDAsIDY0OS42NjcgNzk5LjgwNiwgNjUxLjUwMCA4MDUgQyA2NTUuMTY1IDgxNS4zODcsIDY1MC40NjAgODI2LjUzMywgNjQwLjEwMCA4MzIuMDA5IEwgNjM2LjUwMCA4MzMuOTEyIDY0MC41OTUgODMzLjk1NiBDIDY0NC4zMTEgODMzLjk5NiwgNjQ4IDgzNi4xNzUsIDY0OCA4MzguMzI5IEMgNjQ4IDgzOC42OTgsIDY0My45MTAgODM5LCA2MzguOTEyIDgzOSBMIDYyOS44MjQgODM5IDYzMC41MDIgODQzLjI1MCBDIDYzMC44NzUgODQ1LjU4NywgNjMxLjYyNSA4NDkuMzQxLCA2MzIuMTY4IDg1MS41OTAgTCA2MzMuMTU3IDg1NS42ODAgNjY0Ljc0MiA4NTYuMzQwIEMgNjgyLjExMyA4NTYuNzAzLCA3MDguOTY1IDg1Ni45OTUsIDcyNC40MTMgODU2Ljk4OCBMIDc1Mi41MDAgODU2Ljk3NiA3NTUuNjgzIDg0Ny40ODggTCA3NTguODY1IDgzOCA3NTAuODk3IDgzOCBDIDc0My4xNzQgODM4LCA3NDIuOTYzIDgzNy45MzcsIDc0NC4wMjcgODM1Ljk0OSBDIDc0NS4wMDYgODM0LjEyMSwgNzQ1Ljk3NyA4MzMuOTE5LCA3NTIuOTk0IDgzNC4wODkgQyA3NjEuMjQ5IDgzNC4yODgsIDc2My4wNTkgODMzLjU0MSwgNzY0LjM3NCA4MjkuMzk4IEMgNzY1LjE2NSA4MjYuOTA1LCA3NzIuOTYyIDgxNC41OTMsIDc3Ni40MjkgODEwLjM2MyBDIDc3Ny44NDMgODA4LjYzNywgNzc5IDgwNi45NTAsIDc3OSA4MDYuNjEzIEMgNzc5IDgwNi4yNzYsIDc3NS4xMjAgODA2LCA3NzAuMzc4IDgwNiBDIDc2Mi44MjcgODA2LCA3NjEuOTEwIDgwNS44MTQsIDc2MyA4MDQuNTAwIEMgNzYzLjkzNSA4MDMuMzc0LCA3NjYuNDQ4IDgwMywgNzczLjA5MSA4MDMgTCA3ODEuOTM3IDgwMyA3OTAuMjE4IDc5NS40ODggQyA3OTQuNzczIDc5MS4zNTYsIDc5OS41MTMgNzg3LjcwNywgODAwLjc1MCA3ODcuMzc5IEMgODAxLjk4NyA3ODcuMDUxLCA4MDMgNzg2LjQzNSwgODAzIDc4Ni4wMDkgQyA4MDMgNzg1LjU4MywgODA1LjQwMyA3ODQuMDk2LCA4MDguMzQwIDc4Mi43MDYgQyA4MTEuMjc3IDc4MS4zMTUsIDgxNC4zMTQgNzc5LjU3NSwgODE1LjA5MCA3NzguODM5IEMgODE1Ljg2NSA3NzguMTAyLCA4MTguNzUwIDc3Ni42NzgsIDgyMS41MDAgNzc1LjY3MyBDIDgzNC45MzEgNzcwLjc2NywgODUwLjQ0MSA3NjUuOTA4LCA4NTUuMjAxIDc2NS4xMTYgQyA4NTguMTE2IDc2NC42MzEsIDg1OS40NzkgNzY0LjE4MSwgODU4LjIzMSA3NjQuMTE3IEMgODU2LjM3MSA3NjQuMDIxLCA4NTYuMDY4IDc2My41NzksIDg1Ni41NDggNzYxLjY2NiBDIDg1Ny41MjMgNzU3Ljc4MSwgODUyLjA5NCA2NDUuNTE3LCA4NTAuNDExIDYzNC43NTAgQyA4NDkuODkyIDYzMS40MzIsIDg0OS40OTYgNjMxLCA4NDYuOTc2IDYzMSBDIDg0NS40MDkgNjMxLCA4MjMuMDYxIDYyOS42NjgsIDc5Ny4zMTQgNjI4LjA0MSBDIDc0MS40NDMgNjI0LjUwOSwgNjIyLjk0OCA2MTguMDI2LCA2MTMuOTIzIDYxOC4wMDcgTCA2MTAuMzQ1IDYxOCA2MTAuNzEzIDYzMS43NTAgTSAxNTcuNDU1IDYyNi40NTUgQyAxNTQuNTE1IDYyOS4zOTQsIDE1NC4zODQgNjMwLjYwMCwgMTU2Ljg1OCA2MzEuOTI0IEMgMTU4LjM2NyA2MzIuNzMyLCAxNTguOTI3IDYzMi40NTYsIDE1OS44MzcgNjMwLjQ1OSBDIDE2MS41NTYgNjI2LjY4NiwgMTY2IDYyNy4wMTEsIDE2NiA2MzAuOTEwIEMgMTY2IDYzMy42ODEsIDE2MC43ODkgNjQxLjQ3NiwgMTU2LjY2NiA2NDQuODcyIEMgMTUyLjkwNCA2NDcuOTcyLCAxNTQuNjI0IDY0OSwgMTYzLjU3MyA2NDkgQyAxNzEuMTk4IDY0OSwgMTcyLjExMCA2NDguODA2LCAxNzEuODE1IDY0Ny4yNTAgQyAxNzEuNTczIDY0NS45NzMsIDE3MC4zMzUgNjQ1LjQxNywgMTY3LjI0MSA2NDUuMTkzIEMgMTYyLjAxNiA2NDQuODE0LCAxNjEuOTk3IDY0NC4zODUsIDE2NyA2MzkuNTAwIEMgMTczLjk3OSA2MzIuNjg1LCAxNzIuMDg5IDYyNCwgMTYzLjYyNiA2MjQgQyAxNjEuMDEzIDYyNCwgMTU5LjE4MCA2MjQuNzI5LCAxNTcuNDU1IDYyNi40NTUgTSAxOTQuNTU3IDYyNi45MzcgQyAxOTMuNTkzIDYyOC4wMDIsIDE5My4xMDAgNjI5LjM1MiwgMTkzLjQ2MSA2MjkuOTM3IEMgMTk0LjI5MiA2MzEuMjgxLCAxOTcuNjgyIDYzMS4zMjQsIDE5OC41MDAgNjMwIEMgMTk5LjQ0MiA2MjguNDc1LCAyMDIuNzEyIDYyOC44MDgsIDIwMy4zNjAgNjMwLjQ5NSBDIDIwMy43MTQgNjMxLjQxOSwgMjAyLjgzMSA2MzIuODA0LCAyMDEuMDQ3IDYzNC4xMjMgQyAxOTguMzMxIDYzNi4xMzEsIDE5Ny44NzkgNjM5LCAyMDAuMjc4IDYzOSBDIDIwMi42ODMgNjM5LCAyMDQuOTY0IDY0Mi4xOTksIDIwMy45MzMgNjQ0LjEyNiBDIDIwMi43NDUgNjQ2LjM0NCwgMjAwLjEyMyA2NDYuNTQyLCAxOTcuNDgzIDY0NC42MTEgQyAxOTUuMzQyIDY0My4wNDYsIDE5MyA2NDMuNTM3LCAxOTMgNjQ1LjU1MCBDIDE5MyA2NTAuMDk5LCAyMDMuNTQ2IDY1MS41NDUsIDIwNy41NDUgNjQ3LjU0NSBDIDIxMC4zOTMgNjQ0LjY5OCwgMjEwLjYzNyA2NDIuMzU0LCAyMDguNDE2IDYzOS4xODMgQyAyMDcuMjI0IDYzNy40ODIsIDIwNy4wNjYgNjM2LjI0OSwgMjA3Ljc3OCA2MzQuMjA2IEMgMjA4Ljc5NiA2MzEuMjg4LCAyMDcuNzYyIDYyNy4xMDQsIDIwNS43MDAgNjI1Ljc5NCBDIDIwMy4yNDcgNjI0LjIzNCwgMTk2LjM2NCA2MjQuOTQxLCAxOTQuNTU3IDYyNi45MzcgTSAzMjcuNjgyIDYzNS4yNTAgQyAzMTYuODE2IDY1NS4xMjgsIDMxNi41MTcgNjU2LCAzMjAuNTQ3IDY1NiBDIDMyMi4zMjkgNjU2LCAzMjMuNjA0IDY1NS4xMDIsIDMyNC43OTcgNjUzLjAwNiBDIDMyNi4zNDEgNjUwLjI5MiwgMzI2Ljk4MCA2NTAuMDEyLCAzMzEuNjQxIDY1MC4wMDYgQyAzMzYuNzA4IDY1MCwgMzM2LjgwNiA2NTAuMDU4LCAzMzguMzgzIDY1NCBDIDMzOS43NTQgNjU3LjQyNSwgMzQwLjQxNiA2NTgsIDM0Mi45OTIgNjU4IEMgMzQ2LjQwNyA2NTgsIDM0Ni41ODkgNjU3LjM0NCwgMzQ0LjUzNCA2NTIuNDI2IEMgMzQzLjcyNyA2NTAuNDk2LCAzNDEuODYzIDY0NC40MzYsIDM0MC4zOTEgNjM4Ljk1OCBMIDMzNy43MTUgNjI5IDMzNC40MDcgNjI5IEMgMzMxLjM3OSA2MjksIDMzMC44MDggNjI5LjUzMSwgMzI3LjY4MiA2MzUuMjUwIE0gMTgwLjgyMCA2MzMuMjUwIEMgMTgwLjU5MSA2MzQuODYxLCAxNzkuNzE5IDYzNS41OTAsIDE3Ny43NTAgNjM1LjgxNiBDIDE3NC4wNzQgNjM2LjIzOSwgMTc0LjI0MSA2MzguNTk4LCAxNzggNjM5LjM1MCBDIDE4MC4xNDggNjM5Ljc4MCwgMTgxIDY0MC41MjUsIDE4MSA2NDEuOTc1IEMgMTgxIDY0NC43NDUsIDE4My43ODMgNjQ0LjU0OSwgMTg0LjE4MCA2NDEuNzUwIEMgMTg0LjQwOSA2NDAuMTM5LCAxODUuMjgxIDYzOS40MTAsIDE4Ny4yNTAgNjM5LjE4NCBDIDE5MC43MzggNjM4Ljc4MiwgMTkwLjk3MyA2MzYsIDE4Ny41MTkgNjM2IEMgMTg1LjcwNyA2MzYsIDE4NC44NjkgNjM1LjMyNiwgMTg0LjQxMSA2MzMuNTAwIEMgMTgzLjYzMCA2MzAuMzg4LCAxODEuMjUwIDYzMC4yMjIsIDE4MC44MjAgNjMzLjI1MCBNIDYyNi4yNDIgNjMzLjk5NiBDIDYyMy4xMjQgNjM1LjMwMiwgNjIxLjA5MiA2MzkuODEwLCA2MjMuMDU3IDY0MS4wNjYgQyA2MjQuMDc5IDY0MS43MTksIDYyNC45MDEgNjQxLjQwNiwgNjI1Ljg3MiA2MzkuOTk0IEMgNjI3LjQ3MyA2MzcuNjY3LCA2MzEuODA3IDYzNy4zMzQsIDYzMi42MjkgNjM5LjQ3NSBDIDYzMy4zNDYgNjQxLjM0MywgNjMwLjE3NiA2NDYuNDkxLCA2MjUuNTY2IDY1MC45NDYgQyA2MjAuOTE1IDY1NS40NDAsIDYyMC43MTMgNjU4LjUwNywgNjI1LjEyNSA2NTcuNjI1IEMgNjI2Ljg0NCA2NTcuMjgxLCA2MzAuNDQ0IDY1NywgNjMzLjEyNSA2NTcgQyA2MzYuNzkyIDY1NywgNjM4IDY1Ni42MjgsIDYzOCA2NTUuNTAwIEMgNjM4IDY1NC40MTcsIDYzNi44ODkgNjU0LCA2MzQgNjU0IEMgNjI5LjE1MyA2NTQsIDYyOS4xNjMgNjU0LjExNCwgNjMzLjUwMCA2NDguNDMyIEMgNjM2LjkzMCA2NDMuOTM4LCA2MzcuNDMwIDY0Mi41MzIsIDYzNy4wMzQgNjM4LjUwMCBDIDYzNi42MzIgNjM0LjQxNiwgNjMwLjkyNyA2MzIuMDM1LCA2MjYuMjQyIDYzMy45OTYgTSA2NjEuMjUwIDYzNS4yMjAgQyA2NTguNTM2IDYzNi41MjksIDY1OC4yMDkgNjQwLCA2NjAuODAwIDY0MCBDIDY2MS43OTAgNjQwLCA2NjMuMDY1IDYzOS41MzUsIDY2My42MzMgNjM4Ljk2NyBDIDY2NS4xMDIgNjM3LjQ5OCwgNjY4IDYzOC44NzMsIDY2OCA2NDEuMDQwIEMgNjY4IDY0Mi4wNDQsIDY2Ny4xMDAgNjQzLjE1MSwgNjY2IDY0My41MDAgQyA2NjMuMzQxIDY0NC4zNDQsIDY2My40NjIgNjQ2LjI5MCwgNjY2LjI1MCA2NDcuNTEzIEMgNjY4Ljk2NCA2NDguNzA0LCA2NjkuODI2IDY1Mi43NDYsIDY2Ny41NTIgNjUzLjYxOCBDIDY2Ni42NzkgNjUzLjk1NCwgNjY0LjU5NyA2NTMuNjYyLCA2NjIuOTI2IDY1Mi45NzAgQyA2NTguNTY3IDY1MS4xNjQsIDY1Ni40NjEgNjUzLjI5MywgNjU5Ljg2MSA2NTYuMDcxIEMgNjY2LjgzNSA2NjEuNzY5LCA2NzcuNDI5IDY1NC4zNDEsIDY3Mi40NTUgNjQ3LjI0MCBDIDY3MS4yOTggNjQ1LjU4NywgNjcxLjE3MyA2NDQuNTQ2LCA2NzEuOTU1IDY0My4wODMgQyA2NzUuMzc2IDYzNi42OTIsIDY2OC41NjcgNjMxLjY5MiwgNjYxLjI1MCA2MzUuMjIwIE0gMjE0LjY2NyA2MzUuNjY3IEMgMjEyLjMxMCA2MzguMDIzLCAyMTQuMzE0IDYzOSwgMjIxLjUwMCA2MzkgQyAyMjguMzMzIDYzOSwgMjI5IDYzOC44MjIsIDIyOSA2MzcgQyAyMjkgNjM1LjE5NSwgMjI4LjMzMyA2MzUsIDIyMi4xNjcgNjM1IEMgMjE4LjQwOCA2MzUsIDIxNS4wMzMgNjM1LjMwMCwgMjE0LjY2NyA2MzUuNjY3IE0gMzMxLjEzOCA2NDAuNzUwIEwgMzI4Ljk1OSA2NDUgMzMyLjQyOCA2NDUgQyAzMzUuNzU1IDY0NSwgMzM1Ljg2MSA2NDQuODg5LCAzMzUuMDI2IDY0Mi4yNTAgQyAzMzQuNTQ4IDY0MC43MzcsIDMzMy45NjggNjM4LjgyNSwgMzMzLjczNiA2MzggQyAzMzMuNDcyIDYzNy4wNTgsIDMzMi41MDUgNjM4LjA4MiwgMzMxLjEzOCA2NDAuNzUwIE0gNzg4LjIzMSA2NDkuMDg2IEMgNzg0Ljc4MiA2NTUuNzA5LCA3ODIuMjIyIDY2MS41NDksIDc4Mi41NDAgNjYyLjA2NCBDIDc4My44NzkgNjY0LjIzMSwgNzg3Ljc2MSA2NjIuOTkxLCA3ODkgNjYwIEMgNzkwLjE0MCA2NTcuMjQ4LCA3OTAuNjQ1IDY1NywgNzk1LjEwOCA2NTcgQyA3OTkuNzIzIDY1NywgODAwLjA0OCA2NTcuMTgwLCA4MDEuNDM2IDY2MC41MDAgQyA4MDIuNjQzIDY2My4zOTAsIDgwMy40MTcgNjY0LCA4MDUuODc5IDY2NCBDIDgwOC42NzggNjY0LCA4MDguODA3IDY2My44MzIsIDgwNy45NzkgNjYxLjI1MCBDIDgwNy40OTUgNjU5LjczNywgODA1Ljk5NiA2NTQuOTAwLCA4MDQuNjUwIDY1MC41MDAgQyA4MDAuNjczIDYzNy41MDEsIDgwMC4zOTcgNjM2Ljk5NywgNzk3LjI3NSA2MzcuMDIyIEMgNzk0Ljc0OSA2MzcuMDQyLCA3OTMuOTM4IDYzOC4xMjMsIDc4OC4yMzEgNjQ5LjA4NiBNIDM1Ni4zMTQgNjQwLjQyNSBDIDM1MC4yMTMgNjQzLjE1MywgMzQ1LjIzNSA2NTQuNjM2LCAzNDkuMDk1IDY1Ny4wODAgQyAzNTAuOTMzIDY1OC4yNDMsIDM1NC4yNTcgNjU4LjIzMywgMzU3LjM1NyA2NTcuMDU0IEMgMzU5LjIwNyA2NTYuMzUxLCAzNjAuMTUzIDY1Ni40ODAsIDM2MS4wNDUgNjU3LjU1NCBDIDM2MS43MDUgNjU4LjM0OSwgMzYzLjA1NyA2NTksIDM2NC4wNDkgNjU5IEMgMzY1LjYyNCA2NTksIDM2NS44OTYgNjU3Ljg5MSwgMzY2LjE5MyA2NTAuMjUwIEMgMzY2LjM4MCA2NDUuNDM4LCAzNjYuMjg2IDY0MS4xNzEsIDM2NS45ODUgNjQwLjc2OSBDIDM2NC44NDcgNjM5LjI0OSwgMzU5LjM3OCA2MzkuMDU1LCAzNTYuMzE0IDY0MC40MjUgTSA2NDYuODIwIDY0Mi4yNTAgQyA2NDYuNTkxIDY0My44NjEsIDY0NS43MTkgNjQ0LjU5MCwgNjQzLjc1MCA2NDQuODE2IEMgNjQyLjIzNyA2NDQuOTkwLCA2NDEgNjQ1Ljc0OCwgNjQxIDY0Ni41MDAgQyA2NDEgNjQ3LjI1MiwgNjQyLjIzNyA2NDguMDEwLCA2NDMuNzUwIDY0OC4xODQgQyA2NDUuNzE5IDY0OC40MTAsIDY0Ni41OTEgNjQ5LjEzOSwgNjQ2LjgyMCA2NTAuNzUwIEMgNjQ2Ljk5NSA2NTEuOTg3LCA2NDcuNzUyIDY1MywgNjQ4LjUwMCA2NTMgQyA2NDkuMjQ4IDY1MywgNjUwLjAwNSA2NTEuOTg3LCA2NTAuMTgwIDY1MC43NTAgQyA2NTAuMzg2IDY0OS4zMDQsIDY1MS4zMDQgNjQ4LjM4NiwgNjUyLjc1MCA2NDguMTgwIEMgNjUzLjk4NyA2NDguMDA1LCA2NTUgNjQ3LjI0OCwgNjU1IDY0Ni41MDAgQyA2NTUgNjQ1Ljc1MiwgNjUzLjk4NyA2NDQuOTk1LCA2NTIuNzUwIDY0NC44MjAgQyA2NTEuMzA0IDY0NC42MTQsIDY1MC4zODYgNjQzLjY5NiwgNjUwLjE4MCA2NDIuMjUwIEMgNjUwLjAwNSA2NDEuMDEzLCA2NDkuMjQ4IDY0MCwgNjQ4LjUwMCA2NDAgQyA2NDcuNzUyIDY0MCwgNjQ2Ljk5NSA2NDEuMDEzLCA2NDYuODIwIDY0Mi4yNTAgTSAyMTQuNzA4IDY0MS42MjYgQyAyMTIuMzAzIDY0NC4wMzEsIDIxNC4yNzUgNjQ1LCAyMjEuNTczIDY0NSBDIDIyOC4yNDYgNjQ1LCAyMjkuMTA3IDY0NC43OTIsIDIyOC44MTMgNjQzLjI1MCBDIDIyOC41NDMgNjQxLjgzMywgMjI3LjIzNSA2NDEuNDQ1LCAyMjEuOTQ3IDY0MS4yMDkgQyAyMTguMzU1IDY0MS4wNDksIDIxNS4wOTcgNjQxLjIzNywgMjE0LjcwOCA2NDEuNjI2IE0gMzU3LjA1MCA2NDYuMTc2IEMgMzU0LjgwOCA2NDguNTgzLCAzNTMuNDk3IDY1MS44MzAsIDM1NC40MDMgNjUyLjczNiBDIDM1NS4zNTcgNjUzLjY5MCwgMzU4Ljc5MyA2NTAuMDMzLCAzNTkuODg0IDY0Ni45MDMgQyAzNjEuMDkxIDY0My40NDAsIDM1OS44ODcgNjQzLjEzMSwgMzU3LjA1MCA2NDYuMTc2IE0gNjc5IDY0NS40ODEgQyA2NzkgNjQ4LjY4MCwgNjkyLjIxMCA2NDguOTM4LCA2OTIuODE1IDY0NS43NTAgQyA2OTMuMTA1IDY0NC4yMTcsIDY5Mi4yNzAgNjQ0LCA2ODYuMDczIDY0NCBDIDY4MC40OTMgNjQ0LCA2NzkgNjQ0LjMxMywgNjc5IDY0NS40ODEgTSA3OTUuMjA1IDY0Ny4zMTEgQyA3OTMuNTc3IDY1MS44MTMsIDc5My42MjkgNjUyLCA3OTYuNTE5IDY1MiBDIDc5OC43NTkgNjUyLCA3OTguOTY2IDY1MS42OTUsIDc5OC4zODQgNjQ5LjI1MCBDIDc5Ny4xOTkgNjQ0LjI2NywgNzk2LjQ2NyA2NDMuODIwLCA3OTUuMjA1IDY0Ny4zMTEgTSA4MTUuMzYwIDY1MC4yMDUgQyA4MDcuMTA2IDY1OC45MjIsIDgwOC43NzUgNjY3LjM2NiwgODE4LjEwOSA2NjQuMTEyIEMgODIwLjMxNCA2NjMuMzQzLCA4MjEuNzAzIDY2My4zMDMsIDgyMi4zODcgNjYzLjk4NyBDIDgyMi45NDQgNjY0LjU0NCwgODI0LjMyMiA2NjQuOTk5LCA4MjUuNDUwIDY2NC45OTcgQyA4MjcuMzYzIDY2NC45OTUsIDgyNy40OTggNjY0LjQwOSwgODI3LjQ2NyA2NTYuMjQ3IEwgODI3LjQzMyA2NDcuNTAwIDgyMi45NTYgNjQ3LjIwNSBDIDgxOS4wMDUgNjQ2Ljk0NSwgODE4LjExMyA2NDcuMjk3LCA4MTUuMzYwIDY1MC4yMDUgTSA2NzkgNjUxLjUwMCBDIDY3OSA2NTIuNjkwLCA2ODAuNDQ0IDY1MywgNjg2IDY1MyBDIDY5MS41NTYgNjUzLCA2OTMgNjUyLjY5MCwgNjkzIDY1MS41MDAgQyA2OTMgNjUwLjMxMCwgNjkxLjU1NiA2NTAsIDY4NiA2NTAgQyA2ODAuNDQ0IDY1MCwgNjc5IDY1MC4zMTAsIDY3OSA2NTEuNTAwIE0gODE4LjAzOSA2NTQuMTg5IEMgODE1LjkwMCA2NTYuNDg1LCA4MTUuMjgwIDY2MCwgODE3LjAxNSA2NjAgQyA4MTguMDEzIDY2MCwgODIxLjk4OSA2NTQuMjE0LCA4MjEuOTk2IDY1Mi43NTAgQyA4MjIuMDAzIDY1MS4zMTEsIDgyMC4wNjMgNjUyLjAxNiwgODE4LjAzOSA2NTQuMTg5IE0gNDI3LjgyNCA2NjcuNjEwIEMgNDI3LjU2NyA2NjguMDk5LCA0MjcuNjczIDY2OS44NTAsIDQyOC4wNjAgNjcxLjUwMCBDIDQyOC42NDggNjc0LjAwNywgNDI5LjU0OSA2NzMuMjc3LCA0MjkuMDkwIDY3MC42NjUgQyA0MjguOTMxIDY2OS43NTksIDQ4MC45NjQgNjcwLjU1OSwgNTE5LjUwMCA2NzIuMDU1IEMgNTQ5Ljc1OCA2NzMuMjMwLCA1NzcgNjczLjI2NCwgNTc3IDY3Mi4xMjggQyA1NzcgNjcxLjAyMCwgNTU4LjA3NSA2NzAuMTc4LCA1MDYuNTAwIDY2OC45OTQgQyA0ODMuOTUwIDY2OC40NzYsIDQ1Ny4xMjggNjY3Ljc1MiwgNDQ2Ljg5NiA2NjcuMzg2IEMgNDM2LjI3NCA2NjcuMDA2LCA0MjguMDkxIDY2Ny4xMDIsIDQyNy44MjQgNjY3LjYxMCBNIDIwNS42NjUgNjc1LjU0NyBDIDE5NC40NTIgNjc5LjY2MCwgMTg2LjE0MiA2OTAuNjE5LCAxODUuMzIzIDcwMi4zNzUgQyAxODUuMDg4IDcwNS43NDQsIDE4NS4zMjQgNzA5LjEyOCwgMTg1Ljg0NyA3MDkuODk2IEMgMTg3LjQyMiA3MTIuMjA3LCAxODkuODQ4IDcxMC4zNDksIDE5MC41MzkgNzA2LjMwMyBDIDE5Mi40NjUgNjk1LjAzNSwgMTk2LjQ1MiA2ODguODk2LCAyMDQuMzE4IDY4NS4wODggQyAyMDkuODA4IDY4Mi40MzAsIDIxNy4wNjEgNjgyLjMwNSwgMjE5LjM0NSA2ODQuODI5IEMgMjIzLjU1MSA2ODkuNDc2LCAyMTkuNDE2IDY5Ny4wNzQsIDIxMy40OTEgNjk1LjU4NyBDIDIxMC40MjMgNjk0LjgxNywgMjA5IDY5Ny42NzUsIDIwOSA3MDQuNjA1IEMgMjA5IDcyMy41NDAsIDIzMy43NTIgNzI5Ljk5MCwgMjQzLjE5NyA3MTMuNTE3IEMgMjQ2LjM5NCA3MDcuOTQxLCAyNDYuMzczIDY5Ny40NjQsIDI0My4xNTMgNjkwLjgxNCBDIDIzNi44MDIgNjc3LjcwMCwgMjE5LjI2NiA2NzAuNTU5LCAyMDUuNjY1IDY3NS41NDcgTSA0MzMuNTA2IDY3OS4yNTAgQyA0MzIuNTU2IDY4My4yNjUsIDQyNy4wMDMgNzI5LjM4NywgNDI3LjAwMSA3MzMuMjcwIEwgNDI3IDczNy4wNDEgNDMwLjk2MCA3MzUuMDIwIEMgNDQ1LjE4MiA3MjcuNzY1LCA0NTIuOTQ3IDc0My4xOTgsIDQ0MS40NjggNzU1LjkwNCBMIDQzOC4wNTQgNzU5LjY4MyA0NDAuMTA1IDc2My41OTEgQyA0NDEuODM5IDc2Ni44OTMsIDQ0Mi4wODQgNzY4Ljc4MCwgNDQxLjY4OSA3NzUuNzUwIEwgNDQxLjIyMSA3ODQgNDQ0Ljg2MSA3ODQuMDA0IEMgNDQ2Ljg2MiA3ODQuMDA2LCA0NzIuMTI1IDc4NS4xMDYsIDUwMSA3ODYuNDQ5IEMgNTY4IDc4OS41NjQsIDU2NC44ODYgNzg5LjQ0NywgNTY1LjQ2MiA3ODguODcyIEMgNTY1LjczMiA3ODguNjAyLCA1NjcuMDg0IDc3Ny42MDcsIDU2OC40NjcgNzY0LjQ0MCBDIDU3MC43MTEgNzQzLjA2NSwgNTczLjA1NSA3MjAuOTk2LCA1NzYuMDE4IDY5My4zMzAgQyA1NzYuNTU4IDY4OC4yODYsIDU3NyA2ODMuNDk4LCA1NzcgNjgyLjY5MCBDIDU3NyA2ODEuNDY1LCA1NzMuNDc3IDY4MS4xMTQsIDU1NS43NTAgNjgwLjU3MSBDIDU0NC4wNjMgNjgwLjIxMywgNTEzLjYwMSA2NzkuMjYzLCA0ODguMDU5IDY3OC40NjAgQyA0MjguODYyIDY3Ni41OTksIDQzNC4xNTEgNjc2LjUyMiwgNDMzLjUwNiA2NzkuMjUwIE0gMzE4LjcwMyA2NzkuNDQyIEMgMzEyLjY0OCA2ODEuNjAyLCAzMDcuMzkwIDY4NS41NzMsIDMwMy45MzQgNjkwLjU5NiBDIDI5OC41MjYgNjk4LjQ1NiwgMjk2LjI5NiA3MDkuMzQxLCAyOTkuNTQyIDcxMi4wMzUgQyAzMDEuNjI1IDcxMy43NjMsIDMwMi40NTIgNzEyLjU4MywgMzAzLjg5OCA3MDUuODIxIEMgMzA2LjcyOSA2OTIuNTc0LCAzMjIuMjA1IDY4Mi4yMDUsIDMyOSA2ODkgQyAzMzMuMDA5IDY5My4wMDksIDMyOS41NjQgNzAwLjcwOSwgMzI0LjIxNSA2OTkuNjk3IEMgMzE3LjQ0NSA2OTguNDE1LCAzMTkuMDY5IDcxNS4yMDEsIDMyNi4zNjYgNzIxLjkyMiBDIDMyOC43ODYgNzI0LjE1MiwgMzI5Ljg4NSA3MjQuMzYxLCAzNDAuMTYwIDcyNC41NDkgQyAzNTAuODc4IDcyNC43NDUsIDM1MS40MTUgNzI0LjY1NSwgMzUzLjYxNiA3MjIuMjgwIEMgMzU4LjY4MyA3MTYuODEzLCAzNTkuNDg2IDcwMi43MzMsIDM1NS4yMDggNjk0LjM4NyBDIDM0OC43ODAgNjgxLjg0OCwgMzMxLjYzNSA2NzQuODI5LCAzMTguNzAzIDY3OS40NDIgTSA2NzQuNTAwIDY4MC41MjMgQyA2NzEuNzUwIDY4MS4yODcsIDY2OS4yMjYgNjgxLjkzMiwgNjY4Ljg5MSA2ODEuOTU2IEMgNjY3LjE0NSA2ODIuMDgyLCA2NTguNjQ0IDY5MC43NzgsIDY1Ni44NzMgNjk0LjI0OSBDIDY1Mi40ODYgNzAyLjg0OCwgNjUzLjUyNCA3MTUuMDg4LCA2NTkuMTI2IDcyMC44MTggQyA2NjMuMzI1IDcyNS4xMTMsIDY3Ni4wNTcgNzI2LjM2NCwgNjgxLjQ3NyA3MjMuMDE0IEMgNjg2LjU5NSA3MTkuODUxLCA2OTAuMjAxIDcxMy4xOTMsIDY5MC4xNTMgNzA2Ljk5NSBDIDY5MC4xMDQgNzAwLjY4MSwgNjg5LjY1MSA3MDAsIDY4NS40OTggNzAwIEMgNjc5LjY2NCA3MDAsIDY3Ny4wNDYgNjkzLjk1NCwgNjgxLjExNyA2ODkuODgzIEMgNjg2LjE3MSA2ODQuODI5LCA2OTkuMTA1IDY5MC44NjcsIDcwMy41MDUgNzAwLjMzNCBDIDcwNC44MjUgNzAzLjE3NSwgNzA2LjE3MiA3MDcuMTg4LCA3MDYuNDk4IDcwOS4yNTAgQyA3MDYuOTM1IDcxMi4wMTYsIDcwNy41NzUgNzEzLCA3MDguOTM4IDcxMyBDIDcxMS41NDYgNzEzLCA3MTIuMDQ1IDcxMC45MjAsIDcxMC45OTAgNzA0LjQzOCBDIDcwOS4xODAgNjkzLjMxNSwgNzAwLjY3MCA2ODMuNTc0LCA2OTAuMTk3IDY4MC42MzUgQyA2ODMuMjkwIDY3OC42OTcsIDY4MS4xMzIgNjc4LjY4MiwgNjc0LjUwMCA2ODAuNTIzIE0gNTY0Ljc1MCA2ODIuNzIzIEMgNTY2LjUzOCA2ODIuOTQ1LCA1NjkuNDYyIDY4Mi45NDUsIDU3MS4yNTAgNjgyLjcyMyBDIDU3My4wMzggNjgyLjUwMiwgNTcxLjU3NSA2ODIuMzIwLCA1NjggNjgyLjMyMCBDIDU2NC40MjUgNjgyLjMyMCwgNTYyLjk2MiA2ODIuNTAyLCA1NjQuNzUwIDY4Mi43MjMgTSA3NzUuNDc5IDY4Ni4yOTQgQyA3NjUuMTYxIDY5MS4yMjksIDc2MC4wNTkgNjk5LjA4NSwgNzYwLjAyMiA3MTAuMDkzIEMgNzU5Ljk4MSA3MjIuMzkxLCA3NjYuNjYwIDcyOS45NDgsIDc3Ny42MDIgNzI5Ljk4NCBDIDc4Ni42OTggNzMwLjAxMywgNzkzLjk2NCA3MjIuNDc0LCA3OTMuOTcwIDcxMyBDIDc5My45NzUgNzA1LjE1MSwgNzkzLjM0NyA3MDQuMDkyLCA3ODguNzkzIDcwNC4yNzQgQyA3ODQuMDQwIDcwNC40NjMsIDc4MS43NTMgNzAyLjExNCwgNzgyLjIwNiA2OTcuNTA3IEMgNzgyLjYxNCA2OTMuMzUxLCA3ODYuODM1IDY5MS4zMjcsIDc5MS44ODMgNjkyLjg2NiBDIDgwMS4wNTEgNjk1LjY2MiwgODA2LjMyNiA3MDEuODE0LCA4MDkuMDE1IDcxMi44NDYgQyA4MTAuMzE5IDcxOC4xOTQsIDgxMS4wMTYgNzE5LjUwMCwgODEyLjU2OSA3MTkuNTAwIEMgODE0LjMwMCA3MTkuNTAwLCA4MTQuNDkyIDcxOC43NzYsIDgxNC40MjYgNzEyLjUwMCBDIDgxNC4yMTIgNjkyLjM1MCwgNzkyLjg1OSA2NzcuOTgyLCA3NzUuNDc5IDY4Ni4yOTQgTSA0NDYuNjM1IDcwNi4wNzMgQyA0NDMuNTM5IDcwOC41MDgsIDQ0Mi45ODMgNzEzLCA0NDUuNzc4IDcxMyBDIDQ0Ni43NTYgNzEzLCA0NDguMzI2IDcxMi4xMDAsIDQ0OS4yNjggNzExIEMgNDUxLjE5NSA3MDguNzQ5LCA0NTQuMDA1IDcwOC40MDUsIDQ1NS44MDAgNzEwLjIwMCBDIDQ1OC4wMDcgNzEyLjQwNywgNDU3LjA0NiA3MTQuMTgyLCA0NDkuMzc0IDcyMi4wNjYgQyA0MzkuNDU1IDczMi4yNTgsIDQzOS43MDAgNzMzLjE3NywgNDUyLjIzMyA3MzIuNzg4IEMgNDYwLjk4MSA3MzIuNTE2LCA0NjEuNTE4IDczMi4zNzQsIDQ2MS44MjAgNzMwLjI1MCBDIDQ2Mi4xMTUgNzI4LjE3MSwgNDYxLjc1NSA3MjgsIDQ1Ny4wNzAgNzI4IEMgNDU0LjI4MSA3MjgsIDQ1MiA3MjcuNzI5LCA0NTIgNzI3LjM5OSBDIDQ1MiA3MjcuMDY4LCA0NTQuMTM3IDcyNC41NjgsIDQ1Ni43NDkgNzIxLjg0MyBDIDQ2Mi4xODcgNzE2LjE2OCwgNDYzLjMyNyA3MTMuNzY2LCA0NjIuNDU5IDcwOS44MTIgQyA0NjEuMTkwIDcwNC4wMzUsIDQ1MS45ODkgNzAxLjg2MSwgNDQ2LjYzNSA3MDYuMDczIE0gNDg5Ljg2MSA3MDcuOTM1IEMgNDg3LjY3NCA3MDkuNzI4LCA0ODcuNjIwIDcwOS45OTMsIDQ4OS4xMzMgNzExLjUzMyBDIDQ5MC40ODEgNzEyLjkwNCwgNDkxLjE1OSA3MTIuOTg1LCA0OTMuMDEwIDcxMS45OTUgQyA0OTQuNjg5IDcxMS4wOTYsIDQ5NS44NjkgNzExLjA3NSwgNDk3LjcwNSA3MTEuOTExIEMgNTAwLjgwMSA3MTMuMzIyLCA1MDAuMjg4IDcxNS4wNzksIDQ5Ni4yMjAgNzE3IEMgNDkyLjQxMSA3MTguNzk4LCA0OTIuMDMxIDcyMS41NDAsIDQ5NS40NzEgNzIyLjQwMyBDIDQ5OC45MzIgNzIzLjI3MiwgNTAwLjQ2MyA3MjYuMzk0LCA0OTguNDI3IDcyOC40MzEgQyA0OTYuNDE4IDczMC40MzksIDQ5NC4wNDcgNzMwLjQyMiwgNDkxLjEzMCA3MjguMzc4IEMgNDg4Ljk5MyA3MjYuODgyLCA0ODguNjg4IDcyNi44ODMsIDQ4Ny4xNzQgNzI4LjM5NyBDIDQ4NC45MTggNzMwLjY1MywgNDg2LjYwMiA3MzMuMTM0LCA0OTEuNTA1IDczNC43NzYgQyA1MDAuNzk4IDczNy44ODcsIDUwOS41MDEgNzI5LjQ0MywgNTA0LjQ0MyA3MjIuMjIzIEMgNTAzLjAzNCA3MjAuMjExLCA1MDMuMDM0IDcxOS43ODksIDUwNC40NDMgNzE3Ljc3NyBDIDUwOS45MDMgNzA5Ljk4MywgNDk3LjU0MSA3MDEuNjM5LCA0ODkuODYxIDcwNy45MzUgTSA1MzcuMDM4IDcxMS43NTAgQyA1MzYuNDU4IDcxMy44MTMsIDUzNS43MDQgNzE3LjE4OCwgNTM1LjM2MyA3MTkuMjUwIEwgNTM0Ljc0NCA3MjMgNTM4Ljc2MSA3MjMgQyA1NDMuOTAxIDcyMywgNTQ3LjU0MyA3MjUuNzE1LCA1NDYuNTU5IDcyOC44MTMgQyA1NDUuNDYyIDczMi4yNzAsIDU0Mi42MDYgNzMzLjI4MCwgNTM4LjYyOCA3MzEuNjE4IEMgNTM2LjEzMyA3MzAuNTc1LCA1MzQuOTEyIDczMC40ODgsIDUzNC4xMDUgNzMxLjI5NSBDIDUyOS41NzkgNzM1LjgyMSwgNTQxLjAzOSA3NDAuMTAwLCA1NDguMDIwIDczNi40OTAgQyA1NTEuNzMyIDczNC41NzAsIDU1MyA3MzIuMTcxLCA1NTMgNzI3LjA2NiBDIDU1MyA3MjIuMTM5LCA1NTAuNjE1IDcxOS4zOTQsIDU0NS41MDIgNzE4LjQzNCBDIDU0Mi41NTQgNzE3Ljg4MSwgNTQxLjk0OCA3MTcuMzY3LCA1NDIuMTk2IDcxNS42MjkgQyA1NDIuNDU1IDcxMy44MTMsIDU0My4yNzEgNzEzLjQ1NiwgNTQ3Ljc1MCA3MTMuMTk4IEMgNTUyLjU3MSA3MTIuOTIwLCA1NTMgNzEyLjY5NiwgNTUzIDcxMC40NDggQyA1NTMgNzA4LjA3MCwgNTUyLjc4OCA3MDgsIDU0NS41NDcgNzA4IEwgNTM4LjA5NCA3MDggNTM3LjAzOCA3MTEuNzUwIE0gNDczLjY2NyA3MTMuNjY3IEMgNDczLjMwMCA3MTQuMDMzLCA0NzMgNzE1LjEzMCwgNDczIDcxNi4xMDMgQyA0NzMgNzE3LjM2OSwgNDcyLjA3NSA3MTcuOTYzLCA0NjkuNzUwIDcxOC4xODcgQyA0NjUuNDcxIDcxOC41OTksIDQ2NS4wMTkgNzIyLjMyOSwgNDY5LjE4OSA3MjIuODExIEMgNDcxLjI2OCA3MjMuMDUxLCA0NzEuOTQ5IDcyMy43MzIsIDQ3Mi4xODkgNzI1LjgxMSBDIDQ3Mi42MzEgNzI5LjYzNywgNDc2LjM3NSA3MjkuNTg4LCA0NzYuODE2IDcyNS43NTAgQyA0NzcuMDc4IDcyMy40NzMsIDQ3Ny42MTkgNzIzLCA0NzkuOTU5IDcyMyBDIDQ4MS41MTQgNzIzLCA0ODMuMDI4IDcyMi4zNjksIDQ4My4zMjQgNzIxLjU5OCBDIDQ4NC4wMjkgNzE5Ljc2MCwgNDgzLjE3OCA3MTksIDQ4MC40MTMgNzE5IEMgNDc4LjcyMiA3MTksIDQ3Ny45OTQgNzE4LjI1MSwgNDc3LjUwMCA3MTYgQyA0NzYuODgyIDcxMy4xODYsIDQ3NS4xODIgNzEyLjE1MSwgNDczLjY2NyA3MTMuNjY3IE0gNTExLjE4MCA3MjAuMjUwIEMgNTExLjQ4MCA3MjIuMzYxLCA1MTIuMDM5IDcyMi41MTgsIDUyMC4yNTAgNzIyLjc4OSBDIDUyOC4yODYgNzIzLjA1NCwgNTI5IDcyMi45MjMsIDUyOSA3MjEuMTc1IEMgNTI5IDcxOS4xMTQsIDUyNC4xOTEgNzE4LCA1MTUuMjkxIDcxOCBDIDUxMS4yNjkgNzE4LCA1MTAuODkwIDcxOC4yMDcsIDUxMS4xODAgNzIwLjI1MCBNIDUxMC4zNDUgNzI3LjU0MyBDIDUwOS40OTAgNzI5Ljc3MiwgNTA5LjY2MCA3MjkuODI3LCA1MTkuNzgxIDczMC41OTEgQyA1MjguNjAzIDczMS4yNTcsIDUyOSA3MzEuMjAwLCA1MjkgNzI5LjI2MCBDIDUyOSA3MjYuNzI5LCA1MjYuNTc3IDcyNi4wMzEsIDUxNy43MTkgNzI2LjAxNCBDIDUxMi41MjAgNzI2LjAwMywgNTEwLjc5OSA3MjYuMzYwLCA1MTAuMzQ1IDcyNy41NDMgTSA3MDkuMjIzIDczNS41NTcgQyA3MDYuMzg5IDczNy41NDEsIDcwNi4zMjggNzQxLjY1OSwgNzA5LjAwNSA3NTAuMTQ1IEMgNzE0LjU3NCA3NjcuODAxLCA3MzAuMDgwIDc3Ny4yMzYsIDc0My41MDUgNzcxLjEzNyBDIDc1Ni44OTAgNzY1LjA1NiwgNzY4LjA4NCA3MzguOTQyLCA3NTcuMjcxIDczOS4wMjAgQyA3NTUuNzQ3IDczOS4wMzEsIDc1MS41NzUgNzM5LjQ3NSwgNzQ4IDc0MC4wMDcgQyA3MzkuODIwIDc0MS4yMjMsIDcyOC4wNzIgNzM5Ljc2MywgNzE5LjIxOCA3MzYuNDMwIEMgNzExLjU3NiA3MzMuNTU0LCA3MTIuMDI2IDczMy41OTMsIDcwOS4yMjMgNzM1LjU1NyBNIDQzMi40NDMgNzQwLjQwMiBDIDQyOC4zMjUgNzQzLjI4NiwgNDE3LjYyNiA3NDYuOTQ2LCA0MTAuMzU0IDc0Ny45NTcgQyA0MDIuMTkwIDc0OS4wOTMsIDQwMS41MTMgNzQ5LjQyOSwgMzk0LjYyOSA3NTUuNzc1IEMgMzg5LjEyNyA3NjAuODQ2LCAzODkuMTc0IDc2MC42NjAsIDM5My4xNjcgNzYxLjUzNyBDIDM5NC45MDkgNzYxLjkxOSwgMzk4LjQ4OCA3NjQuMjQ3LCA0MDEuMTIwIDc2Ni43MDkgQyA0MDUuNzY0IDc3MS4wNTMsIDQwNi42NzYgNzcyLjc5NywgNDA4Ljk4MCA3ODEuNzQzIEMgNDA5Ljc3NCA3ODQuODI2LCA0MTAuODcxIDc4Ni4zOTksIDQxMi45ODcgNzg3LjQ5MyBDIDQyMi40MDkgNzkyLjM2NSwgNDMxLjk1MSA3ODUuMTUwLCA0MzIuMjI5IDc3Mi45NDIgQyA0MzIuMzU3IDc2Ny4yOTYsIDQzMS4wNDYgNzY1LjM4OSwgNDI0LjMyOSA3NjEuNDUzIEMgNDE5Ljg0MCA3NTguODIyLCA0MTkuNDI2IDc1Ny4wMDgsIDQyMy4zMDkgNzU2Ljk5MCBDIDQyOS4xODggNzU2Ljk2NCwgNDM4Ljg0NyA3NTAuMjA4LCA0NDAuNTE0IDc0NC45NTUgQyA0NDIuMDA5IDc0MC4yNDcsIDQzNi44MzMgNzM3LjMyOCwgNDMyLjQ0MyA3NDAuNDAyIE0gMjQ3LjY2NyA3NDEuNjY3IEMgMjQ0LjgzMiA3NDQuNTAxLCAyNDkuNTY2IDc1Ny4yNzAsIDI1Ni4xMDQgNzY0LjQyNCBDIDI3MC4yNjQgNzc5LjkxNiwgMjg5LjA5MyA3NzYuNTExLCAyOTkuMDEwIDc1Ni42NjMgQyAzMDQuNDg3IDc0NS43MDQsIDMwMi43ODEgNzQzLjM2NiwgMjkxIDc0NS42NzkgQyAyODEuNTY1IDc0Ny41MzIsIDI3Mi4yMjYgNzQ2Ljg3MCwgMjYwLjcwNSA3NDMuNTMxIEMgMjUxLjcxMCA3NDAuOTI1LCAyNDguODIyIDc0MC41MTIsIDI0Ny42NjcgNzQxLjY2NyBNIDU4My4yNTIgNzY0LjUwMCBDIDU4My4yNjMgNzY2LjcwMCwgNTgzLjQ2OCA3NjcuNDgyLCA1ODMuNzA3IDc2Ni4yMzggQyA1ODMuOTQ2IDc2NC45OTQsIDU4My45MzcgNzYzLjE5NCwgNTgzLjY4NyA3NjIuMjM4IEMgNTgzLjQzNyA3NjEuMjgyLCA1ODMuMjQxIDc2Mi4zMDAsIDU4My4yNTIgNzY0LjUwMCBNIDEwOS42NzMgNzczLjAxOSBDIDEwMi45NTQgNzgwLjQ5MiwgMTAwLjU4MSA3ODYuMDg4LCAxMDAuNTYzIDc5NC41MDAgQyAxMDAuNTM5IDgwNS44NTcsIDEwNi43NDIgODE0LjQ4NSwgMTE1LjgwNiA4MTUuNzAxIEMgMTE5LjY2NSA4MTYuMjE4LCAxMTkuNjg0IDgxNi4yMDQsIDExOS4yMzAgODEzLjExMSBDIDExOC45NTIgODExLjIxOSwgMTE5LjIwOSA4MTAsIDExOS44ODcgODEwIEMgMTIwLjQ5OSA4MTAsIDEyMSA4MTAuMzg1LCAxMjEgODEwLjg1NiBDIDEyMSA4MTMuMTU4LCAxMjguNjY4IDgyMS40MDAsIDEzMi4zNzYgODIzLjA4MyBDIDE0My4yNTkgODI4LjAyNiwgMTU3LjMzOCA4MjQuNDcxLCAxNjEuODg3IDgxNS42MzIgQyAxNjUuMTYxIDgwOS4yNjgsIDE2My41MTAgODA1LjMwNSwgMTU1Ljk5NSA4MDEuNDk3IEMgMTQ5Ljg1OSA3OTguMzg4LCAxNTAuMjM3IDc5Ny4zMzAsIDE1Ny43NjYgNzk2LjUzNCBDIDE2Ni41NjQgNzk1LjYwNSwgMTcwLjcwMSA3OTQuMTk1LCAxNzIuOTI0IDc5MS4zNjkgQyAxNzcuMTQxIDc4Ni4wMDgsIDE3MC45NTIgNzgyLjk4OCwgMTU1LjgwNyA3ODMuMDE1IEMgMTQ2LjAyNyA3ODMuMDMyLCAxMzguMjAyIDc4NC43MTYsIDEyOC4zMDUgNzg4LjkzNCBDIDEyMC41OTcgNzkyLjIxOCwgMTE3LjExNCA3OTIuNzE0LCAxMTUuMjAwIDc5MC44MDAgQyAxMTMuNDM3IDc4OS4wMzcsIDExMy43MzMgNzg4LCAxMTYgNzg4IEMgMTE3LjEwMCA3ODgsIDExOCA3ODcuNDg5LCAxMTggNzg2Ljg2MyBDIDExOCA3ODMuMTYwLCAxMTUuNTE5IDc2OCwgMTE0LjkxMyA3NjggQyAxMTQuNTEzIDc2OCwgMTEyLjE1NSA3NzAuMjU5LCAxMDkuNjczIDc3My4wMTkgTSA1ODQuNDI3IDc4NC4zNzggQyA1ODEuNDE4IDc5MC45NTIsIDU3OS40ODMgODA2LjQ5OCwgNTgxLjEzMSA4MTAuODYyIEMgNTgzLjM4OSA4MTYuODQxLCA1OTAuNDUyIDgyMiwgNTk2LjM4MSA4MjIgQyA1OTkuODE2IDgyMiwgNTk5Ljg0OSA4MjEuOTYwLCA1OTguOTQ3IDgxOC44MTYgQyA1OTcuNjIwIDgxNC4xOTAsIDU5OC4yMjggODE0LjMyMywgNjAzLjc4NiA4MTkuODgyIEMgNjE0Ljc0MiA4MzAuODM3LCA2MzMuNjUwIDgzMC4zNjgsIDY0MS45MzEgODE4LjkzNyBDIDY0Ny42NzIgODExLjAxMSwgNjQ2LjAxNiA4MDQuMzA5LCA2MzcuMzcyIDgwMC40ODYgQyA2MzEuMjk5IDc5Ny44MDAsIDYzMS4xMzEgNzk2LjM3NSwgNjM2Ljc4NSA3OTUuNTA4IEMgNjQ4LjY5OSA3OTMuNjgwLCA2NTYuNTUwIDc4OC44ODksIDY1NS44MzQgNzgzLjg4MyBDIDY1NS4yOTIgNzgwLjA5NywgNjUxLjUzOCA3NzguODI4LCA2NDIuNTAwIDc3OS4zNzUgQyA2MjguMzE2IDc4MC4yMzQsIDYxNC4xNjAgNzg1LjQyOCwgNjAzLjAyNyA3OTMuODU2IEMgNTk2Ljk1NiA3OTguNDUzLCA1OTUuMDk2IDc5OC44NjgsIDU5Mi42NTUgNzk2LjE3MSBDIDU5MC4zMjIgNzkzLjU5MywgNTkwLjU3MyA3OTMsIDU5NCA3OTMgQyA1OTcuODE2IDc5MywgNTk3Ljg5MCA3OTMuMjgyLCA1OTIuMDA2IDc4NS40MTEgTCA1ODcuMDEzIDc3OC43MzEgNTg0LjQyNyA3ODQuMzc4IE0gNDAyLjk0NiA3OTQuNTU1IEwgMzk5LjU3MyA3OTguMDM1IDQwMy4wMzcgNzk3LjM3OCBDIDQwNC45NDIgNzk3LjAxNywgNDA3Ljc2NiA3OTYuMjIyLCA0MDkuMzEzIDc5NS42MTEgTCA0MTIuMTI1IDc5NC41MDAgNDA5LjIyMiA3OTIuNzg4IEMgNDA2LjMzMiA3OTEuMDgzLCA0MDYuMzA0IDc5MS4wOTEsIDQwMi45NDYgNzk0LjU1NSBNIDUyOC43MjggNzkyLjcyMiBDIDUzMC41MDMgNzkyLjk0MywgNTMzLjY1MyA3OTIuOTQ2LCA1MzUuNzI4IDc5Mi43MzAgQyA1MzcuODAyIDc5Mi41MTMsIDUzNi4zNTAgNzkyLjMzMywgNTMyLjUwMCA3OTIuMzI4IEMgNTI4LjY1MCA3OTIuMzI0LCA1MjYuOTUyIDc5Mi41MDEsIDUyOC43MjggNzkyLjcyMiBNIDQzOS4yNjkgNzk1LjY5MyBDIDQ0MC4yNDIgNzk1Ljk0NywgNDQxLjU5MiA3OTUuOTMwLCA0NDIuMjY5IDc5NS42NTYgQyA0NDIuOTQ2IDc5NS4zODIsIDQ0Mi4xNTAgNzk1LjE3NSwgNDQwLjUwMCA3OTUuMTk1IEMgNDM4Ljg1MCA3OTUuMjE1LCA0MzguMjk2IDc5NS40MzksIDQzOS4yNjkgNzk1LjY5MyBNIDQ2MC4yNjQgNzk2LjcxOCBDIDQ2MS43ODQgNzk2Ljk0NywgNDY0LjAzNCA3OTYuOTQxLCA0NjUuMjY0IDc5Ni43MDQgQyA0NjYuNDk0IDc5Ni40NjcsIDQ2NS4yNTAgNzk2LjI3OSwgNDYyLjUwMCA3OTYuMjg2IEMgNDU5Ljc1MCA3OTYuMjk0LCA0NTguNzQ0IDc5Ni40ODgsIDQ2MC4yNjQgNzk2LjcxOCBNIDQ3NC43NTAgNzk3LjcyMyBDIDQ3Ni41MzggNzk3Ljk0NSwgNDc5LjQ2MiA3OTcuOTQ1LCA0ODEuMjUwIDc5Ny43MjMgQyA0ODMuMDM4IDc5Ny41MDIsIDQ4MS41NzUgNzk3LjMyMCwgNDc4IDc5Ny4zMjAgQyA0NzQuNDI1IDc5Ny4zMjAsIDQ3Mi45NjIgNzk3LjUwMiwgNDc0Ljc1MCA3OTcuNzIzIE0gNDkzLjI1MCA3OTguNzE2IEMgNDk0Ljc2MiA3OTguOTQ1LCA0OTcuMjM4IDc5OC45NDUsIDQ5OC43NTAgNzk4LjcxNiBDIDUwMC4yNjIgNzk4LjQ4NywgNDk5LjAyNSA3OTguMzAwLCA0OTYgNzk4LjMwMCBDIDQ5Mi45NzUgNzk4LjMwMCwgNDkxLjczOCA3OTguNDg3LCA0OTMuMjUwIDc5OC43MTYgTSA1MTUuNzUwIDc5OS43MzIgQyA1MTguMDg3IDc5OS45NDMsIDUyMS45MTMgNzk5Ljk0MywgNTI0LjI1MCA3OTkuNzMyIEMgNTI2LjU4NyA3OTkuNTIyLCA1MjQuNjc1IDc5OS4zNDksIDUyMCA3OTkuMzQ5IEMgNTE1LjMyNSA3OTkuMzQ5LCA1MTMuNDEzIDc5OS41MjIsIDUxNS43NTAgNzk5LjczMiBNIDUzNC43NTAgODAwLjcwNiBDIDUzNS45ODcgODAwLjk0NCwgNTM4LjAxMyA4MDAuOTQ0LCA1MzkuMjUwIDgwMC43MDYgQyA1NDAuNDg3IDgwMC40NjcsIDUzOS40NzUgODAwLjI3MiwgNTM3IDgwMC4yNzIgQyA1MzQuNTI1IDgwMC4yNzIsIDUzMy41MTMgODAwLjQ2NywgNTM0Ljc1MCA4MDAuNzA2IE0gNjA0LjUwNSA4MzQuMjI2IEMgNjA4LjcyMiA4NTQuNjk2LCA2MDkuNzQxIDg1NiwgNjIxLjUyNSA4NTYgTCA2MjguODk2IDg1NiA2MjguMDA2IDg1My4yNTAgQyA2MjcuNTE3IDg1MS43MzcsIDYyNi42MDkgODQ3LjkxMywgNjI1Ljk4OCA4NDQuNzUwIEwgNjI0Ljg1OCA4MzkgNjE2Ljk4OCA4MzkgQyA2MDguOTE3IDgzOSwgNjA2LjIxOSA4MzcuNzc2LCA2MDkuMzEwIDgzNS41MTYgQyA2MTAuNzE2IDgzNC40ODcsIDYxMC40NjYgODM0LjExNiwgNjA3LjM3OCA4MzIuNjQzIEwgNjAzLjgzMCA4MzAuOTUxIDYwNC41MDUgODM0LjIyNiBNIDEzNi4wMTcgODM0LjUwMCBDIDEzNi4wNTAgODM2LjkzMSwgMTM3LjgyMyA4MzguMzkyLCAxMzkuMjc2IDgzNy4xODYgQyAxNDAuMDYyIDgzNi41MzQsIDE0My40NzEgODM1LjcxMSwgMTQ2Ljg1MiA4MzUuMzU4IEMgMTU1LjYzMyA4MzQuNDQwLCAxNTQuNDQ0IDgzMy41MDAsIDE0NC41MDMgODMzLjUwMCBDIDEzOS40OTUgODMzLjUwMCwgMTM2LjAxMCA4MzMuOTExLCAxMzYuMDE3IDgzNC41MDAgTSA1NTIuMTU4IDgzNiBDIDU1Mi4xNTggODM3LjM3NSwgNTUyLjM4NSA4MzcuOTM4LCA1NTIuNjYyIDgzNy4yNTAgQyA1NTIuOTQwIDgzNi41NjMsIDU1Mi45NDAgODM1LjQzOCwgNTUyLjY2MiA4MzQuNzUwIEMgNTUyLjM4NSA4MzQuMDYzLCA1NTIuMTU4IDgzNC42MjUsIDU1Mi4xNTggODM2IE0gODY4IDgzNS43MDQgQyA4NDguNTM0IDgzNy44MzgsIDgyOS4xNDkgODUxLjk2NSwgODE5LjU2NiA4NzEgQyA4MTUuNzYyIDg3OC41NTYsIDgxNS44MDEgODc5LjU2NiwgODIwLjA3MSA4ODMuODM2IEMgODI0LjUyMSA4ODguMjg2LCA4MzAuMTMzIDg5MC4yMjMsIDgyOS4yOTUgODg3LjAyMCBDIDgyOS4wMjMgODg1Ljk4MiwgODI5LjMzMSA4ODMuNTI3LCA4MjkuOTc4IDg4MS41NjYgTCA4MzEuMTU1IDg3OCA4MzkuMzI4IDg3Ny45OTYgQyA4NTIuMDc3IDg3Ny45OTAsIDg1Ny41MTcgODczLjI0NiwgODYwLjM2MyA4NTkuNjUxIEMgODYxLjE1MiA4NTUuODg1LCA4NjIuMjkyIDg1Mi4zMDgsIDg2Mi44OTcgODUxLjcwMyBDIDg2NC43MjUgODQ5Ljg3NSwgODg0LjYxMCA4NTAuMjk0LCA4OTEgODUyLjI5NSBDIDkwMy44NzcgODU2LjMyOCwgOTE1LjgzNSA4NjYuNDQ5LCA5MjIuMzMzIDg3OC44MTQgQyA5MjYuNjM5IDg4Ny4wMDksIDkyNi44MjYgODg4LjY2NywgOTIzLjYwNSA4OTAuMTM0IEMgOTE5LjI1NCA4OTIuMTE3LCA5MTUgOTAwLjc5OSwgOTE1IDkwNy42OTYgQyA5MTUgOTA3LjkyOCwgOTE0LjQ4MCA5MDcuNzk3LCA5MTMuODQ1IDkwNy40MDUgQyA5MTMuMTc1IDkwNi45OTAsIDkxMi45NjEgOTA3LjEyOCwgOTEzLjMzNCA5MDcuNzMyIEMgOTEzLjY4OCA5MDguMzA0LCA5MTMuMDgzIDkwOS4wMDcsIDkxMS45ODkgOTA5LjI5MyBDIDkwOS4wNTMgOTEwLjA2MCwgOTA5LjU1NiA5MTIuNTAzLCA5MTMuNTY0IDkxNi45MzkgQyA5MTcuMzM4IDkyMS4xMTcsIDkyMS43NjQgOTIzLjIyMSwgOTMxLjUxMiA5MjUuNDc0IEMgOTM0LjgwNiA5MjYuMjM1LCA5MzkuOTYxIDkyNy41NjQsIDk0Mi45NjggOTI4LjQyOSBDIDk0OS45NTQgOTMwLjQzNiwgOTYxLjE1NCA5MzAuNDQwLCA5NjcuODk3IDkyOC40MzggQyA5NzIuNjY3IDkyNy4wMjIsIDk3My44MDAgOTI3LjAyMiwgOTgwLjAyNiA5MjguNDM4IEMgOTkxLjQzNiA5MzEuMDMzLCAxMDA2LjkwMSA5MjkuODE3LCAxMDExLjU0OSA5MjUuOTU5IEMgMTAxMi41MTkgOTI1LjE1NCwgMTAxNC43NzAgOTI0Ljk5MSwgMTAxOC40OTIgOTI1LjQ1NiBDIDEwMjMuOTIwIDkyNi4xMzQsIDEwMjQgOTI2LjEwNywgMTAyNCA5MjMuNTcyIEMgMTAyNCA5MjEuMjkwLCAxMDIzLjU5OCA5MjEsIDEwMjAuNDM0IDkyMSBDIDEwMTguNDczIDkyMSwgMTAxNi4wMjIgOTIwLjU0NywgMTAxNC45ODggOTE5Ljk5NCBDIDEwMTMuNTMyIDkxOS4yMTQsIDEwMTIuMjY4IDkxOS41NTcsIDEwMDkuMzgyIDkyMS41MTYgQyAxMDAwLjUwOSA5MjcuNTM3LCA5ODguMzQxIDkyOC40MDMsIDk3OC44MTggOTIzLjY5MCBMIDk3My45MTggOTIxLjI2NSA5NjcuODA2IDkyMy43MzQgQyA5NTkuNDY2IDkyNy4xMDMsIDk0OS4xNzggOTI2LjczNywgOTQzLjM5NyA5MjIuODY2IEMgOTQwLjUyNiA5MjAuOTQ0LCA5MzguMDUyIDkyMC4yMDgsIDkzNCA5MjAuMDcxIEMgOTIzLjU1MiA5MTkuNzE3LCA5MTYuOTgwIDkxMi4yODYsIDkxOC40NDkgOTAyLjQ4OCBDIDkxOS4zOTYgODk2LjE3NywgOTI1LjkzMyA4ODksIDkzMC43MzYgODg5IEMgOTMzLjA5OSA4ODksIDkzNC4yNjYgODg4LjE5NiwgOTM2LjI0NiA4ODUuMjA1IEwgOTM4Ljc1NyA4ODEuNDEwIDkzNS45NDUgODc1LjIxNSBDIDkyNi40MTcgODU0LjIyNiwgOTA1LjkxOCA4MzguODA4LCA4ODMuODY2IDgzNi4wNDIgQyA4NzUuNTY3IDgzNS4wMDIsIDg3NC41OTIgODM0Ljk4MSwgODY4IDgzNS43MDQgTSA1NDMuMTU4IDgzOCBDIDU0My4xNTggODM5LjM3NSwgNTQzLjM4NSA4MzkuOTM4LCA1NDMuNjYyIDgzOS4yNTAgQyA1NDMuOTQwIDgzOC41NjMsIDU0My45NDAgODM3LjQzOCwgNTQzLjY2MiA4MzYuNzUwIEMgNTQzLjM4NSA4MzYuMDYzLCA1NDMuMTU4IDgzNi42MjUsIDU0My4xNTggODM4IE0gMzUyLjA5NyA4MzguMzgzIEMgMzUwLjMwMyA4NDAuNTQ1LCAzNTIuMTQzIDg0MC44MDQsIDM3MC4zNDIgODQwLjk1MCBDIDM4Ni40OTIgODQxLjA4MCwgMzg3IDg0MS4wMjIsIDM4NyA4MzkuMDQyIEMgMzg3IDgzNy4wNjcsIDM4Ni40NTAgODM3LCAzNzAuMTIyIDgzNyBDIDM1Ni45NzMgODM3LCAzNTIuOTkxIDgzNy4zMDYsIDM1Mi4wOTcgODM4LjM4MyBNIDU1My4xOTUgODQwLjUwMCBDIDU1My4yMTUgODQyLjE1MCwgNTUzLjQzOSA4NDIuNzA0LCA1NTMuNjkzIDg0MS43MzEgQyA1NTMuOTQ3IDg0MC43NTgsIDU1My45MzAgODM5LjQwOCwgNTUzLjY1NiA4MzguNzMxIEMgNTUzLjM4MiA4MzguMDU0LCA1NTMuMTc1IDgzOC44NTAsIDU1My4xOTUgODQwLjUwMCBNIDEzOC40NDUgODQzLjcwOCBDIDE0MC4zMDkgODU0LjA0MiwgMTQ0LjM1MyA4NTgsIDE1My4wNDcgODU4IEMgMTU4LjczNyA4NTgsIDE1OC42MTQgODU4LjQwMiwgMTU2LjExMiA4NDggTCAxNTQuMzA4IDg0MC41MDAgMTQ2LjAzNSA4NDAuMjA4IEwgMTM3Ljc2MiA4MzkuOTE1IDEzOC40NDUgODQzLjcwOCBNIDU0NS4xOTUgODQ5LjUwMCBDIDU0NS4yMTUgODUxLjE1MCwgNTQ1LjQzOSA4NTEuNzA0LCA1NDUuNjkzIDg1MC43MzEgQyA1NDUuOTQ3IDg0OS43NTgsIDU0NS45MzAgODQ4LjQwOCwgNTQ1LjY1NiA4NDcuNzMxIEMgNTQ1LjM4MiA4NDcuMDU0LCA1NDUuMTc1IDg0Ny44NTAsIDU0NS4xOTUgODQ5LjUwMCBNIDQzMCA4NTYuNTAwIEMgNDI5LjM0MCA4NTguNDk5LCA0MjkuMDI2IDg2MC4zNTksIDQyOS4zMDEgODYwLjYzNCBDIDQyOS41NzYgODYwLjkwOSwgNDMwLjM0MCA4NTkuNDk5LCA0MzEgODU3LjUwMCBDIDQzMS42NjAgODU1LjUwMSwgNDMxLjk3NCA4NTMuNjQxLCA0MzEuNjk5IDg1My4zNjYgQyA0MzEuNDI0IDg1My4wOTEsIDQzMC42NjAgODU0LjUwMSwgNDMwIDg1Ni41MDAgTSA1NDYuMTU3IDg1NC41MDAgQyA1NDYuMTM0IDg1NS42MDAsIDU0Ni40ODggODU4LjMwMCwgNTQ2Ljk0MyA4NjAuNTAwIEwgNTQ3Ljc3MCA4NjQuNTAwIDU0Ny43ODUgODYxIEMgNTQ3Ljc5NCA4NTkuMDc1LCA1NDcuNDQwIDg1Ni4zNzUsIDU0NyA4NTUgQyA1NDYuMzUyIDg1Mi45NzgsIDU0Ni4xOTEgODUyLjg4MiwgNTQ2LjE1NyA4NTQuNTAwIE0gNDI2LjQ4MCA4NjUuNDE0IEMgNDI1LjUwNyA4NjcuOTYxLCA0MjQuOTYwIDg3MC4yOTMsIDQyNS4yNjQgODcwLjU5NyBDIDQyNS41NjggODcwLjkwMSwgNDI2LjM5OCA4NjkuNTQxLCA0MjcuMTA5IDg2Ny41NzUgQyA0MjcuOTk4IDg2NS4xMTcsIDQyOS4wNDIgODYzLjk3NSwgNDMwLjQ1MSA4NjMuOTIxIEMgNDMxLjkxMiA4NjMuODY1LCA0MzIuMDY5IDg2My42NzgsIDQzMSA4NjMuMjcxIEMgNDMwLjE3NSA4NjIuOTU3LCA0MjkuMjE4IDg2Mi4yNjksIDQyOC44NzQgODYxLjc0MiBDIDQyOC41MzAgODYxLjIxNSwgNDI3LjQ1MiA4NjIuODY3LCA0MjYuNDgwIDg2NS40MTQgTSA1NTguMTU4IDg2OCBDIDU1OC4xNTggODY5LjM3NSwgNTU4LjM4NSA4NjkuOTM4LCA1NTguNjYyIDg2OS4yNTAgQyA1NTguOTQwIDg2OC41NjMsIDU1OC45NDAgODY3LjQzOCwgNTU4LjY2MiA4NjYuNzUwIEMgNTU4LjM4NSA4NjYuMDYzLCA1NTguMTU4IDg2Ni42MjUsIDU1OC4xNTggODY4IE0gNTQ5LjE5OCA4NzIuNTAwIEMgNTQ5LjE5NSA4NzQuMTUwLCA1NDkuODAxIDg3Ny43NTAsIDU1MC41NDUgODgwLjUwMCBMIDU1MS44OTggODg1LjUwMCA1NTEuNDU0IDg4MSBDIDU1MS4yMTAgODc4LjUyNSwgNTUwLjYwNCA4NzQuOTI1LCA1NTAuMTA4IDg3MyBDIDU0OS4yMTQgODY5LjUzNywgNTQ5LjIwNSA4NjkuNTMyLCA1NDkuMTk4IDg3Mi41MDAgTSAyNDEgODg1LjUwMCBMIDI0MSA5MDAgMjU2LjI1MCA5MDAuMDAyIEwgMjcxLjUwMCA5MDAuMDAzIDI3MS4xOTkgODg2LjE0NiBMIDI3MC44OTggODcyLjI4OSAyNjIuNjk5IDg3MS42NTAgQyAyNTguMTkwIDg3MS4yOTksIDI1MS40NjMgODcxLjAwOSwgMjQ3Ljc1MCA4NzEuMDA2IEwgMjQxIDg3MSAyNDEgODg1LjUwMCBNIDU1OS4xOTUgODczLjUwMCBDIDU1OS4yMTUgODc1LjE1MCwgNTU5LjQzOSA4NzUuNzA0LCA1NTkuNjkzIDg3NC43MzEgQyA1NTkuOTQ3IDg3My43NTgsIDU1OS45MzAgODcyLjQwOCwgNTU5LjY1NiA4NzEuNzMxIEMgNTU5LjM4MiA4NzEuMDU0LCA1NTkuMTc1IDg3MS44NTAsIDU1OS4xOTUgODczLjUwMCBNIDY2Mi42ODkgODc4LjM2NyBDIDY2Mi4zNDEgODc5LjI3NiwgNjYzLjQ4MiA4ODAuMTY5LCA2NjYuMDk3IDg4MS4wMzIgQyA2NzMuMDIyIDg4My4zMTcsIDY3Mi43NzcgODg0LjYzOCwgNjY1LjMwMSA4ODUuMzM2IEMgNjUyLjY4OSA4ODYuNTE0LCA2NDMuNzIxIDg5My4xMTAsIDY0My41NzEgOTAxLjMxOCBDIDY0My40NzYgOTA2LjU2MiwgNjQ2LjQwMyA5MDguNjc2LCA2NTUuNTI5IDkwOS45NDkgQyA2NjIuMDMyIDkxMC44NTcsIDY4Mi4wNjYgOTA5Ljk4MiwgNjg2IDkwOC42MTkgQyA2ODYuODI1IDkwOC4zMzMsIDY4OS40MTEgOTA3LjYxMCwgNjkxLjc0NiA5MDcuMDEyIEMgNjk4LjY2MyA5MDUuMjQxLCA3MDAgOTAzLjAyNSwgNzAwIDg5My4zMjggTCA3MDAgODg1LjAzNCA2OTUuMTkxIDg4Mi41OTcgQyA2ODYuMDI2IDg3Ny45NTIsIDY2My45NTEgODc1LjA4MCwgNjYyLjY4OSA4NzguMzY3IE0gNTYwLjE5NSA4ODAuNTAwIEMgNTYwLjIxNSA4ODIuMTUwLCA1NjAuNDM5IDg4Mi43MDQsIDU2MC42OTMgODgxLjczMSBDIDU2MC45NDcgODgwLjc1OCwgNTYwLjkzMCA4NzkuNDA4LCA1NjAuNjU2IDg3OC43MzEgQyA1NjAuMzgyIDg3OC4wNTQsIDU2MC4xNzUgODc4Ljg1MCwgNTYwLjE5NSA4ODAuNTAwIE0gMzEyIDg4MC4xMDAgQyAzMDIuNzgzIDg4MS4xMzMsIDI5My44MTUgODgzLjI5MywgMjg3LjQ5MSA4ODYuMDA0IEwgMjgyLjcwOCA4ODguMDU0IDI4My4zNDEgODk2LjI3MiBDIDI4NC4xNzcgOTA3LjEwOSwgMjg1LjU1OCA5MDguOTUyLCAyOTQuNTg5IDkxMS4yODUgQyAzMDMuMTIyIDkxMy40ODgsIDMyNS45NTUgOTEzLjkzMCwgMzMzLjgxNyA5MTIuMDQ0IEMgMzQyLjI2NiA5MTAuMDE3LCAzNDMuODk1IDkwNS4yOTAsIDMzOC45NDggODk3LjE1NSBDIDMzNi4zMjkgODkyLjg0OSwgMzI4LjQ4MiA4ODkuMjY3LCAzMTkuNzg5IDg4OC40MTEgQyAzMTIuMDc3IDg4Ny42NTEsIDMxMS41NTMgODg3LjA2MCwgMzE2LjUwMCA4ODQuNzAxIEMgMzE4Ljc5MSA4ODMuNjA5LCAzMjAgODgyLjMzNiwgMzIwIDg4MS4wMTYgQyAzMjAgODc5LjkwNywgMzE5Ljg4NyA4NzkuMDU4LCAzMTkuNzUwIDg3OS4xMzAgQyAzMTkuNjEzIDg3OS4yMDEsIDMxNi4xMjUgODc5LjYzOCwgMzEyIDg4MC4xMDAgTSAxOTIuNzUwIDg4MC41NTIgQyAxOTEuMzMzIDg4Mi4wMjgsIDE5Mi4wMTAgODgyLjczMiwgMTk2LjUwMCA4ODQuNDQ3IEMgMjAyLjUwOSA4ODYuNzQyLCAyMDIuMTc0IDg4Ny41OTIsIDE5NC45NjIgODg4LjM0NiBDIDE4MS45MzEgODg5LjcwOCwgMTczIDg5Ni4yODIsIDE3MyA5MDQuNTEyIEMgMTczIDkxMS40NzQsIDE3NS4xODAgOTEyLjQwMCwgMTkyLjY1MCA5MTIuODUxIEMgMjEzLjI3MyA5MTMuMzg1LCAyMjYuNDYyIDkxMC42NzAsIDIyOC44NjQgOTA1LjM5OSBDIDIyOS40ODkgOTA0LjAyOCwgMjMwIDg5OS41NjEsIDIzMCA4OTUuNDczIEwgMjMwIDg4OC4wNDEgMjI2LjI1MCA4ODYuMTMxIEMgMjE4LjA2OSA4ODEuOTY0LCAxOTUuMDcyIDg3OC4xMzQsIDE5Mi43NTAgODgwLjU1MiBNIDU1NC4yNTAgODg2LjcxNiBDIDU1NS43NjMgODg2Ljk0NSwgNTU4LjIzNyA4ODYuOTQ1LCA1NTkuNzUwIDg4Ni43MTYgQyA1NjEuMjYzIDg4Ni40ODcsIDU2MC4wMjUgODg2LjMwMCwgNTU3IDg4Ni4zMDAgQyA1NTMuOTc1IDg4Ni4zMDAsIDU1Mi43MzcgODg2LjQ4NywgNTU0LjI1MCA4ODYuNzE2IiBzdHJva2U9Im5vbmUiIGZpbGw9IiMwMDAwMDAiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPjwvc3ZnPg==";

const DEFAULTS: Settings = {
  input: "",
  backgroundMode: "transparent",
  backgroundColor: "#ffffff",
  colorMode: "preserve",
  forceColor: "#111827",
  removeScripts: true,
  removeMetadata: true,
  removeRasterImages: false,
  removeComments: true,
  normalizeViewBox: true,
  responsiveSvg: true,
  minifyOutput: true,
  addSvgNote: true,
  targetWidth: 8,
  unit: "in",
  rasterMode: "layered",
  layerCount: 5,
  maxTraceSide: MAX_TRACE_SIDE_DEFAULT,
  minRegionPercent: 0.35,
  layerOptTolerance: 0.45,
  layerTurdSize: 4,
  layerTurnPolicy: "majority",
  posterize: true,
  removeWhite: false,
  removeTransparent: true,
  threshold: 224,
  turdSize: 2,
  optTolerance: 0.28,
  turnPolicy: "minority",
  lineColor: "#000000",
  invert: false,
  preprocess: "none",
  blurSigma: 0.8,
  edgeBoost: 1.0,
};

const PRESETS: Preset[] = [
  {
    id: "line-accurate",
    label: "Lineart - Accurate",
    help: "Single-color trace preset from the main converter. Best for clean black lineart and non-colored SVG paths.",
    settings: {
      rasterMode: "single",
      preprocess: "none",
      threshold: 224,
      turdSize: 2,
      optTolerance: 0.28,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      backgroundMode: "transparent",
    },
  },
  {
    id: "line-bold",
    label: "Lineart - Bold",
    help: "Single-color trace preset for thicker, bolder paths from Base64 raster images.",
    settings: {
      rasterMode: "single",
      preprocess: "none",
      threshold: 212,
      turdSize: 3,
      optTolerance: 0.38,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      backgroundMode: "transparent",
    },
  },
  {
    id: "line-fine",
    label: "Lineart - Fine detail",
    help: "Single-color trace preset for thinner details and sharper non-colored SVG output.",
    settings: {
      rasterMode: "single",
      preprocess: "none",
      threshold: 232,
      turdSize: 1,
      optTolerance: 0.22,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      backgroundMode: "transparent",
    },
  },
  {
    id: "line-gap",
    label: "Lineart - Seal gaps",
    help: "Single-color trace preset that helps close small gaps in scanned or imperfect lineart.",
    settings: {
      rasterMode: "single",
      preprocess: "none",
      threshold: 218,
      turdSize: 3,
      optTolerance: 0.34,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
      backgroundMode: "transparent",
    },
  },
  {
    id: "photo-edge-normal",
    label: "Photo Edge - Normal",
    help: "Single-color edge trace preset for turning Base64 photos into outline-style SVG paths.",
    settings: {
      rasterMode: "single",
      preprocess: "edge",
      blurSigma: 0.9,
      edgeBoost: 1.1,
      threshold: 220,
      turdSize: 2,
      optTolerance: 0.35,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      backgroundMode: "transparent",
    },
  },
  {
    id: "photo-edge-bold",
    label: "Photo Edge - Bold",
    help: "Single-color edge trace preset for stronger outlines from Base64 photos and artwork.",
    settings: {
      rasterMode: "single",
      preprocess: "edge",
      blurSigma: 0.6,
      edgeBoost: 1.4,
      threshold: 230,
      turdSize: 3,
      optTolerance: 0.4,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      backgroundMode: "transparent",
    },
  },
  {
    id: "scan-clean",
    label: "Scan - Clean",
    help: "Single-color trace preset that removes small speckles from scans or copied artwork.",
    settings: {
      rasterMode: "single",
      preprocess: "none",
      threshold: 226,
      turdSize: 4,
      optTolerance: 0.3,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      backgroundMode: "transparent",
    },
  },
  {
    id: "logo-clean-single",
    label: "Logo - Clean shapes",
    help: "Single-color trace preset for logos, icons, and clean high-contrast designs.",
    settings: {
      rasterMode: "single",
      preprocess: "none",
      threshold: 210,
      turdSize: 2,
      optTolerance: 0.25,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      backgroundMode: "transparent",
    },
  },
  {
    id: "invert-white-on-black",
    label: "Invert - White lines on black",
    help: "Single-color inverted trace preset for white paths on a dark preview background.",
    settings: {
      rasterMode: "single",
      preprocess: "none",
      threshold: 225,
      turdSize: 2,
      optTolerance: 0.3,
      turnPolicy: "minority",
      invert: true,
      lineColor: "#ffffff",
      backgroundMode: "solid",
      backgroundColor: DARK_BG_DEFAULT,
    },
  },
  {
    id: "clean-svg",
    label: "Clean SVG",
    help: "Best default for decoded SVG data URLs. Removes unsafe code and keeps colors intact.",
    settings: {
      colorMode: "preserve",
      removeScripts: true,
      removeMetadata: true,
      removeRasterImages: false,
      removeComments: true,
      normalizeViewBox: true,
      responsiveSvg: true,
      minifyOutput: true,
      backgroundMode: "transparent",
    },
  },
  {
    id: "single-color-svg",
    label: "Single-color SVG file",
    help: "For simple single-color SVG output where all paths should become one solid color.",
    settings: {
      colorMode: "force-fill",
      forceColor: "#111827",
      removeScripts: true,
      removeMetadata: true,
      removeRasterImages: true,
      removeComments: true,
      normalizeViewBox: true,
      responsiveSvg: true,
      backgroundMode: "transparent",
    },
  },
  {
    id: "outline-only",
    label: "Outline preview",
    help: "For checking SVG paths and outlines before uploading to an SVG editor.",
    settings: {
      colorMode: "force-stroke",
      forceColor: "#0ea5e9",
      removeScripts: true,
      removeMetadata: true,
      removeRasterImages: true,
      removeComments: true,
      normalizeViewBox: true,
      responsiveSvg: true,
      backgroundMode: "transparent",
    },
  },
  {
    id: "keep-print-art",
    label: "Keep printable artwork",
    help: "Preserves colors and embedded image references for printable or mixed SVG artwork.",
    settings: {
      colorMode: "preserve",
      removeScripts: true,
      removeMetadata: true,
      removeRasterImages: false,
      removeComments: true,
      normalizeViewBox: true,
      responsiveSvg: true,
      backgroundMode: "transparent",
    },
  },
  {
    id: "white-background",
    label: "White preview background",
    help: "Adds a white background for easier previewing, labels, and print-style SVGs.",
    settings: {
      colorMode: "preserve",
      backgroundMode: "solid",
      backgroundColor: "#ffffff",
      removeScripts: true,
      removeMetadata: true,
      removeRasterImages: false,
      removeComments: true,
      normalizeViewBox: true,
      responsiveSvg: true,
    },
  },
  {
    id: "strict-clean",
    label: "Strict clean SVG",
    help: "Removes scripts, metadata, comments, and embedded raster images for cleaner SVG output.",
    settings: {
      colorMode: "preserve",
      removeScripts: true,
      removeMetadata: true,
      removeRasterImages: true,
      removeComments: true,
      normalizeViewBox: true,
      responsiveSvg: true,
      minifyOutput: true,
      backgroundMode: "transparent",
    },
  },
];

const PRESET_DISPLAY_ORDER = [
  "clean-svg",
  "white-background",
  "single-color-svg",
  "outline-only",
  "strict-clean",
  "keep-print-art",
  "logo-clean-single",
  "line-accurate",
  "line-bold",
  "line-fine",
  "line-gap",
  "photo-edge-normal",
  "photo-edge-bold",
  "scan-clean",
  "invert-white-on-black",
];

const DISPLAY_PRESETS: Preset[] = [
  ...PRESET_DISPLAY_ORDER.map((id) =>
    PRESETS.find((preset) => preset.id === id),
  ).filter((preset): preset is Preset => Boolean(preset)),
  ...PRESETS.filter((preset) => !PRESET_DISPLAY_ORDER.includes(preset.id)),
];

/* ========================
   Page
======================== */
export default function Base64ToSvg({}: Route.ComponentProps) {
  const fetcher = useFetcher<RasterLayeredServerResult>();
  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] = React.useState<string>("clean-svg");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showTips, setShowTips] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [layeredRaster, setLayeredRaster] =
    React.useState<DecodedResult | null>(null);
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [manualRasterSubmitNonce, setManualRasterSubmitNonce] =
    React.useState(0);
  const lastRasterSubmitKey = React.useRef<string>("");
  const lastHistorySignature = React.useRef<string>("");
  const suppressNextHistoryInsert = React.useRef(false);

  const activePresetObject =
    DISPLAY_PRESETS.find((preset) => preset.id === activePreset) ??
    DISPLAY_PRESETS[0];

  const localDecoded = React.useMemo(() => {
    return decodeAndCleanSvg(settings);
  }, [settings]);

  const isRasterInput =
    localDecoded.kind === "raster-data-url" ||
    localDecoded.kind === "plain-base64-raster";

  const decoded = React.useMemo(() => {
    if (layeredRaster) return layeredRaster;

    if (!isRasterInput) return localDecoded;

    if (fetcher.data?.error) {
      return {
        ...localDecoded,
        svg: "",
        displaySvg: "",
        error: fetcher.data.error,
        warning: null,
        pathCount: 0,
        hasRasterImage: false,
        note: "Layered SVG conversion needs a cleaner or smaller image.",
      };
    }

    return {
      ...localDecoded,
      svg: "",
      displaySvg: "",
      warning: null,
      pathCount: 0,
      hasRasterImage: false,
      note: "Converting the Base64 image into layered SVG paths.",
    };
  }, [fetcher.data?.error, isRasterInput, layeredRaster, localDecoded]);

  const rasterConversionBusy = isRasterInput && fetcher.state !== "idle";

  function applyAdvancedRasterSettings() {
    if (!isRasterInput) {
      showToastMessage(
        "Advanced raster settings apply when the input is a Base64 image.",
      );
      return;
    }

    setManualRasterSubmitNonce((value) => value + 1);
  }

  React.useEffect(() => {
    if (!isRasterInput) {
      setLayeredRaster(null);
      lastRasterSubmitKey.current = "";
      return;
    }

    const parsed = parseInput(settings.input);

    if (
      parsed.kind !== "raster-data-url" &&
      parsed.kind !== "plain-base64-raster"
    ) {
      return;
    }

    const key = [
      parsed.content.slice(0, 120),
      parsed.content.slice(-120),
      parsed.content.length,
      settings.backgroundMode,
      settings.backgroundColor,
      settings.rasterMode,
      settings.layerCount,
      settings.maxTraceSide,
      settings.minRegionPercent,
      settings.layerOptTolerance,
      settings.layerTurdSize,
      settings.layerTurnPolicy,
      settings.posterize,
      settings.removeWhite,
      settings.removeTransparent,
      settings.threshold,
      settings.turdSize,
      settings.optTolerance,
      settings.turnPolicy,
      settings.lineColor,
      settings.invert,
      settings.preprocess,
      settings.blurSigma,
      settings.edgeBoost,
    ].join(":");

    if (lastRasterSubmitKey.current === key) return;

    lastRasterSubmitKey.current = key;
    setLayeredRaster(null);

    const formData = new FormData();
    formData.append("rasterDataUrl", parsed.content);
    formData.append("transparent", String(settings.backgroundMode !== "solid"));
    formData.append("bgColor", settings.backgroundColor);
    formData.append("rasterMode", settings.rasterMode);
    formData.append("layerCount", String(settings.layerCount));
    formData.append("maxTraceSide", String(settings.maxTraceSide));
    formData.append("minRegionPercent", String(settings.minRegionPercent));
    formData.append("layerOptTolerance", String(settings.layerOptTolerance));
    formData.append("layerTurdSize", String(settings.layerTurdSize));
    formData.append("layerTurnPolicy", settings.layerTurnPolicy);
    formData.append("posterize", String(settings.posterize));
    formData.append("removeWhite", String(settings.removeWhite));
    formData.append("removeTransparent", String(settings.removeTransparent));
    formData.append("threshold", String(settings.threshold));
    formData.append("turdSize", String(settings.turdSize));
    formData.append("optTolerance", String(settings.optTolerance));
    formData.append("turnPolicy", settings.turnPolicy);
    formData.append("lineColor", settings.lineColor);
    formData.append("invert", String(settings.invert));
    formData.append("preprocess", settings.preprocess);
    formData.append("blurSigma", String(settings.blurSigma));
    formData.append("edgeBoost", String(settings.edgeBoost));

    fetcher.submit(formData, {
      method: "POST",
      encType: "multipart/form-data",
      action:
        typeof window === "undefined"
          ? "?index"
          : `${window.location.pathname}?index`,
    });
  }, [
    activePreset,
    fetcher,
    isRasterInput,
    manualRasterSubmitNonce,
    settings.input,
    settings.backgroundMode,
    settings.backgroundColor,
    settings.rasterMode,
    settings.layerCount,
    settings.maxTraceSide,
    settings.minRegionPercent,
    settings.layerOptTolerance,
    settings.layerTurdSize,
    settings.layerTurnPolicy,
    settings.posterize,
    settings.removeWhite,
    settings.removeTransparent,
    settings.threshold,
    settings.turdSize,
    settings.optTolerance,
    settings.turnPolicy,
    settings.lineColor,
    settings.invert,
    settings.preprocess,
    settings.blurSigma,
    settings.edgeBoost,
  ]);

  React.useEffect(() => {
    if (!isRasterInput || !fetcher.data?.svg) return;

    const svg = fetcher.data.svg;
    const width = fetcher.data.width ?? 0;
    const height = fetcher.data.height ?? 0;
    const pathCount = countPathTags(svg);

    setLayeredRaster({
      kind: localDecoded.kind,
      svg,
      displaySvg: svgToDataUrl(svg),
      error: null,
      warning: null,
      width,
      height,
      viewBox: width && height ? `0 0 ${width} ${height}` : "",
      byteSize: svg.length,
      elementCount: countElementsInSvgString(svg),
      pathCount,
      hasRasterImage: false,
      hasScript: false,
      hasText: false,
      note: `${fetcher.data.layers?.length ? "Layered" : "Single-color"} SVG generated from Base64 image with ${pathCount} traced path${
        pathCount === 1 ? "" : "s"
      }.`,
      layers: (fetcher.data.layers || []).map((layer) => ({
        id: layer.id,
        name: layer.name,
        color: layer.color,
        originalColor: layer.color,
        visible: true,
        pixelPercent: layer.pixelPercent,
        pathTags: layer.pathTags,
      })),
    });
  }, [
    fetcher.data?.height,
    fetcher.data?.layers,
    fetcher.data?.svg,
    fetcher.data?.width,
    isRasterInput,
    localDecoded.kind,
  ]);

  React.useEffect(() => {
    if (!isRasterInput || !fetcher.data?.svg) return;

    const svg = fetcher.data.svg;
    const width = fetcher.data.width ?? 0;
    const height = fetcher.data.height ?? 0;
    const layers = cloneLayers(
      (fetcher.data.layers || []).map((layer) => ({
        id: layer.id,
        name: layer.name,
        color: layer.color,
        originalColor: layer.color,
        visible: true,
        pixelPercent: layer.pixelPercent,
        pathTags: layer.pathTags,
      })),
    );
    const signature = [localDecoded.kind, width, height, svg].join("::");

    if (lastHistorySignature.current === signature) return;

    lastHistorySignature.current = signature;
    setHistory((prev) =>
      [
        {
          stamp: Date.now(),
          svg,
          displaySvg: svgToDataUrl(svg),
          width,
          height,
          kind: localDecoded.kind,
          layers,
          transparent: settings.backgroundMode !== "solid",
          bgColor: settings.backgroundColor,
        },
        ...prev,
      ].slice(0, 10),
    );
  }, [
    fetcher.data?.height,
    fetcher.data?.layers,
    fetcher.data?.svg,
    fetcher.data?.width,
    isRasterInput,
    localDecoded.kind,
    settings.backgroundColor,
    settings.backgroundMode,
  ]);

  React.useEffect(() => {
    if (isRasterInput || !decoded.svg || decoded.error) return;

    if (suppressNextHistoryInsert.current) {
      suppressNextHistoryInsert.current = false;
      return;
    }

    const signature = [
      activePreset,
      decoded.kind,
      decoded.width,
      decoded.height,
      decoded.svg,
    ].join("::");

    if (lastHistorySignature.current === signature) return;

    lastHistorySignature.current = signature;
    setHistory((prev) =>
      [
        {
          stamp: Date.now(),
          svg: decoded.svg,
          displaySvg: decoded.displaySvg || svgToDataUrl(decoded.svg),
          width: decoded.width,
          height: decoded.height,
          kind: decoded.kind,
          layers: cloneLayers(decoded.layers),
          transparent: settings.backgroundMode !== "solid",
          bgColor: settings.backgroundColor,
        },
        ...prev,
      ].slice(0, 10),
    );
  }, [
    decoded.displaySvg,
    decoded.error,
    decoded.height,
    decoded.kind,
    decoded.layers,
    decoded.svg,
    decoded.width,
    isRasterInput,
    activePreset,
    settings.backgroundColor,
    settings.backgroundMode,
  ]);

  const scaledLabel = React.useMemo(() => {
    if (!decoded.width || !decoded.height) return "Unknown";

    if (settings.unit === "px") {
      const ratio = settings.targetWidth / decoded.width;
      return `${Math.round(settings.targetWidth)} px × ${Math.round(
        decoded.height * ratio,
      )} px`;
    }

    const ratio = settings.targetWidth / decoded.width;
    const height = decoded.height * ratio;

    return `${settings.targetWidth.toFixed(2)} ${settings.unit} × ${height.toFixed(
      2,
    )} ${settings.unit}`;
  }, [decoded.height, decoded.width, settings.targetWidth, settings.unit]);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyPreset(preset: Preset) {
    setActivePreset(preset.id);
    setLayeredRaster(null);
    lastRasterSubmitKey.current = "";
    lastHistorySignature.current = "";

    setSettings((current) => {
      const parsed = parseInput(current.input);
      const isVectorInput =
        parsed.kind === "svg" ||
        parsed.kind === "svg-data-url" ||
        parsed.kind === "plain-base64-svg";
      const nextSettings: Partial<Settings> = { ...preset.settings };

      if (isVectorInput && preset.settings.rasterMode === "single") {
        nextSettings.colorMode = "force-fill";
        nextSettings.forceColor =
          preset.settings.lineColor || current.forceColor;
      }

      if (isVectorInput && preset.settings.rasterMode === "layered") {
        nextSettings.colorMode = "preserve";
      }

      return {
        ...current,
        ...nextSettings,
      };
    });
  }

  function showToastMessage(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1500);
  }

  function loadSample() {
    setSettings((current) => ({
      ...current,
      input: SAMPLE_BASE64_SVG,
    }));
  }

  function clearInput() {
    setSettings((current) => ({
      ...current,
      input: "",
    }));
    setLayeredRaster(null);
    setHistory([]);
    lastRasterSubmitKey.current = "";
    lastHistorySignature.current = "";
  }

  function copySvgContent(svg: string, successMessage = "SVG copied") {
    navigator.clipboard.writeText(svg).then(
      () => showToastMessage(successMessage),
      () => showToastMessage("Copy failed. Use download instead."),
    );
  }

  function copySvg() {
    if (!decoded.svg || decoded.error) {
      showToastMessage("No valid SVG to copy");
      return;
    }

    copySvgContent(decoded.svg);
  }

  function copyDecodedText() {
    if (!decoded.svg || decoded.error) {
      showToastMessage("No decoded SVG to copy");
      return;
    }

    copySvgContent(decoded.svg, "Decoded SVG copied");
  }

  function downloadSvgContent(svg: string) {
    const blob = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "base64-converted.svg";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function downloadSvg() {
    if (!decoded.svg || decoded.error) {
      showToastMessage("No valid SVG to download");
      return;
    }

    downloadSvgContent(decoded.svg);
  }

  function downloadCsv() {
    const rows = [
      ["Field", "Value"],
      ["Detected input type", decoded.kind],
      ["Valid SVG", decoded.error ? "No" : "Yes"],
      ["Warning", decoded.warning || ""],
      ["Width", decoded.width],
      ["Height", decoded.height],
      ["ViewBox", decoded.viewBox],
      ["Output bytes", decoded.byteSize],
      ["Elements", decoded.elementCount],
      ["Paths", decoded.pathCount],
      ["Contains raster image", decoded.hasRasterImage ? "Yes" : "No"],
      ["Contains script", decoded.hasScript ? "Yes" : "No"],
      ["Contains text elements", decoded.hasText ? "Yes" : "No"],
      ["Color mode", settings.colorMode],
      ["Force color", settings.forceColor],
      ["Background mode", settings.backgroundMode],
      ["Background color", settings.backgroundColor],
      ["Remove scripts", settings.removeScripts ? "Yes" : "No"],
      ["Remove metadata", settings.removeMetadata ? "Yes" : "No"],
      ["Remove raster images", settings.removeRasterImages ? "Yes" : "No"],
      ["Remove comments", settings.removeComments ? "Yes" : "No"],
      ["Normalize viewBox", settings.normalizeViewBox ? "Yes" : "No"],
      ["Responsive SVG", settings.responsiveSvg ? "Yes" : "No"],
      ["Minify output", settings.minifyOutput ? "Yes" : "No"],
      ["Scaled output", scaledLabel],
      ["Note", decoded.note],
    ];

    const csv = rows
      .map((row) => row.map((cell) => csvEscape(String(cell))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "base64-to-svg-report.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function printResult() {
    window.print();
  }

  function updateDecodedLayer(layerId: string, patch: Partial<LayerState>) {
    const base = layeredRaster ?? decoded;
    if (!base?.layers?.length) return;

    const layers = base.layers.map((layer) =>
      layer.id === layerId ? { ...layer, ...patch } : layer,
    );
    const svg = applyLayerEditsToSvg(base.svg, layers, {
      width: base.width,
      height: base.height,
      transparent: settings.backgroundMode !== "solid",
      bgColor: settings.backgroundColor,
    });
    const displaySvg = svgToDataUrl(svg);
    const nextDecoded: DecodedResult = {
      ...base,
      svg,
      displaySvg,
      byteSize: svg.length,
      elementCount: countElementsInSvgString(svg),
      pathCount: countPathTags(svg),
      layers,
    };

    suppressNextHistoryInsert.current = true;
    setLayeredRaster(nextDecoded);
    setHistory((items) => {
      if (items.length === 0) {
        return [
          {
            stamp: Date.now(),
            svg,
            displaySvg,
            width: base.width,
            height: base.height,
            kind: base.kind,
            layers: cloneLayers(layers),
            transparent: settings.backgroundMode !== "solid",
            bgColor: settings.backgroundColor,
          },
        ];
      }

      return items.map((item, index) =>
        index === 0
          ? {
              ...item,
              svg,
              displaySvg,
              layers: cloneLayers(layers),
              transparent: settings.backgroundMode !== "solid",
              bgColor: settings.backgroundColor,
            }
          : item,
      );
    });
  }

  function resetDecodedLayers() {
    const base = layeredRaster ?? decoded;
    if (!base?.layers?.length) return;

    const layers = base.layers.map((layer) => ({
      ...layer,
      color: layer.originalColor,
      visible: true,
    }));
    const svg = applyLayerEditsToSvg(base.svg, layers, {
      width: base.width,
      height: base.height,
      transparent: settings.backgroundMode !== "solid",
      bgColor: settings.backgroundColor,
    });
    const displaySvg = svgToDataUrl(svg);
    const nextDecoded: DecodedResult = {
      ...base,
      svg,
      displaySvg,
      byteSize: svg.length,
      elementCount: countElementsInSvgString(svg),
      pathCount: countPathTags(svg),
      layers,
    };

    suppressNextHistoryInsert.current = true;
    setLayeredRaster(nextDecoded);
    setHistory((items) =>
      items.map((item, index) =>
        index === 0
          ? {
              ...item,
              svg,
              displaySvg,
              layers: cloneLayers(layers),
              transparent: settings.backgroundMode !== "solid",
              bgColor: settings.backgroundColor,
            }
          : item,
      ),
    );
  }

  function updateHistoryLayer(
    stamp: number,
    layerId: string,
    patch: Partial<LayerState>,
  ) {
    setHistory((current) =>
      current.map((item) => {
        if (item.stamp !== stamp || !item.layers?.length) return item;

        const layers = item.layers.map((layer) =>
          layer.id === layerId ? { ...layer, ...patch } : layer,
        );
        const svg = applyLayerEditsToSvg(item.svg, layers, {
          width: item.width,
          height: item.height,
          transparent: item.transparent,
          bgColor: item.bgColor,
        });

        return {
          ...item,
          svg,
          displaySvg: svgToDataUrl(svg),
          layers,
        };
      }),
    );
  }

  function resetHistoryLayers(stamp: number) {
    setHistory((current) =>
      current.map((item) => {
        if (item.stamp !== stamp || !item.layers?.length) return item;

        const layers = item.layers.map((layer) => ({
          ...layer,
          color: layer.originalColor,
          visible: true,
        }));
        const svg = applyLayerEditsToSvg(item.svg, layers, {
          width: item.width,
          height: item.height,
          transparent: item.transparent,
          bgColor: item.bgColor,
        });

        return {
          ...item,
          svg,
          displaySvg: svgToDataUrl(svg),
          layers,
        };
      }),
    );
  }

  return (
    <>
      <main className="bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-[1180px] px-4">
          <div className="hidden py-6 lg:block">
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

          <section className="grid grid-cols-1 items-start gap-4 sm:pt-6 md:grid-cols-2 lg:pb-8 lg:pt-0">
            <div className="min-w-0 overflow-hidden rounded-xl bg-white p-4 sm:border sm:border-slate-200 sm:shadow-sm">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-sky-700">
                Base64 SVG decoder
              </p>

              <h1 className="m-0 mb-3 inline-flex w-full items-center justify-center gap-2 text-center text-xl font-extrabold leading-none text-sky-950 sm:text-3xl">
                Base64 to SVG converter
              </h1>

              <p className="mb-4 text-center text-sm leading-6 text-slate-600">
                Paste a Base64 SVG string, SVG data URL, encoded SVG snippet, or
                Base64 raster image and turn it into a clean downloadable SVG
                file.
              </p>

              <PresetPicker
                presets={DISPLAY_PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />

              {activePresetObject?.help && (
                <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-[13px] leading-5 text-slate-700">
                  <b className="text-sky-900">{activePresetObject.label}:</b>{" "}
                  {activePresetObject.help}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-semibold text-slate-800">
                    Base64 SVG or image input
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={loadSample}
                      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                    >
                      Load sample
                    </button>
                    <button
                      type="button"
                      onClick={clearInput}
                      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <textarea
                  value={settings.input}
                  onChange={(event) => update("input", event.target.value)}
                  rows={9}
                  spellCheck={false}
                  placeholder="Paste data:image/svg+xml;base64,..., plain Base64 SVG, or data:image/png;base64,... here"
                  className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 outline-none transition focus:border-sky-400"
                />

                <div className="mt-3">
                  <Field label="Detected">
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                      {readableKind(decoded.kind)}
                    </span>
                  </Field>
                </div>
              </div>

              <div className="mt-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((value) => !value)}
                  className="mb-2 inline-flex w-full cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
                  aria-expanded={showAdvanced}
                  aria-controls="advanced-settings"
                >
                  <span className="inline-flex items-center gap-2">
                    Additional decode and SVG settings
                  </span>
                  <ChevronDownIcon open={showAdvanced} />
                </button>

                {showAdvanced && (
                  <div
                    id="advanced-settings"
                    className="flex min-w-0 flex-col gap-2"
                  >
                    <Field label="Color handling">
                      <select
                        value={settings.colorMode}
                        onChange={(event) =>
                          update("colorMode", event.target.value as ColorMode)
                        }
                        className="w-full cursor-pointer rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 transition-colors hover:bg-slate-50"
                      >
                        <option value="preserve">
                          Preserve original colors
                        </option>
                        <option value="force-fill">
                          Force single fill color
                        </option>
                        <option value="force-stroke">
                          Force outline stroke color
                        </option>
                      </select>
                    </Field>

                    {settings.colorMode !== "preserve" && (
                      <Field label="Force color">
                        <input
                          type="color"
                          value={settings.forceColor}
                          onChange={(event) =>
                            update("forceColor", event.target.value)
                          }
                          className="h-7 w-14 cursor-pointer rounded-md border border-[#dbe3ef] bg-white"
                        />
                      </Field>
                    )}

                    <Field label="Background">
                      <select
                        value={settings.backgroundMode}
                        onChange={(event) =>
                          update(
                            "backgroundMode",
                            event.target.value as BackgroundMode,
                          )
                        }
                        className="w-full cursor-pointer rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 transition-colors hover:bg-slate-50"
                      >
                        <option value="transparent">Transparent</option>
                        <option value="solid">Add solid background</option>
                      </select>
                    </Field>

                    {settings.backgroundMode === "solid" && (
                      <Field label="Background color">
                        <input
                          type="color"
                          value={settings.backgroundColor}
                          onChange={(event) =>
                            update("backgroundColor", event.target.value)
                          }
                          className="h-7 w-14 cursor-pointer rounded-md border border-[#dbe3ef] bg-white"
                        />
                      </Field>
                    )}

                    <Field label="Raster trace mode">
                      <select
                        value={settings.rasterMode}
                        onChange={(event) =>
                          update(
                            "rasterMode",
                            event.target.value as RasterTraceMode,
                          )
                        }
                        className="w-full cursor-pointer rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 transition-colors hover:bg-slate-50"
                      >
                        <option value="layered">Layered color SVG</option>
                        <option value="single">Single-color line SVG</option>
                      </select>
                    </Field>

                    {settings.rasterMode === "layered" ? (
                      <>
                        <Field label={`Layer count (${settings.layerCount})`}>
                          <input
                            type="range"
                            min={MIN_LAYER_COUNT}
                            max={MAX_LAYER_COUNT}
                            step={1}
                            value={settings.layerCount}
                            onChange={(event) =>
                              update("layerCount", Number(event.target.value))
                            }
                            className="w-full accent-[#0b2dff]"
                          />
                        </Field>
                        <Field label="Trace detail size">
                          <select
                            value={settings.maxTraceSide}
                            onChange={(event) =>
                              update("maxTraceSide", Number(event.target.value))
                            }
                            className="w-full cursor-pointer rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 transition-colors hover:bg-slate-50"
                          >
                            <option value={900}>Fast preview</option>
                            <option value={1200}>Balanced</option>
                            <option value={1600}>Detailed</option>
                            <option value={2000}>High detail</option>
                            <option value={2400}>Maximum detail</option>
                          </select>
                        </Field>
                        <Field
                          label={`Minimum layer size (${settings.minRegionPercent}%)`}
                        >
                          <Num
                            value={settings.minRegionPercent}
                            min={0}
                            max={5}
                            step={0.05}
                            onChange={(value) =>
                              update("minRegionPercent", value)
                            }
                          />
                        </Field>
                        <Field label="Posterize colors">
                          <input
                            type="checkbox"
                            checked={settings.posterize}
                            onChange={(event) =>
                              update("posterize", event.target.checked)
                            }
                            className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
                          />
                        </Field>
                        <Field label="Remove white background">
                          <input
                            type="checkbox"
                            checked={settings.removeWhite}
                            onChange={(event) =>
                              update("removeWhite", event.target.checked)
                            }
                            className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
                          />
                        </Field>
                        <Field label="Layer speckle removal">
                          <Num
                            value={settings.layerTurdSize}
                            min={0}
                            max={20}
                            step={1}
                            onChange={(value) => update("layerTurdSize", value)}
                          />
                        </Field>
                        <Field label="Layer curve tolerance">
                          <Num
                            value={settings.layerOptTolerance}
                            min={0.05}
                            max={1.2}
                            step={0.05}
                            onChange={(value) =>
                              update("layerOptTolerance", value)
                            }
                          />
                        </Field>
                        <Field label="Layer turn policy">
                          <select
                            value={settings.layerTurnPolicy}
                            onChange={(event) =>
                              update(
                                "layerTurnPolicy",
                                event.target.value as TraceTurnPolicy,
                              )
                            }
                            className="w-full cursor-pointer rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 transition-colors hover:bg-slate-50"
                          >
                            <option value="black">black</option>
                            <option value="white">white</option>
                            <option value="left">left</option>
                            <option value="right">right</option>
                            <option value="minority">minority</option>
                            <option value="majority">majority</option>
                          </select>
                        </Field>
                      </>
                    ) : (
                      <>
                        <Field label="Preprocess">
                          <select
                            value={settings.preprocess}
                            onChange={(event) =>
                              update(
                                "preprocess",
                                event.target.value as RasterPreprocessMode,
                              )
                            }
                            className="w-full cursor-pointer rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 transition-colors hover:bg-slate-50"
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
                                onChange={(value) => update("blurSigma", value)}
                              />
                            </Field>
                            <Field label={`Edge boost (${settings.edgeBoost})`}>
                              <Num
                                value={settings.edgeBoost}
                                min={0.5}
                                max={2}
                                step={0.1}
                                onChange={(value) => update("edgeBoost", value)}
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
                            onChange={(event) =>
                              update("threshold", Number(event.target.value))
                            }
                            className="w-full accent-[#0b2dff]"
                          />
                        </Field>
                        <Field label="Line color">
                          <input
                            type="color"
                            value={settings.lineColor}
                            onChange={(event) =>
                              update("lineColor", event.target.value)
                            }
                            className="h-7 w-14 cursor-pointer rounded-md border border-[#dbe3ef] bg-white"
                          />
                        </Field>
                        <Field label="Invert lineart">
                          <input
                            type="checkbox"
                            checked={settings.invert}
                            onChange={(event) => {
                              const enabled = event.target.checked;
                              if (!enabled) {
                                update("invert", false);
                                return;
                              }
                              setSettings((current) => ({
                                ...current,
                                invert: true,
                                backgroundMode: "solid",
                                backgroundColor:
                                  !current.backgroundColor ||
                                  current.backgroundColor.toLowerCase() ===
                                    "#ffffff" ||
                                  current.backgroundColor.toLowerCase() ===
                                    "#fff"
                                    ? DARK_BG_DEFAULT
                                    : current.backgroundColor,
                                lineColor:
                                  current.lineColor.toLowerCase() === "#000000"
                                    ? "#ffffff"
                                    : current.lineColor,
                              }));
                            }}
                            className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
                          />
                        </Field>
                        <Field label="Trace speckle removal">
                          <Num
                            value={settings.turdSize}
                            min={0}
                            max={20}
                            step={1}
                            onChange={(value) => update("turdSize", value)}
                          />
                        </Field>
                        <Field label="Trace curve tolerance">
                          <Num
                            value={settings.optTolerance}
                            min={0.05}
                            max={1.2}
                            step={0.05}
                            onChange={(value) => update("optTolerance", value)}
                          />
                        </Field>
                        <Field label="Trace turn policy">
                          <select
                            value={settings.turnPolicy}
                            onChange={(event) =>
                              update(
                                "turnPolicy",
                                event.target.value as TraceTurnPolicy,
                              )
                            }
                            className="w-full cursor-pointer rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 transition-colors hover:bg-slate-50"
                          >
                            <option value="black">black</option>
                            <option value="white">white</option>
                            <option value="left">left</option>
                            <option value="right">right</option>
                            <option value="minority">minority</option>
                            <option value="majority">majority</option>
                          </select>
                        </Field>
                      </>
                    )}

                    <Field label="Remove scripts">
                      <input
                        type="checkbox"
                        checked={settings.removeScripts}
                        onChange={(event) =>
                          update("removeScripts", event.target.checked)
                        }
                        className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Remove metadata">
                      <input
                        type="checkbox"
                        checked={settings.removeMetadata}
                        onChange={(event) =>
                          update("removeMetadata", event.target.checked)
                        }
                        className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Remove raster images">
                      <input
                        type="checkbox"
                        checked={settings.removeRasterImages}
                        onChange={(event) =>
                          update("removeRasterImages", event.target.checked)
                        }
                        className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Remove comments">
                      <input
                        type="checkbox"
                        checked={settings.removeComments}
                        onChange={(event) =>
                          update("removeComments", event.target.checked)
                        }
                        className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Normalize viewBox">
                      <input
                        type="checkbox"
                        checked={settings.normalizeViewBox}
                        onChange={(event) =>
                          update("normalizeViewBox", event.target.checked)
                        }
                        className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Responsive SVG">
                      <input
                        type="checkbox"
                        checked={settings.responsiveSvg}
                        onChange={(event) =>
                          update("responsiveSvg", event.target.checked)
                        }
                        className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Minify output">
                      <input
                        type="checkbox"
                        checked={settings.minifyOutput}
                        onChange={(event) =>
                          update("minifyOutput", event.target.checked)
                        }
                        className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Add SVG note">
                      <input
                        type="checkbox"
                        checked={settings.addSvgNote}
                        onChange={(event) =>
                          update("addSvgNote", event.target.checked)
                        }
                        className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Target unit">
                      <select
                        value={settings.unit}
                        onChange={(event) =>
                          update("unit", event.target.value as SizeUnit)
                        }
                        className="w-full cursor-pointer rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 transition-colors hover:bg-slate-50"
                      >
                        <option value="px">px</option>
                        <option value="in">in</option>
                        <option value="cm">cm</option>
                      </select>
                    </Field>

                    <Field label={`Target width (${settings.targetWidth})`}>
                      <Num
                        value={settings.targetWidth}
                        min={settings.unit === "px" ? 100 : 1}
                        max={settings.unit === "px" ? 3000 : 40}
                        step={settings.unit === "px" ? 10 : 0.1}
                        onChange={(value) => update("targetWidth", value)}
                      />
                    </Field>

                    {isRasterInput && (
                      <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-[13px] leading-5 text-slate-700">
                        Advanced raster trace changes do not live preview. Use
                        <button
                          type="button"
                          onClick={applyAdvancedRasterSettings}
                          disabled={rasterConversionBusy}
                          className="mx-1 cursor-pointer rounded-md border border-sky-200 bg-white px-2 py-1 text-xs font-semibold text-sky-900 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Update preview
                        </button>
                        after changing these settings.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={downloadSvg}
                  disabled={!decoded.svg || Boolean(decoded.error)}
                  className={[
                    "flex w-full cursor-pointer items-center justify-center rounded-lg border px-3.5 py-2 font-bold transition-colors",
                    "border-[#0a24da] bg-[#0b2dff] text-white hover:border-[#091ec0] hover:bg-[#0a24da]",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  ].join(" ")}
                >
                  <Icons
                    name="download"
                    size={18}
                    className="mr-1"
                    title="Download"
                  />
                  Download SVG
                </button>

                <button
                  type="button"
                  onClick={copySvg}
                  disabled={!decoded.svg || Boolean(decoded.error)}
                  className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icons name="copy" size={16} className="mr-1 inline-block" />
                  Copy SVG
                </button>

                <button
                  type="button"
                  onClick={copyDecodedText}
                  disabled={!decoded.svg || Boolean(decoded.error)}
                  className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Copy decoded text
                </button>

                <button
                  type="button"
                  onClick={downloadCsv}
                  className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 transition hover:bg-slate-100"
                >
                  Export report CSV
                </button>

                <button
                  type="button"
                  onClick={printResult}
                  className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 transition hover:bg-slate-100"
                >
                  Print to PDF
                </button>
              </div>

              <StatusPanel decoded={decoded} scaledLabel={scaledLabel} />

              <button
                type="button"
                onClick={() => setShowTips((value) => !value)}
                className="mt-3 inline-flex w-full cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                aria-expanded={showTips}
                aria-controls="base64-svg-tips"
              >
                Tips for Base64 SVGs
                <ChevronDownIcon open={showTips} />
              </button>

              {showTips && (
                <div
                  id="base64-svg-tips"
                  className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700"
                >
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      Paste Base64 SVG for direct decoding, or Base64
                      PNG/JPG/WEBP when you want the image traced into SVG
                      paths.
                    </li>
                    <li>
                      Use layered color mode when you want editable color groups
                      for layered SVG designs.
                    </li>
                    <li>
                      Use single-color trace presets when you want simple
                      one-color SVG paths.
                    </li>
                    <li>
                      Use the layer controls to recolor or hide traced SVG
                      groups.
                    </li>
                    <li>
                      Remove embedded raster images only when cleaning an SVG
                      that already contains image tags.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="h-full max-h-[124.25em] min-w-0 overflow-auto rounded-xl border border-slate-200 bg-slate-600 p-4 shadow-sm">
              {decoded.svg && !decoded.error ? (
                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="block text-[13px] font-semibold text-slate-800">
                          Latest SVG preview
                        </span>
                        <span className="text-[13px] text-slate-700">
                          {decoded.width > 0 && decoded.height > 0
                            ? `${decoded.width} × ${decoded.height} px`
                            : "size unknown"}
                        </span>
                      </div>

                      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                        {readableKind(decoded.kind)}
                      </span>
                    </div>

                    <div className="my-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={downloadSvg}
                        className="flex cursor-pointer items-center justify-center rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 font-semibold text-white transition hover:bg-sky-600"
                      >
                        <Icons
                          name="download"
                          size={16}
                          className="mr-1 inline-block"
                        />
                        Download SVG
                      </button>

                      <button
                        type="button"
                        onClick={copySvg}
                        className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 transition hover:bg-slate-100"
                      >
                        <Icons
                          name="copy"
                          size={16}
                          className="mr-1 inline-block"
                        />
                        Copy SVG
                      </button>
                    </div>

                    {decoded.layers?.length ? (
                      <LayerControls
                        layers={decoded.layers}
                        onLayerChange={(layerId, patch) =>
                          updateDecodedLayer(layerId, patch)
                        }
                        onReset={resetDecodedLayers}
                      />
                    ) : null}

                    <div className="flex min-h-[380px] items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
                      <img
                        src={decoded.displaySvg}
                        alt="Decoded SVG preview"
                        className="h-auto max-h-[720px] max-w-full"
                      />
                    </div>
                  </div>

                  {history.length > 1 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-slate-800">
                          Recent preview history
                        </span>
                        <span className="text-[12px] text-slate-600">
                          Showing {history.length - 1} earlier successful
                          conversion{history.length - 1 === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="grid gap-3">
                        {history.slice(1).map((item) => (
                          <div
                            key={item.stamp}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[13px] text-slate-700">
                                {item.width > 0 && item.height > 0
                                  ? `${item.width} × ${item.height} px`
                                  : "size unknown"}
                              </span>
                              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-sky-800">
                                {readableKind(item.kind)}
                              </span>
                            </div>

                            <div className="my-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => downloadSvgContent(item.svg)}
                                className="flex cursor-pointer items-center justify-center rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 font-semibold text-white transition hover:bg-sky-600"
                              >
                                <Icons
                                  name="download"
                                  size={16}
                                  className="mr-1 inline-block"
                                />
                                Download SVG
                              </button>

                              <button
                                type="button"
                                onClick={() => copySvgContent(item.svg)}
                                className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-900 transition hover:bg-slate-100"
                              >
                                <Icons
                                  name="copy"
                                  size={16}
                                  className="mr-1 inline-block"
                                />
                                Copy SVG
                              </button>
                            </div>

                            {item.layers?.length ? (
                              <LayerControls
                                layers={item.layers}
                                onLayerChange={(layerId, patch) =>
                                  updateHistoryLayer(item.stamp, layerId, patch)
                                }
                                onReset={() => resetHistoryLayers(item.stamp)}
                              />
                            ) : null}

                            <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
                              <img
                                src={item.displaySvg}
                                alt="Earlier SVG preview"
                                className="h-auto max-h-[420px] max-w-full"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="m-0 flex items-center justify-center font-semibold text-white">
                  <Icons
                    name="success"
                    size={20}
                    className="mr-1 inline-block"
                  />
                  {rasterConversionBusy
                    ? "Building layered SVG paths…"
                    : "Decoded SVG preview appears here."}
                </p>
              )}

              {rasterConversionBusy && !decoded.error && (
                <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
                  Converting the Base64 image into layered SVG paths.
                </div>
              )}

              {decoded.error && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
                  {decoded.error}
                </div>
              )}

              {decoded.warning && !decoded.error && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  {decoded.warning}
                </div>
              )}
            </div>
          </section>
        </div>

        {toast && (
          <div className="fixed bottom-4 right-4 z-[1000] rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}
      </main>

      <div className="block py-6 lg:hidden">
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

/* ========================
   Decode and SVG cleanup
======================== */
function decodeAndCleanSvg(settings: Settings): DecodedResult {
  const empty: DecodedResult = {
    kind: "empty",
    svg: "",
    displaySvg: "",
    error: null,
    warning: null,
    width: 0,
    height: 0,
    viewBox: "",
    byteSize: 0,
    elementCount: 0,
    pathCount: 0,
    hasRasterImage: false,
    hasScript: false,
    hasText: false,
    note: "Paste a Base64 SVG or SVG data URL to begin.",
  };

  const rawInput = settings.input.trim();

  if (!rawInput) return empty;

  if (typeof window === "undefined") return empty;

  const parsed = parseInput(rawInput);

  if (parsed.kind === "invalid") {
    return {
      ...empty,
      kind: "invalid",
      error:
        "This does not look like valid SVG, an SVG data URL, or Base64-encoded SVG.",
      note: "Paste data:image/svg+xml;base64,... or plain Base64 SVG.",
    };
  }

  if (
    parsed.kind === "raster-data-url" ||
    parsed.kind === "plain-base64-raster"
  ) {
    return {
      kind: parsed.kind,
      svg: "",
      displaySvg: "",
      error: null,
      warning: null,
      width: 0,
      height: 0,
      viewBox: "",
      byteSize: 0,
      elementCount: 0,
      pathCount: 0,
      hasRasterImage: false,
      hasScript: false,
      hasText: false,
      note: "Base64 raster image detected. Converting it into layered SVG paths.",
    };
  }

  const svgText = parsed.content.trim();

  if (!/^<svg[\s>]/i.test(svgText)) {
    return {
      ...empty,
      kind: parsed.kind,
      error:
        "The decoded content is not an SVG document. It must begin with an <svg> element.",
      note: "Decoded content is not SVG.",
    };
  }

  try {
    const cleaned = cleanSvg(svgText, settings);
    const editable = annotateSvgForLayerEditing(cleaned.svg);
    const displaySvg = svgToDataUrl(editable.svg);

    return {
      kind: parsed.kind,
      svg: editable.svg,
      displaySvg,
      error: null,
      warning: cleaned.warning,
      width: cleaned.width,
      height: cleaned.height,
      viewBox: cleaned.viewBox,
      byteSize: cleaned.svg.length,
      elementCount: cleaned.elementCount,
      pathCount: cleaned.pathCount,
      hasRasterImage: cleaned.hasRasterImage,
      hasScript: cleaned.hasScript,
      hasText: cleaned.hasText,
      note: getSvgNote(cleaned),
      layers: editable.layers,
    };
  } catch (error: any) {
    return {
      ...empty,
      kind: parsed.kind,
      error: error?.message || "Could not parse or clean this SVG.",
      note: "SVG cleanup failed.",
    };
  }
}

function annotateSvgForLayerEditing(svg: string): {
  svg: string;
  layers?: LayerState[];
} {
  if (typeof window === "undefined") return { svg };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const root = doc.documentElement;

    if (!root || root.tagName.toLowerCase() !== "svg") return { svg };

    const editableSelector =
      "path, rect, circle, ellipse, polygon, polyline, line";
    const editableElements = Array.from(
      doc.querySelectorAll<SVGElement>(editableSelector),
    ).filter((node) => {
      const tag = node.tagName.toLowerCase();

      if (
        tag === "rect" &&
        node.parentElement?.tagName.toLowerCase() === "svg"
      ) {
        const width = node.getAttribute("width") || "";
        const height = node.getAttribute("height") || "";
        const fill = normalizeEditableSvgColor(node.getAttribute("fill") || "");

        if ((width === "100%" || height === "100%") && fill) return false;
      }

      return true;
    });

    if (!editableElements.length) return { svg };

    const color = detectFirstEditableSvgColor(svg) || "#000000";
    const layerId = "svg-path-color";

    for (const node of editableElements) {
      node.setAttribute("data-fill-layer-id", layerId);
    }

    const annotatedSvg = new XMLSerializer()
      .serializeToString(doc)
      .replace(/<\?xml[^>]*>/gi, "")
      .trim();

    return {
      svg: annotatedSvg,
      layers: [
        {
          id: layerId,
          name: "SVG color",
          color,
          originalColor: color,
          visible: true,
          pixelPercent: 100,
        },
      ],
    };
  } catch {
    return { svg };
  }
}

function buildEditableSvgLayers(svg: string): LayerState[] | undefined {
  return annotateSvgForLayerEditing(svg).layers;
}

function extractEditableSvgPreviewTags(svg: string): string {
  const matches =
    String(svg).match(
      /<(path|rect|circle|ellipse|polygon|polyline|line)\b[^>]*>/gi,
    ) || [];

  return matches
    .map((tag) => {
      let clean = tag;
      clean = clean.replace(/\sfill\s*=\s*["'][^"']*["']/gi, "");
      clean = clean.replace(/\sstroke\s*=\s*["'][^"']*["']/gi, "");
      clean = clean.replace(/\sstyle\s*=\s*["'][^"']*["']/gi, "");
      clean = clean.replace(/\s\/?>$/i, " />");
      return clean;
    })
    .join("");
}

function detectFirstEditableSvgColor(svg: string): string | null {
  const raw = String(svg || "");
  const candidates = [
    ...Array.from(raw.matchAll(/\bfill\s*=\s*["']([^"']+)["']/gi)).map(
      (match) => match[1],
    ),
    ...Array.from(raw.matchAll(/\bstroke\s*=\s*["']([^"']+)["']/gi)).map(
      (match) => match[1],
    ),
    ...Array.from(raw.matchAll(/(?:^|;)\s*fill\s*:\s*([^;"']+)/gi)).map(
      (match) => match[1],
    ),
    ...Array.from(raw.matchAll(/(?:^|;)\s*stroke\s*:\s*([^;"']+)/gi)).map(
      (match) => match[1],
    ),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeEditableSvgColor(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function normalizeEditableSvgColor(value: string): string | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (
    !raw ||
    raw === "none" ||
    raw === "transparent" ||
    raw === "currentcolor" ||
    raw === "inherit" ||
    raw.startsWith("url(")
  ) {
    return null;
  }

  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }

  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if (/^#[0-9a-f]{8}$/i.test(raw)) return `#${raw.slice(1, 7)}`;

  const rgbMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map((part) => part.trim());
    if (parts.length >= 3) {
      const values = parts.slice(0, 3).map((part) => {
        if (part.endsWith("%")) {
          return clampInt((parseFloat(part) / 100) * 255, 0, 255);
        }
        return clampInt(Number(part), 0, 255);
      });
      return `#${toHex(values[0])}${toHex(values[1])}${toHex(values[2])}`;
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

function parseInput(input: string): {
  kind: InputKind;
  content: string;
} {
  const trimmed = input.trim();

  if (/^<svg[\s>]/i.test(trimmed)) {
    return { kind: "svg", content: trimmed };
  }

  if (/^data:image\/svg\+xml/i.test(trimmed)) {
    const commaIndex = trimmed.indexOf(",");
    if (commaIndex < 0) return { kind: "invalid", content: "" };

    const meta = trimmed.slice(0, commaIndex).toLowerCase();
    const payload = trimmed.slice(commaIndex + 1);

    if (meta.includes(";base64")) {
      return {
        kind: "svg-data-url",
        content: safeBase64Decode(payload),
      };
    }

    return {
      kind: "svg-data-url",
      content: decodeURIComponent(payload),
    };
  }

  if (/^data:image\/(png|jpe?g|webp);base64,/i.test(trimmed)) {
    return {
      kind: "raster-data-url",
      content: trimmed,
    };
  }

  const compact = trimmed.replace(/\s+/g, "");

  if (!looksLikeBase64(compact)) {
    return { kind: "invalid", content: "" };
  }

  const decoded = safeBase64Decode(compact).trim();

  if (/^<svg[\s>]/i.test(decoded)) {
    return {
      kind: "plain-base64-svg",
      content: decoded,
    };
  }

  if (isRasterMagic(decoded, compact)) {
    return {
      kind: "plain-base64-raster",
      content: inferRasterDataUrl(compact),
    };
  }

  return { kind: "invalid", content: decoded };
}

function cleanSvg(svgText: string, settings: Settings) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const parserError = doc.querySelector("parsererror");

  if (parserError) {
    throw new Error("The decoded SVG is malformed and could not be parsed.");
  }

  const svg = doc.documentElement;

  if (!svg || svg.tagName.toLowerCase() !== "svg") {
    throw new Error("The decoded content is not a valid SVG document.");
  }

  const hasScriptBefore = doc.querySelectorAll("script").length > 0;

  if (settings.removeScripts) {
    doc
      .querySelectorAll("script, foreignObject")
      .forEach((node) => node.remove());
    removeEventAttributes(svg);
  }

  if (settings.removeMetadata) {
    doc
      .querySelectorAll("metadata, desc, defs metadata")
      .forEach((node) => node.remove());
  }

  if (settings.removeRasterImages) {
    doc.querySelectorAll("image").forEach((node) => node.remove());
  }

  if (settings.removeComments) {
    removeComments(doc);
  }

  if (settings.colorMode === "force-fill") {
    forceFillColor(doc, settings.forceColor);
  }

  if (settings.colorMode === "force-stroke") {
    forceStrokeColor(doc, settings.forceColor);
  }

  const size = ensureSvgSize(svg, settings);
  const viewBox =
    svg.getAttribute("viewBox") || `0 0 ${size.width} ${size.height}`;

  if (settings.backgroundMode === "solid") {
    const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", String(size.width));
    rect.setAttribute("height", String(size.height));
    rect.setAttribute("fill", settings.backgroundColor);
    svg.insertBefore(rect, svg.firstChild);
  }

  if (settings.addSvgNote) {
    const title = doc.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = "Decoded SVG";
    svg.insertBefore(title, svg.firstChild);
  }

  if (settings.responsiveSvg) {
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }

  let output = new XMLSerializer().serializeToString(doc);

  output = output
    .replace(/<\?xml[^>]*>/gi, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .trim();

  if (settings.minifyOutput) {
    output = minifySvg(output);
  }

  const elementCount = doc.querySelectorAll("*").length;
  const pathCount = doc.querySelectorAll("path").length;
  const hasRasterImage = doc.querySelectorAll("image").length > 0;
  const hasText = doc.querySelectorAll("text, tspan, textPath").length > 0;

  const warning = buildWarning({
    hasScriptBefore,
    hasRasterImage,
    hasText,
    pathCount,
    settings,
  });

  return {
    svg: output,
    width: size.width,
    height: size.height,
    viewBox,
    elementCount,
    pathCount,
    hasRasterImage,
    hasScript: hasScriptBefore && !settings.removeScripts,
    hasText,
    warning,
  };
}

function ensureSvgSize(svg: Element, settings: Settings) {
  const widthAttr = svg.getAttribute("width");
  const heightAttr = svg.getAttribute("height");
  const viewBoxAttr = svg.getAttribute("viewBox");

  let width = parseSvgNumber(widthAttr) || 0;
  let height = parseSvgNumber(heightAttr) || 0;

  if ((!width || !height) && viewBoxAttr) {
    const parts = viewBoxAttr
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((value) => Number.isFinite(value));

    if (parts.length === 4) {
      width = width || parts[2];
      height = height || parts[3];
    }
  }

  if (!width || !height) {
    width = 1024;
    height = 1024;
  }

  if (settings.normalizeViewBox && !viewBoxAttr) {
    svg.setAttribute(
      "viewBox",
      `0 0 ${Math.round(width)} ${Math.round(height)}`,
    );
  }

  if (!svg.getAttribute("xmlns")) {
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

function removeEventAttributes(root: Element) {
  root.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      if (/^on/i.test(attr.name)) {
        node.removeAttribute(attr.name);
      }

      if (
        ["href", "xlink:href"].includes(attr.name) &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        node.removeAttribute(attr.name);
      }
    });
  });
}

function removeComments(doc: Document) {
  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  let current = walker.nextNode();

  while (current) {
    comments.push(current);
    current = walker.nextNode();
  }

  comments.forEach((comment) => comment.parentNode?.removeChild(comment));
}

function forceFillColor(doc: Document, color: string) {
  doc.querySelectorAll("*").forEach((node) => {
    const tag = node.tagName.toLowerCase();

    if (["svg", "defs", "title", "clipPath", "mask", "pattern"].includes(tag)) {
      return;
    }

    if (tag === "rect" && node.parentElement?.tagName.toLowerCase() === "svg") {
      const w = node.getAttribute("width");
      const h = node.getAttribute("height");
      if (w === "100%" || h === "100%") return;
    }

    node.setAttribute("fill", color);
    node.removeAttribute("stroke");
  });
}

function forceStrokeColor(doc: Document, color: string) {
  doc.querySelectorAll("*").forEach((node) => {
    const tag = node.tagName.toLowerCase();

    if (["svg", "defs", "title", "clipPath", "mask", "pattern"].includes(tag)) {
      return;
    }

    node.setAttribute("fill", "none");
    node.setAttribute("stroke", color);
    node.setAttribute("stroke-width", node.getAttribute("stroke-width") || "3");
    node.setAttribute("stroke-linejoin", "round");
    node.setAttribute("stroke-linecap", "round");
  });
}

function buildWarning({
  hasScriptBefore,
  hasRasterImage,
  hasText,
  pathCount,
  settings,
}: {
  hasScriptBefore: boolean;
  hasRasterImage: boolean;
  hasText: boolean;
  pathCount: number;
  settings: Settings;
}) {
  if (hasScriptBefore && settings.removeScripts) {
    return "Scripts or interactive code were detected and removed for safer SVG output.";
  }

  if (hasRasterImage && !settings.removeRasterImages) {
    return "This SVG contains embedded raster images. SVG editors may treat those parts as embedded bitmap artwork, not vector paths.";
  }

  if (hasText) {
    return "This SVG contains text elements. SVG editors may substitute fonts if the font is not available.";
  }

  if (pathCount === 0) {
    return "No path elements were found. The file may still be valid SVG, but it may not behave like a fully vector SVG.";
  }

  return null;
}

function getSvgNote(cleaned: {
  hasRasterImage: boolean;
  hasText: boolean;
  pathCount: number;
}) {
  if (cleaned.hasRasterImage) {
    return "Contains embedded raster images. Good for mixed artwork, not ideal for pure vector SVG paths.";
  }

  if (cleaned.hasText) {
    return "Contains live text. Install the matching font or convert text to outlines before final SVG use.";
  }

  if (cleaned.pathCount > 0) {
    return "Contains SVG paths. Good candidate for clean vector SVG use.";
  }

  return "Valid SVG, but no paths were detected.";
}

/* ========================
   Utility helpers
======================== */
function safeBase64Decode(value: string) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return "";
  }
}

function looksLikeBase64(value: string) {
  if (value.length < 16) return false;
  return /^[A-Za-z0-9+/=_-]+$/.test(value);
}

function isRasterMagic(decoded: string, originalBase64: string) {
  if (decoded.startsWith("\u0089PNG")) return true;
  if (decoded.startsWith("\u00ff\u00d8")) return true;
  if (originalBase64.startsWith("iVBORw0KGgo")) return true;
  if (originalBase64.startsWith("/9j/")) return true;
  if (originalBase64.startsWith("UklGR")) return true;
  return false;
}

function inferRasterDataUrl(base64: string) {
  if (base64.startsWith("iVBORw0KGgo")) {
    return `data:image/png;base64,${base64}`;
  }

  if (base64.startsWith("/9j/")) {
    return `data:image/jpeg;base64,${base64}`;
  }

  if (base64.startsWith("UklGR")) {
    return `data:image/webp;base64,${base64}`;
  }

  return `data:image/png;base64,${base64}`;
}

function parseSvgNumber(value: string | null) {
  if (!value) return 0;
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function minifySvg(svg: string) {
  return svg
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .replace(/\n+/g, "")
    .trim();
}

function countPathTags(svg: string) {
  return (svg.match(/<path\b/gi) || []).length;
}

function countElementsInSvgString(svg: string) {
  return (svg.match(/<[a-z][a-z0-9:-]*(?:\s|>|\/)/gi) || []).length;
}

function readableKind(kind: InputKind) {
  if (kind === "svg") return "Raw SVG";
  if (kind === "svg-data-url") return "SVG data URL";
  if (kind === "plain-base64-svg") return "Base64 SVG";
  if (kind === "raster-data-url") return "Raster data URL";
  if (kind === "plain-base64-raster") return "Base64 raster";
  if (kind === "invalid") return "Invalid";
  return "Waiting";
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function escapeLayerRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setOrReplaceSvgAttribute(attrs: string, name: string, value: string) {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*["'][^"']*["']`, "i");
  if (pattern.test(attrs)) return attrs.replace(pattern, ` ${name}="${value}"`);
  return `${attrs} ${name}="${value}"`;
}

function removeSvgAttribute(attrs: string, name: string) {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*["'][^"']*["']`, "ig");
  return attrs.replace(pattern, "");
}

function applyLayerAttrs(
  attrs: string,
  layer: LayerState,
  paintAttr: "fill" | "stroke",
) {
  const color = sanitizeClientColor(layer.color, layer.originalColor);
  let next = attrs;

  next = setOrReplaceSvgAttribute(next, paintAttr, color);
  next = setOrReplaceSvgAttribute(next, "data-layer-editor", "true");

  if (layer.visible) {
    next = removeSvgAttribute(next, "display");
  } else {
    next = setOrReplaceSvgAttribute(next, "display", "none");
  }

  return next;
}

function stripChildPaintForGroup(inner: string, paintAttr: "fill" | "stroke") {
  const pattern = new RegExp(`\\s${paintAttr}\\s*=\\s*["'][^"']*["']`, "gi");

  return inner.replace(/<path\b([^>]*)>/gi, (_match, attrs) => {
    return `<path${String(attrs || "").replace(pattern, "")}>`;
  });
}

function applyLayerEditsToSvg(
  svg: string,
  layers: LayerState[],
  fallback: {
    width: number;
    height: number;
    transparent: boolean;
    bgColor: string;
  },
): string {
  let out = svg;

  for (const layer of layers) {
    const id = escapeLayerRegExp(layer.id);
    const paintAttr: "fill" | "stroke" = "fill";

    const groupPattern = new RegExp(
      `(<g\\b(?=[^>]*data-layer-id=["']${id}["'])([^>]*)>)([\\s\\S]*?)(<\\/g>)`,
      "gi",
    );

    out = out.replace(groupPattern, (_match, _open, attrs, inner, close) => {
      const nextAttrs = applyLayerAttrs(String(attrs || ""), layer, paintAttr);
      const nextInner = stripChildPaintForGroup(String(inner || ""), paintAttr);
      return `<g${nextAttrs}>${nextInner}${close}`;
    });

    const fillElementPattern = new RegExp(
      `<([a-zA-Z][\\w:.-]*)(\\s[^<>]*?data-fill-layer-id=["']${id}["'][^<>]*?)(\\s*\\/?)>`,
      "gi",
    );

    out = out.replace(
      fillElementPattern,
      (_match, tagName, attrs, selfClose) => {
        const nextAttrs = applyLayerAttrs(String(attrs || ""), layer, "fill");
        return `<${tagName}${nextAttrs}${selfClose}>`;
      },
    );

    const strokeElementPattern = new RegExp(
      `<([a-zA-Z][\\w:.-]*)(\\s[^<>]*?data-stroke-layer-id=["']${id}["'][^<>]*?)(\\s*\\/?)>`,
      "gi",
    );

    out = out.replace(
      strokeElementPattern,
      (_match, tagName, attrs, selfClose) => {
        const nextAttrs = applyLayerAttrs(String(attrs || ""), layer, "stroke");
        return `<${tagName}${nextAttrs}${selfClose}>`;
      },
    );
  }

  if (out !== svg) return out;

  return buildClientLayeredSvg({
    width: fallback.width,
    height: fallback.height,
    layers,
    transparent: fallback.transparent,
    bgColor: fallback.bgColor,
  });
}

function buildClientLayeredSvg({
  width,
  height,
  layers,
  transparent,
  bgColor,
}: {
  width: number;
  height: number;
  layers: LayerState[];
  transparent: boolean;
  bgColor: string;
}) {
  const background = transparent
    ? ""
    : `<rect x="0" y="0" width="${width}" height="${height}" fill="${sanitizeClientColor(
        bgColor,
        "#ffffff",
      )}" />`;

  const body = layers
    .filter((layer) => layer.visible)
    .map((layer, index) => {
      const color = sanitizeClientColor(layer.color, layer.originalColor);
      const safeId = escapeClientAttr(layer.id || `layer-${index + 1}`);
      const safeName = escapeClientAttr(layer.name || `Layer ${index + 1}`);

      return `<g id="${safeId}" data-layer-id="${safeId}" data-layer-name="${safeName}" data-layer-color="${color}" fill="${color}">${layer.pathTags || ""}</g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Layered SVG from Base64 image">${background}${body}</svg>`;
}

function sanitizeClientColor(input: string, fallback: string) {
  const value = String(input || "").trim();

  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();

  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }

  return fallback || "#000000";
}

function escapeClientAttr(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ========================
   UI helpers
======================== */
function StatusPanel({
  decoded,
  scaledLabel,
}: {
  decoded: DecodedResult;
  scaledLabel: string;
}) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
      <div>
        Input type: <b>{readableKind(decoded.kind)}</b>
      </div>
      <div>
        SVG size:{" "}
        <b>
          {decoded.width && decoded.height
            ? `${decoded.width} × ${decoded.height} px`
            : "Unknown"}
        </b>
      </div>
      <div>
        Scaled output: <b>{scaledLabel}</b>
      </div>
      <div>
        Paths: <b>{decoded.pathCount}</b> · Elements:{" "}
        <b>{decoded.elementCount}</b> · Bytes: <b>{decoded.byteSize}</b>
      </div>
      <div>
        SVG note: <b>{decoded.note}</b>
      </div>
    </div>
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
    <label className="flex min-w-0 items-center gap-2 rounded-lg border border-[#edf2fb] bg-[#fafcff] px-3 py-2">
      <span className="min-w-[180px] shrink-0 text-[13px] text-slate-700">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
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
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-[110px] rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900"
    />
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
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

function PresetPicker({
  presets,
  activePreset,
  applyPreset,
}: {
  presets: Preset[];
  activePreset: string | null;
  applyPreset: (preset: Preset) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const DEFAULT_VISIBLE = 4;
  const visiblePresets = expanded ? presets : presets.slice(0, DEFAULT_VISIBLE);
  const showToggle = presets.length > DEFAULT_VISIBLE;

  return (
    <div className="mb-2 mt-[.67rem] min-w-0">
      <div className="grid gap-2 sm:grid-cols-2">
        {visiblePresets.map((preset) => {
          const isActive = activePreset === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              aria-pressed={isActive}
              title={preset.help}
              className={[
                "min-w-0 cursor-pointer rounded-lg border px-3 py-2 text-left text-[13px] font-semibold transition-colors",
                isActive
                  ? "border-sky-600 bg-sky-600 text-white hover:bg-sky-700"
                  : "border-slate-200 bg-slate-50 text-slate-900 hover:border-sky-300 hover:bg-sky-50",
              ].join(" ")}
            >
              <span className="block truncate">{preset.label}</span>
            </button>
          );
        })}
      </div>

      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          {expanded ? "Show fewer presets" : "Show more presets"}
        </button>
      )}
    </div>
  );
}

function LayerControls({
  layers,
  onLayerChange,
  onReset,
}: {
  layers: LayerState[];
  onLayerChange: (layerId: string, patch: Partial<LayerState>) => void;
  onReset: () => void;
}) {
  return (
    <div className="my-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-sm font-bold text-sky-950">Edit SVG layers</h2>

        <button
          type="button"
          onClick={onReset}
          className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
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
        Recolor or hide individual traced SVG groups before downloading.
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
  const COLOR_COMMIT_THROTTLE_MS = 160;
  const [localColor, setLocalColor] = React.useState(layer.color);
  const latestColorRef = React.useRef(layer.color);
  const lastCommitAtRef = React.useRef(0);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setLocalColor(layer.color);
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
    setLocalColor(nextColor);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      commitColorNow(latestColorRef.current);
    }, COLOR_COMMIT_THROTTLE_MS);
  }

  function resetLayer() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    latestColorRef.current = layer.originalColor;
    setLocalColor(layer.originalColor);
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
          onChange={(event) =>
            onLayerChange(layer.id, { visible: event.target.checked })
          }
          className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
          title="Show or hide layer"
        />

        <input
          type="color"
          value={localColor}
          onChange={(event) => queueColorCommit(event.target.value)}
          onPointerUp={() => commitColorNow()}
          onMouseUp={() => commitColorNow()}
          onTouchEnd={() => commitColorNow()}
          onBlur={() => commitColorNow()}
          className="h-8 w-10 cursor-pointer rounded-md border border-slate-200 bg-white"
          title="Change layer color"
        />

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-800">
            {layer.name || `Layer ${index + 1}`}
          </div>
          <div className="text-xs text-slate-500">
            {localColor.toUpperCase()} • {layer.pixelPercent}% of traced pixels
          </div>
        </div>

        <button
          type="button"
          onClick={resetLayer}
          className="cursor-pointer rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
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
  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-[1180px] px-4 py-8 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 md:p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Base64 SVG decoder
              </p>

              <h2 className="text-2xl font-bold leading-tight text-sky-950 md:text-3xl">
                Decode Base64 into a downloadable SVG file
              </h2>

              <p className="text-slate-600">
                This Base64 to SVG tool is built for users who have copied an
                encoded SVG string from HTML, CSS, an app export, a data URL, or
                a design file and need to turn it back into a normal `.svg` file
                as an SVG file.
              </p>

              <p className="text-slate-600">
                Paste a Base64 SVG, an SVG data URL, or raw SVG markup. The tool
                decodes the content, removes unsafe or unnecessary parts when
                selected, normalizes sizing, previews the design, and lets you
                download a clean SVG file.
              </p>

              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    k: "Decode SVG data URLs",
                    v: "Paste data:image/svg+xml;base64 strings",
                  },
                  {
                    k: "Clean SVG output",
                    v: "Remove scripts, metadata, comments",
                  },
                  {
                    k: "SVG checks",
                    v: "Detect text, raster images, paths",
                  },
                  {
                    k: "Export options",
                    v: "Download SVG, copy SVG, CSV, print",
                  },
                ].map((item) => (
                  <div
                    key={item.k}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="text-sm font-semibold text-sky-950">
                      {item.k}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">{item.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </header>

          <ContextualAffiliateCard />

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

          <section className="mt-12">
            <h3 className="text-lg font-bold text-sky-950">
              What this Base64 to SVG tool is for
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "SVG data URLs",
                "Base64 SVG strings",
                "Decoded SVG files",
                "SVG cleanup",
                "HTML embedded SVG",
                "CSS background SVG",
                "Embedded image checks",
                "Vinyl SVG file checks",
                "Copy SVG",
                "Download SVG",
                "SVG safety cleanup",
                "SVG preview",
              ].map((text) => (
                <span
                  key={text}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                >
                  {text}
                </span>
              ))}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold text-sky-950">
                  Supports SVG Base64 and raster Base64
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  This page decodes SVG Base64 directly. If the Base64 string is
                  a PNG, JPG, or WEBP, the tool traces it into simplified
                  layered SVG paths for layered SVG projects.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold text-sky-950">
                  Useful before SVG export
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Use the report to check whether the decoded file contains
                  paths, embedded raster images, live text, or scripts. Paths
                  are usually better for SVG files than live text or embedded
                  images.
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
                How to convert Base64 to SVG
              </h3>

              <span className="text-xs text-slate-500">
                Paste, decode, clean, preview, download SVG
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Paste your Base64 SVG",
                  body: "Paste a data:image/svg+xml;base64 URL, a plain Base64 SVG string, or raw SVG markup.",
                },
                {
                  title: "Choose a cleanup preset",
                  body: "Use clean SVG for most files, single-color SVG for simple icons, or strict clean SVG when you want to remove embedded raster images.",
                },
                {
                  title: "Review the SVG checks",
                  body: "Check whether the SVG contains paths, text, scripts, metadata, or raster images before uploading it to an SVG editor.",
                },
                {
                  title: "Adjust cleanup settings",
                  body: "Preserve colors, force a single color, remove scripts, remove metadata, normalize viewBox, or add a preview background.",
                },
                {
                  title: "Download the SVG",
                  body: "Download the decoded SVG file, copy the SVG code, or export a CSV report with the detected file details.",
                },
              ].map((step, index) => (
                <li
                  key={step.title}
                  itemScope
                  itemType="https://schema.org/HowToStep"
                  itemProp="step"
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">
                      {index + 1}
                    </div>

                    <div>
                      <div
                        itemProp="name"
                        className="font-semibold text-sky-950"
                      >
                        {step.title}
                      </div>

                      <div
                        itemProp="itemListElement"
                        className="mt-1 text-sm leading-6 text-slate-600"
                      >
                        {step.body}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold text-sky-950">
              Base64 SVG settings explained
            </h3>

            <p className="mt-2 max-w-[80ch] text-sm leading-6 text-slate-600">
              Base64 decoding is only the first step. The decoded SVG may still
              contain scripts, metadata, embedded images, live text, missing
              viewBox values, or sizing attributes that are awkward in SVG an
              SVG editor.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                {
                  title: "Preserve colors",
                  body: "Keeps the SVG as close as possible to the decoded source. Best for printable, mixed, or multi-color artwork.",
                },
                {
                  title: "Force single fill color",
                  body: "Turns shapes into one solid color, which is useful for basic one-color SVG files.",
                },
                {
                  title: "Force outline stroke",
                  body: "Shows paths as outlines so you can inspect the outline before downloading.",
                },
                {
                  title: "Remove raster images",
                  body: "Deletes embedded image tags from the SVG. Use this when you want cleaner vector-only output.",
                },
                {
                  title: "Normalize viewBox",
                  body: "Adds a usable viewBox when possible, making preview and scaling more predictable.",
                },
                {
                  title: "Responsive SVG",
                  body: "Removes fixed width and height attributes so the SVG scales better in previews and web layouts.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold text-sky-950">
                    {item.title}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold text-sky-950">
              Common Base64 to SVG problems and fixes
            </h3>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                [
                  "Base64 PNG/JPG needs layers",
                  "When the Base64 content is PNG, JPG, or WEBP, the tool traces the image into layered SVG paths for a more useful layered SVG result.",
                ],
                [
                  "The SVG has no paths",
                  "It may contain text, shapes, symbols, or embedded images instead of path elements. Editor behavior may vary.",
                ],
                [
                  "The font changes in SVG",
                  "The SVG contains live text. Install the same font or convert text to outlines before final use.",
                ],
                [
                  "The preview is blank",
                  "Try adding a solid background, preserving colors, or disabling strict raster removal.",
                ],
                [
                  "The file contains embedded images",
                  "Keep embedded images for mixed artwork, or remove them for cleaner vector-only SVG output.",
                ],
                [
                  "The Base64 string will not decode",
                  "Make sure the string is complete and does not include extra quotes, CSS wrappers, or broken characters.",
                ],
              ].map(([title, description]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold text-sky-950">
                    {title}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-lg font-bold text-sky-950">
              Backend conversion usage limits
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Client-side actions on this Base64 to SVG conversion page are not
              rate limited. Plain Base64 SVG decoding, SVG cleanup, preview
              updates, copy, CSV export, and print-to-PDF run in the browser
              after the page loads, so they do not use server conversion
              compute.
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Rate limits apply only when the input is a Base64 PNG, JPG, JPEG,
              or WEBP image that needs backend raster tracing into SVG paths.
              That server-side conversion allows up to{" "}
              {BACKEND_CONVERSION_RATE_LIMITS.perMinute} conversions per minute,{" "}
              {BACKEND_CONVERSION_RATE_LIMITS.perFiveMinutes} conversions every
              5 minutes, {BACKEND_CONVERSION_RATE_LIMITS.perHour} conversions
              per hour, and {BACKEND_CONVERSION_RATE_LIMITS.perDay} conversions
              per day for the same IP address and browser profile. If a limit is
              reached, the server returns a 429 Too Many Requests response with
              a Retry-After value.
            </p>
          </section>

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
                  q: "Can I convert Base64 to SVG?",
                  a: "Yes. If the Base64 content is encoded SVG, this tool decodes it, cleans it, previews it, and lets you download a normal SVG file.",
                },
                {
                  q: "Does this convert Base64 PNG or JPG into layered SVG paths?",
                  a: "Yes. When the input is a Base64 PNG, JPG, JPEG, or WEBP image, the tool traces the image into simplified color-separated SVG layers for layered SVG workflows. Very detailed photos may still need simpler settings or a cleaner source image.",
                },
                {
                  q: "What input formats does this accept?",
                  a: "It accepts raw SVG markup, SVG data URLs, Base64-encoded SVG strings, and common Base64 raster image data URLs that can be traced into layered SVG paths.",
                },
                {
                  q: "Why does the font change?",
                  a: "If the decoded SVG contains live text, SVG may substitute the font. Use installed fonts or convert text to outlines before final use.",
                },
                {
                  q: "Should I remove embedded raster images?",
                  a: "Remove them for cleaner vector-only SVG output. Keep them if your project needs embedded bitmap artwork.",
                },
                {
                  q: "Is the decoded SVG cleaned?",
                  a: "It can be. The settings let you remove scripts, metadata, comments, and embedded raster images, plus normalize viewBox and sizing.",
                },
                {
                  q: "Can I make the SVG single color?",
                  a: "Yes. Use the single-color SVG file preset or choose force single fill color in the settings.",
                },
                {
                  q: "Can I copy the decoded SVG code?",
                  a: "Yes. Use Copy SVG or Copy decoded text after the Base64 input has been decoded successfully.",
                },
                {
                  q: "What are the usage limits?",
                  a: `Client-side SVG decoding and cleanup are not rate limited because they run in your browser. Backend raster tracing is rate limited to ${BACKEND_CONVERSION_RATE_LIMITS.perMinute} conversions per minute, ${BACKEND_CONVERSION_RATE_LIMITS.perFiveMinutes} every 5 minutes, ${BACKEND_CONVERSION_RATE_LIMITS.perHour} per hour, and ${BACKEND_CONVERSION_RATE_LIMITS.perDay} per day per IP and browser profile.`,
                },
              ].map((item) => (
                <article
                  key={item.q}
                  itemScope
                  itemType="https://schema.org/Question"
                  itemProp="mainEntity"
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h4
                    itemProp="name"
                    className="m-0 font-semibold text-sky-950"
                  >
                    {item.q}
                  </h4>

                  <p
                    itemScope
                    itemType="https://schema.org/Answer"
                    itemProp="acceptedAnswer"
                    className="mt-2 text-sm leading-6 text-slate-600"
                  >
                    <span itemProp="text">{item.a}</span>
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
