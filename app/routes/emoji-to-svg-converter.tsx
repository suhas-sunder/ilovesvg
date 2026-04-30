import * as React from "react";
import type { Route } from "./+types/emoji-to-svg-converter";
import {
  json,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { Link, useFetcher, type ActionFunctionArgs } from "react-router";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
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
  const title = "iLoveSVG | Emoji to SVG Converter (Text & Twemoji)";
  const description =
    "Convert emoji to SVG instantly with ilovesvg. Paste emoji text to export clean Twemoji SVG, or convert emoji images (PNG or JPEG) into vector paths. Supports layouts, recoloring, backgrounds, and fast in-browser processing. Free, no uploads.";
  const canonical = "https://www.ilovesvg.com/emoji-to-svg-converter";

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
   Shared Limits
======================== */
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB
const MAX_MP = 30; // ~30 megapixels
const MAX_SIDE = 8000; // max width or height in pixels
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

// Text emoji limits (tight)
const MAX_EMOJI_TEXT_CHARS = 4000;
const MAX_EMOJI_COUNT = 128;

// Twemoji
const TWEMOJI_BASE =
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/";

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
  if (!g.__ilovesvg_emoji_converter_rate_limits) {
    g.__ilovesvg_emoji_converter_rate_limits = new Map<
      string,
      RateLimitRecord
    >();
  }
  return g.__ilovesvg_emoji_converter_rate_limits as Map<
    string,
    RateLimitRecord
  >;
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
   Used only for CPU-heavy image tracing
======================== */
type ReleaseFn = () => void;
type Gate = {
  acquireOrQueue: () => Promise<ReleaseFn>;
  running: number;
  queued: number;
};

async function getGate(): Promise<Gate> {
  const g = globalThis as any;
  if (g.__ilovesvg_gate) return g.__ilovesvg_gate as Gate;

  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  let cpuCount = 1;
  try {
    const os = req("os") as typeof import("os");
    cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 1;
  } catch {}

  const MAX = Math.max(1, Math.min(2, cpuCount));
  const QUEUE_MAX = 8;
  const EST_JOB_MS = 3000;

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

  g.__ilovesvg_gate = new SimpleGate(MAX, QUEUE_MAX);
  return g.__ilovesvg_gate as Gate;
}

/* ========================
   Action
   - mode=text: fetch Twemoji SVG(s), optional recolor, output individual/grouped layouts
   - mode=image: Potrace trace of uploaded PNG/JPEG
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
        { error: "Request too large. Please reduce size and try again." },
        { status: 413 },
      );
    }

    const rateLimit = checkBackendConversionRateLimit(
      request,
      "emoji-to-svg-converter",
      "server-convert",
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

    const mode = String(form.get("mode") ?? "image");

    if (mode === "text") {
      return await handleTextEmoji(form);
    }

    return await handleImageTrace(form, request);
  } catch (err: any) {
    return json({ error: err?.message || "Server error." }, { status: 500 });
  }
}

/* ========================
   Text Emoji mode
======================== */
type TextOutputMode = "individual" | "grouped";
type TextLayoutMode = "grid" | "row";
type TextFitMode = "center" | "repeat";
type TextCanvasMode = "auto" | "fixed";
type TextBgMode = "transparent" | "solid";

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

type TextResultItem = {
  emoji: string;
  code: string;
  svg: string; // full svg
  layers?: SvgLayerMeta[];
};

type TextActionResult = {
  mode: "text";
  error?: string;
  warnings?: string[];
  items?: TextResultItem[];
  groupedSvg?: string;
  meta?: {
    count: number;
    outputMode: TextOutputMode;
  };
};

async function handleTextEmoji(form: FormData): Promise<Response> {
  const warnings: string[] = [];

  const emojiText = String(form.get("emojiText") ?? "");
  if (!emojiText.trim()) {
    return json<TextActionResult>(
      { mode: "text", error: "Paste some emoji first." },
      { status: 400 },
    );
  }
  if (emojiText.length > MAX_EMOJI_TEXT_CHARS) {
    return json<TextActionResult>(
      {
        mode: "text",
        error: `Text too long. Max ${MAX_EMOJI_TEXT_CHARS} characters.`,
      },
      { status: 413 },
    );
  }

  const dedupe = String(form.get("dedupe") ?? "false").toLowerCase() === "true";

  const outputMode = String(
    form.get("outputMode") ?? "grouped",
  ) as TextOutputMode;
  const layout = String(form.get("layout") ?? "grid") as TextLayoutMode;
  const fit = String(form.get("fit") ?? "center") as TextFitMode;

  const cell = clampNum(form.get("cell"), 16, 512, 96);
  const pad = clampNum(form.get("pad"), 0, 256, 16);
  const cols = clampNum(form.get("cols"), 1, 64, 6);
  const margin = clampNum(form.get("margin"), 0, 512, 0);

  const canvasMode = String(form.get("canvasMode") ?? "auto") as TextCanvasMode;
  const canvasW = clampNum(form.get("canvasW"), 64, 8192, 1024);
  const canvasH = clampNum(form.get("canvasH"), 64, 8192, 1024);

  const bg = String(form.get("bg") ?? "transparent") as TextBgMode;
  const bgColor = String(form.get("bgColor") ?? "#ffffff");

  const recolor =
    String(form.get("recolor") ?? "false").toLowerCase() === "true";
  const recolorColor = String(form.get("recolorColor") ?? "#000000");

  // Split to grapheme clusters, filter emoji-ish clusters
  let clusters = splitGraphemes(emojiText)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => containsEmojiLike(s));

  if (clusters.length === 0) {
    return json<TextActionResult>(
      {
        mode: "text",
        error:
          "No emoji detected. Paste emoji characters like 😀🔥❤️ (not words).",
      },
      { status: 400 },
    );
  }

  // Dedupe preserving order
  if (dedupe) {
    const seen = new Set<string>();
    clusters = clusters.filter((x) =>
      seen.has(x) ? false : (seen.add(x), true),
    );
  }

  if (clusters.length > MAX_EMOJI_COUNT) {
    warnings.push(
      `Too many emoji. Showing first ${MAX_EMOJI_COUNT} of ${clusters.length}.`,
    );
    clusters = clusters.slice(0, MAX_EMOJI_COUNT);
  }

  // Fetch SVGs
  const items: TextResultItem[] = [];
  for (const e of clusters) {
    const code = emojiToTwemojiCode(e);
    if (!code) {
      warnings.push(`Skipped unsupported character: "${e}"`);
      continue;
    }

    const svg = await fetchTwemojiSvgWithFallback(code);
    if (!svg) {
      warnings.push(`Twemoji not found for: "${e}" (${code})`);
      continue;
    }

    const clean = sanitizeSvg(svg);

    const final = recolor ? recolorAllFills(clean, recolorColor) : clean;
    const editable = annotateSvgColorLayers(
      final,
      `emoji-${items.length + 1}-${code}`,
    );
    items.push({ emoji: e, code, svg: editable.svg, layers: editable.layers });
  }

  if (items.length === 0) {
    return json<TextActionResult>(
      { mode: "text", error: "No emoji could be converted.", warnings },
      { status: 422 },
    );
  }

  if (outputMode === "individual") {
    return json<TextActionResult>({
      mode: "text",
      items,
      warnings: warnings.length ? warnings : undefined,
      meta: { count: items.length, outputMode },
    });
  }

  // Grouped
  const groupedSvg = buildGroupedSvg(
    items.map((x) => x.svg),
    {
      layout,
      fit,
      cell,
      pad,
      cols,
      margin,
      canvasMode,
      canvasW,
      canvasH,
      bg,
      bgColor,
    },
  );

  return json<TextActionResult>({
    mode: "text",
    items,
    groupedSvg,
    warnings: warnings.length ? warnings : undefined,
    meta: { count: items.length, outputMode },
  });
}

function clampNum(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function splitGraphemes(s: string): string[] {
  try {
    // Node 18+ has Intl.Segmenter
    // @ts-ignore
    if (typeof Intl !== "undefined" && (Intl as any).Segmenter) {
      // @ts-ignore
      const seg = new (Intl as any).Segmenter(undefined, {
        granularity: "grapheme",
      });
      return Array.from(seg.segment(s), (x: any) => x.segment);
    }
  } catch {}
  // Fallback: not perfect, but handles surrogate pairs and ZWJ-ish sequences reasonably
  return Array.from(s);
}

function containsEmojiLike(s: string): boolean {
  // Extended_Pictographic catches most emoji.
  // Some flags are regional indicators, which are not Extended_Pictographic.
  try {
    // eslint-disable-next-line no-control-regex
    const ep = /\p{Extended_Pictographic}/u;
    const ri = /\p{Regional_Indicator}/u;
    return ep.test(s) || ri.test(s);
  } catch {
    // very old runtimes fallback: accept anything non-ascii as "maybe emoji"
    return /[^\x00-\x7F]/.test(s);
  }
}

function emojiToTwemojiCode(emoji: string): string | null {
  // Twemoji filenames are lower-case hex codepoints joined by '-'
  // Keep VS16 (FE0F) and ZWJ (200D) when present
  const cps: string[] = [];
  for (const cp of Array.from(emoji)) {
    const code = cp.codePointAt(0);
    if (code == null) continue;
    cps.push(code.toString(16).toLowerCase());
  }
  if (!cps.length) return null;

  // Quick cleanup: strip lone variation selector if it is the only thing
  const joined = cps.join("-");
  if (joined === "fe0f") return null;

  return joined;
}

type TwemojiCache = {
  map: Map<string, string>;
  order: string[];
  max: number;
};

function getTwemojiCache(): TwemojiCache {
  const g = globalThis as any;
  if (g.__twemoji_cache) return g.__twemoji_cache as TwemojiCache;
  g.__twemoji_cache = { map: new Map(), order: [], max: 512 } as TwemojiCache;
  return g.__twemoji_cache as TwemojiCache;
}

async function fetchTwemojiSvgWithFallback(
  code: string,
): Promise<string | null> {
  // Try exact, then without FE0F where present
  const tries = new Set<string>([code, stripFe0fFromCode(code)]);
  for (const c of tries) {
    if (!c) continue;
    const svg = await fetchTwemojiSvg(c);
    if (svg) return svg;
  }
  return null;
}

function stripFe0fFromCode(code: string): string {
  return code
    .split("-")
    .filter((x) => x !== "fe0f")
    .join("-");
}

async function fetchTwemojiSvg(code: string): Promise<string | null> {
  const cache = getTwemojiCache();
  const hit = cache.map.get(code);
  if (hit) return hit;

  const url = `${TWEMOJI_BASE}${code}.svg`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "image/svg+xml" },
    });
    if (!res.ok) return null;
    const txt = await res.text();

    // Cache with simple FIFO eviction
    cache.map.set(code, txt);
    cache.order.push(code);
    if (cache.order.length > cache.max) {
      const old = cache.order.shift();
      if (old) cache.map.delete(old);
    }
    return txt;
  } catch {
    return null;
  }
}

function sanitizeSvg(svg: string): string {
  // Remove XML/doctype/comments, keep <svg>... intact
  let out = String(svg || "").trim();
  out = out.replace(/<\?xml[\s\S]*?\?>/gi, "");
  out = out.replace(/<!doctype[\s\S]*?>/gi, "");
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.trim();
  if (!/^<svg\b/i.test(out)) {
    // Wrap if needed
    out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">${out}</svg>`;
  }
  // Ensure xmlns
  if (!/xmlns\s*=/.test(out)) {
    out = out.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
  }
  return out;
}

function recolorAllFills(svg: string, color: string): string {
  // Replace any fill=... on paths/shapes, also add fill on elements missing it
  // This makes the emoji a single-color silhouette style.
  let out = svg;

  // Replace existing fills for common primitives
  out = out.replace(/\sfill\s*=\s*["'][^"']*["']/gi, ` fill="${color}"`);

  // Remove strokes to avoid weird outlines
  out = out.replace(/\sstroke\s*=\s*["'][^"']*["']/gi, "");

  // Add fill to basic elements if missing (path/rect/circle/ellipse/polygon/polyline)
  const tags = ["path", "rect", "circle", "ellipse", "polygon", "polyline"];
  for (const t of tags) {
    const re = new RegExp(`<${t}\\b([^>]*?)>`, "gi");
    out = out.replace(re, (m, attrs) => {
      if (/fill\s*=/.test(attrs)) return m;
      return `<${t}${attrs} fill="${color}">`;
    });
  }
  return out;
}

type GroupBuildOpts = {
  layout: TextLayoutMode;
  fit: TextFitMode;
  cell: number;
  pad: number;
  cols: number;
  margin: number;
  canvasMode: TextCanvasMode;
  canvasW: number;
  canvasH: number;
  bg: TextBgMode;
  bgColor: string;
};

function buildGroupedSvg(svgs: string[], opts: GroupBuildOpts): string {
  const symbols: { id: string; viewBox: string; inner: string }[] = [];
  for (let i = 0; i < svgs.length; i++) {
    const p = extractSvgParts(svgs[i]);
    if (!p) continue;
    symbols.push({ id: `e${i}`, viewBox: p.viewBox, inner: p.inner });
  }

  if (symbols.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"></svg>`;
  }

  const n = symbols.length;
  let cols = opts.layout === "row" ? n : Math.max(1, opts.cols);
  cols = Math.min(cols, n);
  const rows = Math.ceil(n / cols);

  const stepX = opts.cell + opts.pad;
  const stepY = opts.cell + opts.pad;
  const gridW = cols * opts.cell + Math.max(0, cols - 1) * opts.pad;
  const gridH = rows * opts.cell + Math.max(0, rows - 1) * opts.pad;

  let canvasW =
    opts.canvasMode === "fixed" ? opts.canvasW : gridW + 2 * opts.margin;
  let canvasH =
    opts.canvasMode === "fixed" ? opts.canvasH : gridH + 2 * opts.margin;

  canvasW = Math.max(1, Math.floor(canvasW));
  canvasH = Math.max(1, Math.floor(canvasH));

  const baseOffsetX =
    opts.fit === "center"
      ? Math.max(0, (canvasW - gridW) / 2)
      : Math.max(0, opts.margin);
  const baseOffsetY =
    opts.fit === "center"
      ? Math.max(0, (canvasH - gridH) / 2)
      : Math.max(0, opts.margin);

  const defs =
    `<defs>` +
    symbols
      .map(
        (sym) =>
          `<symbol id="${sym.id}" viewBox="${escapeAttr(
            sym.viewBox,
          )}">${sym.inner}</symbol>`,
      )
      .join("") +
    `</defs>`;

  let uses = "";

  if (opts.fit === "repeat" && opts.canvasMode === "fixed") {
    const usableW = Math.max(0, canvasW - 2 * opts.margin);
    const usableH = Math.max(0, canvasH - 2 * opts.margin);
    const repCols = Math.max(1, Math.floor((usableW + opts.pad) / stepX));
    const repRows = Math.max(1, Math.floor((usableH + opts.pad) / stepY));
    const totalSlots = repCols * repRows;

    for (let k = 0; k < totalSlots; k++) {
      const r = Math.floor(k / repCols);
      const c = k % repCols;
      const sym = symbols[k % symbols.length];
      const x = opts.margin + c * stepX;
      const y = opts.margin + r * stepY;
      uses += `<use href="#${sym.id}" x="${formatSvgNum(x)}" y="${formatSvgNum(
        y,
      )}" width="${opts.cell}" height="${opts.cell}"/>`;
    }
  } else {
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const rowStart = r * cols;
      const rowCount = Math.min(cols, n - rowStart);
      const rowW = rowCount * opts.cell + Math.max(0, rowCount - 1) * opts.pad;
      const rowInset = Math.max(0, (gridW - rowW) / 2);
      const sym = symbols[i];
      const x = baseOffsetX + rowInset + c * stepX;
      const y = baseOffsetY + r * stepY;
      uses += `<use href="#${sym.id}" x="${formatSvgNum(x)}" y="${formatSvgNum(
        y,
      )}" width="${opts.cell}" height="${opts.cell}"/>`;
    }
  }

  const bgRect =
    opts.bg === "solid"
      ? `<rect x="0" y="0" width="${canvasW}" height="${canvasH}" fill="${escapeAttr(
          opts.bgColor,
        )}"/>`
      : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}">` +
    bgRect +
    defs +
    uses +
    `</svg>`
  );
}

function formatSvgNum(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/0+$/g, "").replace(/[.]$/g, "");
}

function extractSvgParts(
  svg: string,
): { viewBox: string; inner: string } | null {
  const s = String(svg || "").trim();
  const open = s.match(/<svg\b[^>]*>/i);
  if (!open) return null;

  const openTag = open[0];
  const vb = openTag.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  let viewBox = vb?.[1]?.trim() || "";

  // If no viewBox, try width/height
  if (!viewBox) {
    const w = openTag.match(/width\s*=\s*["'](\d+(\.\d+)?)(px)?["']/i);
    const h = openTag.match(/height\s*=\s*["'](\d+(\.\d+)?)(px)?["']/i);
    const ww = w ? Number(w[1]) : 72;
    const hh = h ? Number(h[1]) : 72;
    viewBox = `0 0 ${Math.round(ww)} ${Math.round(hh)}`;
  }

  // Inner content
  let inner = s.replace(/^[\s\S]*?<svg\b[^>]*>/i, "");
  inner = inner.replace(/<\/svg>\s*$/i, "");
  inner = inner.trim();

  return { viewBox, inner };
}

function escapeAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

async function traceBitmapToSvg(input: Buffer, opts: any): Promise<string> {
  const potrace = await import("potrace");
  const traceFn: any = (potrace as any).trace;
  const PotraceClass: any = (potrace as any).Potrace;
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

async function createLayeredColorSvg(
  input: Buffer,
  opts: LayeredColorSvgOptions,
): Promise<{
  svg: string;
  width: number;
  height: number;
  layers: SvgLayerMeta[];
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
      width: opts.maxTraceSide,
      height: opts.maxTraceSide,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width | 0;
  const height = info.height | 0;
  if (!width || !height)
    throw new Error("Could not decode image for layered SVG tracing.");

  const raw = data as Buffer;
  const pixels = collectLayerPixels(raw, width, height, {
    removeTransparent: opts.removeTransparent,
    removeWhite: opts.removeWhite,
    posterize: opts.posterize,
  });
  if (pixels.length < 20)
    throw new Error(
      "Not enough visible image data to build layers. Try disabling white background removal.",
    );

  const paletteRgb = buildLayerPalette(pixels, opts.layerCount);
  const assignments = assignAllPixelsToLayerPalette(raw, width, height, {
    palette: paletteRgb,
    removeTransparent: opts.removeTransparent,
    removeWhite: opts.removeWhite,
    posterize: opts.posterize,
  });
  const totalAssignable = assignments.assignableCount || 1;
  const rawLayerItems = paletteRgb
    .map((rgb, index) => {
      const count = assignments.counts[index] || 0;
      const percent = (count / totalAssignable) * 100;
      return { index, rgb, color: rgbObjectToHex(rgb), count, percent };
    })
    .filter((item) => item.count > 0 && item.percent >= opts.minRegionPercent)
    .sort((a, b) => {
      const lumDiff = luminance(b.rgb) - luminance(a.rgb);
      if (Math.abs(lumDiff) > 8) return lumDiff;
      return b.count - a.count;
    });
  if (rawLayerItems.length === 0)
    throw new Error(
      "No usable color layers were found. Try lowering minimum layer size or disabling white background removal.",
    );

  const builtLayers: TraceLayerBuildItem[] = [];
  for (let i = 0; i < rawLayerItems.length; i++) {
    const item = rawLayerItems[i];
    const mask = Buffer.alloc(width * height, 255);
    for (let px = 0; px < assignments.layerForPixel.length; px++) {
      if (assignments.layerForPixel[px] === item.index) mask[px] = 0;
    }
    if (!maskHasInk(mask)) continue;
    const maskPng = await sharp(mask, { raw: { width, height, channels: 1 } })
      .png()
      .toBuffer();
    const pathTags = await traceMaskToPathTags(maskPng, {
      turdSize: opts.turdSize,
      optTolerance: opts.optTolerance,
      turnPolicy: opts.turnPolicy,
    });
    if (!pathTags.trim()) continue;
    const label = `Layer ${builtLayers.length + 1}`;
    builtLayers.push({
      id: sanitizeLayerId(
        `layer-${builtLayers.length + 1}-${item.color.replace("#", "")}`,
      ),
      label,
      color: item.color,
      pixelPercent: Number(item.percent.toFixed(2)),
      pathTags,
    });
  }
  if (builtLayers.length === 0)
    throw new Error(
      "The image did not produce traceable layers. Try fewer layers, lower speckle removal, or a higher-contrast image.",
    );
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

/* ========================
   Image trace mode (Potrace)
======================== */
type ImageActionResult = {
  mode: "image";
  svg?: string;
  layers?: SvgLayerMeta[];
  error?: string;
  width?: number;
  height?: number;
  retryAfterMs?: number;
  code?: string;
  gate?: { running: number; queued: number };
};

async function handleImageTrace(
  form: FormData,
  request: Request,
): Promise<Response> {
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return json<ImageActionResult>(
      { mode: "image", error: "Upload an emoji image first." },
      { status: 400 },
    );
  }

  const webFile = file as File;
  if (!ALLOWED_MIME.has(webFile.type)) {
    return json<ImageActionResult>(
      { mode: "image", error: "Only PNG or JPEG images are allowed." },
      { status: 415 },
    );
  }
  if ((webFile.size || 0) > MAX_UPLOAD_BYTES) {
    return json<ImageActionResult>(
      {
        mode: "image",
        error: `File too large. Max ${Math.round(
          MAX_UPLOAD_BYTES / (1024 * 1024),
        )} MB.`,
      },
      { status: 413 },
    );
  }

  // Acquire concurrency slot BEFORE reading bytes into RAM
  const gate = await getGate();
  let release: ReleaseFn | null = null;

  try {
    release = await gate.acquireOrQueue();
  } catch (e: any) {
    const retryAfterMs = Math.max(1000, Number(e?.retryAfterMs) || 1500);
    return json<ImageActionResult>(
      {
        mode: "image",
        error: "Server busy converting other images. Retry soon.",
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
    const input: Buffer = Buffer.from(ab);

    // Best-effort dimension guard via sharp metadata
    try {
      const { createRequire } = await import("node:module");
      const req = createRequire(import.meta.url);
      const sharp = req("sharp") as typeof import("sharp");
      const meta = await sharp(input).metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      if (!w || !h) {
        return json<ImageActionResult>(
          { mode: "image", error: "Could not read image dimensions." },
          { status: 415 },
        );
      }
      const mp = (w * h) / 1_000_000;
      if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
        return json<ImageActionResult>(
          {
            mode: "image",
            error: `Image too large: ${w}×${h} (~${mp.toFixed(
              1,
            )} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
          },
          { status: 413 },
        );
      }
    } catch {}

    // Emoji-ish defaults (user-overridable)
    const threshold = clampNum(form.get("threshold"), 0, 255, 220);
    const turdSize = clampNum(form.get("turdSize"), 0, 50, 2);
    const optTolerance = clampNum(form.get("optTolerance"), 0.05, 1.5, 0.45);
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

    const transparent =
      String(form.get("transparent") ?? "true").toLowerCase() === "true";
    const bgColor = String(form.get("bgColor") ?? "#ffffff");

    const preprocess = String(form.get("preprocess") ?? "none") as
      | "none"
      | "edge";
    const blurSigma = clampNum(form.get("blurSigma"), 0, 3, 0.8);
    const edgeBoost = clampNum(form.get("edgeBoost"), 0.5, 2.0, 1.25);

    const traceMode = String(form.get("traceMode") ?? "layered") as TraceMode;
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
      Number(form.get("layerTurdSize") ?? BASE_LAYERED_COLOR_DEFAULTS.turdSize),
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
        form.get("posterize") ?? String(BASE_LAYERED_COLOR_DEFAULTS.posterize),
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

    if (traceMode === "layered" && !invert) {
      const layered = await createLayeredColorSvg(input, {
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
      });

      return json<ImageActionResult>({
        mode: "image",
        svg: layered.svg,
        layers: layered.layers,
        width: layered.width,
        height: layered.height,
        gate: { running: gate.running, queued: gate.queued },
      });
    }

    const prepped = await normalizeForPotrace(input, {
      preprocess,
      blurSigma,
      edgeBoost,
    });

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

    const editable = annotateSvgColorLayers(finalSVG, "traced-emoji");

    return json<ImageActionResult>({
      mode: "image",
      svg: editable.svg,
      layers: editable.layers,
      width: ensured.width,
      height: ensured.height,
      gate: { running: gate.running, queued: gate.queued },
    });
  } finally {
    try {
      release?.();
    } catch {}
  }
}

/* ---------- Image normalization for Potrace (server-side, tight) ---------- */
async function normalizeForPotrace(
  input: Buffer,
  opts: { preprocess: "none" | "edge"; blurSigma: number; edgeBoost: number },
): Promise<Buffer> {
  try {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const sharp = req("sharp") as typeof import("sharp");

    // Tight droplet settings (best-effort)
    try {
      (sharp as any).concurrency?.(1);
      (sharp as any).cache?.({ files: 0, memory: 28 });
    } catch {}

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

      const src = data as Buffer;
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
          out[y * W + x] = 255 - m;
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

      return await sharp(out, { raw: { width: W, height: H, channels: 1 } })
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
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if (/^#[0-9a-f]{8}$/i.test(raw)) return `#${raw.slice(1, 7)}`;
  const rgbMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map((part) => part.trim());
    if (parts.length >= 3) {
      const nums = parts.slice(0, 3).map((part) => {
        if (part.endsWith("%"))
          return clampByte((parseFloat(part) / 100) * 255);
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

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) => clampByte(v).toString(16).padStart(2, "0"))
    .join("")}`;
}

function sanitizeLayerId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function annotateSvgColorLayers(
  svg: string,
  idPrefix: string,
): { svg: string; layers: SvgLayerMeta[] } {
  const layers: SvgLayerMeta[] = [];
  const layerIds = new Map<string, string>();
  let fillCount = 0;
  let strokeCount = 0;
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

  function getLayer(kind: SvgLayerKind, color: string): string {
    const key = `${kind}:${color}`;
    const existing = layerIds.get(key);
    if (existing) return existing;
    const count = kind === "fill" ? ++fillCount : ++strokeCount;
    const id = sanitizeLayerId(
      `${idPrefix}-${kind}-${count}-${color.replace("#", "")}`,
    );
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

  const annotated = svg.replace(
    /<([a-zA-Z][\w:.-]*)(\s[^<>]*?)?(\s*\/?)>/g,
    (match, rawTagName, rawAttrs = "", rawSelfClose = "") => {
      const tagName = String(rawTagName || "").toLowerCase();
      if (excludedTags.has(tagName)) return match;
      let attrs = String(rawAttrs || "");
      if (
        /\bdata-fill-layer-id\s*=|\bdata-stroke-layer-id\s*=|\bdata-layer-id\s*=/i.test(
          attrs,
        )
      ) {
        return match;
      }
      const fillColor = extractPaintColorFromAttrs(attrs, "fill");
      const strokeColor = extractPaintColorFromAttrs(attrs, "stroke");
      if (!fillColor && !strokeColor) return match;
      if (fillColor)
        attrs += ` data-fill-layer-id="${getLayer("fill", fillColor)}"`;
      if (strokeColor)
        attrs += ` data-stroke-layer-id="${getLayer("stroke", strokeColor)}"`;
      return `<${rawTagName}${attrs}${rawSelfClose}>`;
    },
  );

  return { svg: annotated, layers };
}

function extractPaintColorFromAttrs(
  attrs: string,
  property: SvgLayerKind,
): string | null {
  const attrPattern = new RegExp(
    `\\b${property}\\s*=\\s*["']([^"']+)["']`,
    "i",
  );
  const direct = normalizeSvgEditableColor(
    String(attrs).match(attrPattern)?.[1] || "",
  );
  if (direct) return direct;
  const style =
    String(attrs).match(/\bstyle\s*=\s*["']([^"']*)["']/i)?.[1] || "";
  if (style) {
    const stylePattern = new RegExp(
      `(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`,
      "i",
    );
    const styled = normalizeSvgEditableColor(
      style.match(stylePattern)?.[1] || "",
    );
    if (styled) return styled;
  }
  return null;
}

function applyLayerEditsToSvg(
  svg: string,
  layers: SvgLayerMeta[] | undefined,
): string {
  if (!layers?.length) return svg;
  let out = svg;
  for (const layer of layers) {
    out = updateSvgTagsForLayer(
      out,
      "data-layer-id",
      layer,
      layer.kind || "fill",
    );
    out = updateSvgTagsForLayer(out, "data-fill-layer-id", layer, "fill");
    out = updateSvgTagsForLayer(out, "data-stroke-layer-id", layer, "stroke");
  }
  return out;
}

function updateSvgTagsForLayer(
  svg: string,
  dataAttr: "data-layer-id" | "data-fill-layer-id" | "data-stroke-layer-id",
  layer: SvgLayerMeta,
  paintKind: SvgLayerKind,
): string {
  const escapedId = escapeReg(layer.id);
  const re = new RegExp(
    `<([a-zA-Z][\\w:.-]*)([^<>]*\\b${dataAttr}\\s*=\\s*["']${escapedId}["'][^<>]*?)(\\s*\\/?)>`,
    "gi",
  );

  return svg.replace(re, (_match, tagName, attrs = "", selfClose = "") => {
    let nextAttrs = String(attrs);
    nextAttrs = removeEditorDisplay(nextAttrs);
    nextAttrs = removePaintFromStyle(nextAttrs, paintKind);
    nextAttrs = setSvgAttr(nextAttrs, paintKind, layer.color);
    nextAttrs = setSvgAttr(
      nextAttrs,
      "data-editor-display",
      layer.visible ? "visible" : "none",
    );
    if (!layer.visible) {
      nextAttrs = setSvgAttr(nextAttrs, "display", "none");
    } else if (/\bdisplay\s*=\s*["']none["']/i.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/\sdisplay\s*=\s*["']none["']/i, "");
    }
    return `<${tagName}${nextAttrs}${selfClose}>`;
  });
}

function setSvgAttr(attrs: string, name: string, value: string): string {
  const pattern = new RegExp(
    `\\s${escapeReg(name)}\\s*=\\s*["'][^"']*["']`,
    "i",
  );
  if (pattern.test(attrs))
    return attrs.replace(pattern, ` ${name}="${escapeAttr(value)}"`);
  return `${attrs} ${name}="${escapeAttr(value)}"`;
}

function removeEditorDisplay(attrs: string): string {
  if (/\bdata-editor-display\s*=\s*["']none["']/i.test(attrs)) {
    attrs = attrs.replace(/\sdisplay\s*=\s*["']none["']/i, "");
  }
  return attrs.replace(/\sdata-editor-display\s*=\s*["'][^"']*["']/i, "");
}

function removePaintFromStyle(attrs: string, paintKind: SvgLayerKind): string {
  return attrs.replace(/\sstyle\s*=\s*["']([^"']*)["']/i, (_m, styleValue) => {
    const cleaned = String(styleValue)
      .split(";")
      .map((part) => part.trim())
      .filter(
        (part) => part && !new RegExp(`^${paintKind}\\s*:`, "i").test(part),
      )
      .join("; ");
    return cleaned ? ` style="${escapeAttr(cleaned)}"` : "";
  });
}

/* ========================
   UI Types
======================== */
type Mode = "text" | "image";

type ImageSettings = {
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

type TextSettings = {
  outputMode: TextOutputMode;
  layout: TextLayoutMode;
  fit: TextFitMode;

  cell: number;
  pad: number;
  cols: number;
  margin: number;

  canvasMode: TextCanvasMode;
  canvasW: number;
  canvasH: number;

  bg: TextBgMode;
  bgColor: string;

  dedupe: boolean;
  recolor: boolean;
  recolorColor: string;
};

type ServerResult = TextActionResult | ImageActionResult;

const IMAGE_DEFAULTS: ImageSettings = {
  threshold: 220,
  turdSize: 2,
  optTolerance: 0.45,
  turnPolicy: "majority",
  lineColor: "#000000",
  invert: false,

  traceMode: "layered",
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
  edgeBoost: 1.25,
};

const TEXT_DEFAULTS: TextSettings = {
  outputMode: "grouped",
  layout: "grid",
  fit: "center",

  cell: 96,
  pad: 16,
  cols: 6,
  margin: 0,

  canvasMode: "auto",
  canvasW: 1024,
  canvasH: 1024,

  bg: "transparent",
  bgColor: "#ffffff",

  dedupe: false,
  recolor: false,
  recolorColor: "#000000",
};

export default function EmojiToSvgConverter(_: Route.ComponentProps) {
  const fetcher = useFetcher<ServerResult>();
  const busy = fetcher.state !== "idle";

  const [mode, setMode] = React.useState<Mode>("text");

  // Text mode state
  const [emojiText, setEmojiText] = React.useState<string>("😀🔥❤️");
  const [tset, setTset] = React.useState<TextSettings>(TEXT_DEFAULTS);
  const [editableTextItems, setEditableTextItems] = React.useState<
    TextResultItem[]
  >([]);
  const [advancedEmojiLayerIndex, setAdvancedEmojiLayerIndex] =
    React.useState(0);
  const [advancedEmojiLayerQuery, setAdvancedEmojiLayerQuery] =
    React.useState("");

  // Image mode state
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [iset, setIset] = React.useState<ImageSettings>(IMAGE_DEFAULTS);
  const [editableImageResult, setEditableImageResult] = React.useState<{
    svg: string;
    layers: SvgLayerMeta[];
  } | null>(null);
  const [dims, setDims] = React.useState<{
    w: number;
    h: number;
    mp: number;
  } | null>(null);

  // Hydration guard
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  // UI messages
  const [err, setErr] = React.useState<string | null>(null);
  const [warns, setWarns] = React.useState<string[]>([]);
  const [toast, setToast] = React.useState<string | null>(null);

  // Cleanup preview URL
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Update errors from server
  React.useEffect(() => {
    if (!fetcher.data) return;
    const d: any = fetcher.data;

    if (d?.error) setErr(String(d.error));
    else setErr(null);

    if (Array.isArray(d?.warnings)) setWarns(d.warnings);
    else setWarns([]);

    if (d?.mode === "text" && Array.isArray(d.items)) {
      setEditableTextItems(
        d.items.map((item: TextResultItem) => ({
          ...item,
          layers: item.layers ?? [],
        })),
      );
      setEditableImageResult(null);
      setAdvancedEmojiLayerIndex(0);
    }

    if (d?.mode === "image" && typeof d.svg === "string") {
      setEditableImageResult({
        svg: d.svg,
        layers: Array.isArray(d.layers) ? d.layers : [],
      });
      setEditableTextItems([]);
    }

    if (d?.mode === "image" && d?.retryAfterMs) {
      // We do not auto retry here since live preview is disabled.
      // User can click again.
    }
  }, [fetcher.data]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  }

  function copyText(s: string) {
    navigator.clipboard.writeText(s).then(() => showToast("Copied"));
  }

  function getTextItemSvg(item: TextResultItem): string {
    return applyLayerEditsToSvg(item.svg, item.layers);
  }

  function setTextItemLayer(
    itemIndex: number,
    layerId: string,
    patch: Partial<SvgLayerMeta>,
  ) {
    setEditableTextItems((items) =>
      items.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              layers: (item.layers ?? []).map((layer) =>
                layer.id === layerId ? { ...layer, ...patch } : layer,
              ),
            }
          : item,
      ),
    );
  }

  function resetTextItemLayer(itemIndex: number, layerId: string) {
    setEditableTextItems((items) =>
      items.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              layers: (item.layers ?? []).map((layer) =>
                layer.id === layerId
                  ? { ...layer, color: layer.originalColor, visible: true }
                  : layer,
              ),
            }
          : item,
      ),
    );
  }

  function resetAllTextItemLayers(itemIndex: number) {
    setEditableTextItems((items) =>
      items.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              layers: (item.layers ?? []).map((layer) => ({
                ...layer,
                color: layer.originalColor,
                visible: true,
              })),
            }
          : item,
      ),
    );
  }

  function setSameEmojiLayerGroup(
    sourceItemIndex: number,
    match: SameEmojiLayerMatch,
    patch: Partial<SvgLayerMeta>,
  ) {
    setEditableTextItems((items) => {
      const source = items[sourceItemIndex];
      if (!source) return items;

      return items.map((item) => {
        if (item.code !== source.code) return item;

        return {
          ...item,
          layers: (item.layers ?? []).map((layer) =>
            isSameEmojiLayerMatch(layer, match)
              ? { ...layer, ...patch }
              : layer,
          ),
        };
      });
    });
  }

  function resetSameEmojiLayerGroup(
    sourceItemIndex: number,
    match: SameEmojiLayerMatch,
  ) {
    setEditableTextItems((items) => {
      const source = items[sourceItemIndex];
      if (!source) return items;

      return items.map((item) => {
        if (item.code !== source.code) return item;

        return {
          ...item,
          layers: (item.layers ?? []).map((layer) =>
            isSameEmojiLayerMatch(layer, match)
              ? { ...layer, color: layer.originalColor, visible: true }
              : layer,
          ),
        };
      });
    });
  }

  function resetAllSameEmojiLayers(sourceItemIndex: number) {
    setEditableTextItems((items) => {
      const source = items[sourceItemIndex];
      if (!source) return items;

      return items.map((item) =>
        item.code === source.code
          ? {
              ...item,
              layers: (item.layers ?? []).map((layer) => ({
                ...layer,
                color: layer.originalColor,
                visible: true,
              })),
            }
          : item,
      );
    });
  }

  function setImageLayer(layerId: string, patch: Partial<SvgLayerMeta>) {
    setEditableImageResult((result) =>
      result
        ? {
            ...result,
            layers: result.layers.map((layer) =>
              layer.id === layerId ? { ...layer, ...patch } : layer,
            ),
          }
        : result,
    );
  }

  function resetImageLayer(layerId: string) {
    setEditableImageResult((result) =>
      result
        ? {
            ...result,
            layers: result.layers.map((layer) =>
              layer.id === layerId
                ? { ...layer, color: layer.originalColor, visible: true }
                : layer,
            ),
          }
        : result,
    );
  }

  function resetAllImageLayers() {
    setEditableImageResult((result) =>
      result
        ? {
            ...result,
            layers: result.layers.map((layer) => ({
              ...layer,
              color: layer.originalColor,
              visible: true,
            })),
          }
        : result,
    );
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
    setDims(null);
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);

    try {
      const { w, h } = await getImageSize(f);
      const mp = (w * h) / 1_000_000;
      setDims({ w, h, mp });
    } catch {
      setDims(null);
    }

    await submitImageConvert(f, iset);
  }

  function submitTextConvert() {
    const txt = emojiText || "";
    if (!txt.trim()) {
      setErr("Paste emoji first.");
      return;
    }
    setErr(null);

    const fd = new FormData();
    fd.append("mode", "text");
    fd.append("emojiText", txt);

    fd.append("outputMode", tset.outputMode);
    fd.append("layout", tset.layout);
    fd.append("fit", tset.fit);

    fd.append("cell", String(tset.cell));
    fd.append("pad", String(tset.pad));
    fd.append("cols", String(tset.cols));
    fd.append("margin", String(tset.margin));

    fd.append("canvasMode", tset.canvasMode);
    fd.append("canvasW", String(tset.canvasW));
    fd.append("canvasH", String(tset.canvasH));

    fd.append("bg", tset.bg);
    fd.append("bgColor", tset.bgColor);

    fd.append("dedupe", String(tset.dedupe));
    fd.append("recolor", String(tset.recolor));
    fd.append("recolorColor", tset.recolorColor);

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action:
        typeof window === "undefined"
          ? "/emoji-to-svg-converter"
          : window.location.pathname,
    });
  }

  async function submitImageConvert(
    targetFile: File | null = file,
    targetSettings: ImageSettings = iset,
  ) {
    if (!targetFile) {
      setErr("Upload an emoji image first.");
      return;
    }

    setErr(null);

    const fd = new FormData();
    fd.append("mode", "image");
    fd.append("file", targetFile);

    fd.append("threshold", String(targetSettings.threshold));
    fd.append("turdSize", String(targetSettings.turdSize));
    fd.append("optTolerance", String(targetSettings.optTolerance));
    fd.append("turnPolicy", targetSettings.turnPolicy);
    fd.append("lineColor", targetSettings.lineColor);
    fd.append("invert", String(targetSettings.invert));

    fd.append("traceMode", targetSettings.traceMode);
    fd.append("colorLayerCount", String(targetSettings.colorLayerCount));
    fd.append("layerMaxTraceSide", String(targetSettings.layerMaxTraceSide));
    fd.append("minRegionPercent", String(targetSettings.minRegionPercent));
    fd.append("layerOptTolerance", String(targetSettings.layerOptTolerance));
    fd.append("layerTurdSize", String(targetSettings.layerTurdSize));
    fd.append("layerTurnPolicy", targetSettings.layerTurnPolicy);
    fd.append("posterize", String(targetSettings.posterize));
    fd.append("removeWhite", String(targetSettings.removeWhite));
    fd.append("removeTransparent", String(targetSettings.removeTransparent));

    fd.append("transparent", String(targetSettings.transparent));
    fd.append("bgColor", targetSettings.bgColor);

    fd.append("preprocess", targetSettings.preprocess);
    fd.append("blurSigma", String(targetSettings.blurSigma));
    fd.append("edgeBoost", String(targetSettings.edgeBoost));

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action:
        typeof window === "undefined"
          ? "/emoji-to-svg-converter"
          : window.location.pathname,
    });
  }

  // Render helpers from server data
  const data = fetcher.data as any;

  const serverTextItems: TextResultItem[] =
    data?.mode === "text" && Array.isArray(data.items) ? data.items : [];
  const textItems: TextResultItem[] =
    editableTextItems.length > 0 ? editableTextItems : serverTextItems;

  const groupedSvg: string | null =
    data?.mode === "text" && textItems.length > 0
      ? buildGroupedSvg(
          textItems.map((item) => getTextItemSvg(item)),
          {
            layout: tset.layout,
            fit: tset.fit,
            cell: tset.cell,
            pad: tset.pad,
            cols: tset.cols,
            margin: tset.margin,
            canvasMode: tset.canvasMode,
            canvasW: tset.canvasW,
            canvasH: tset.canvasH,
            bg: tset.bg,
            bgColor: tset.bgColor,
          },
        )
      : null;

  const tracedSvg: string | null = editableImageResult?.svg
    ? applyLayerEditsToSvg(editableImageResult.svg, editableImageResult.layers)
    : data?.mode === "image" && typeof data.svg === "string"
      ? data.svg
      : null;

  const buttonDisabled = isServer || !hydrated || busy;

  const [showAdvanced, setShowAdvanced] = React.useState(false);

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

          <section className="lg:pt-0 lg:pb-8 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* LEFT: INPUT */}
            <div className="bg-white sm:border sm:border-slate-200 rounded-xl p-4 sm:shadow-sm overflow-hidden min-w-0">
              <h1 className="flex mb-3 text-sky-800 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none m-0">
                Emoji to SVG Converter
              </h1>
              <div className="flex flex-wrap gap-2 justify-center my-4">
                <button
                  type="button"
                  onClick={() => setMode("text")}
                  className={[
                    "cursor-pointer px-3 py-2 rounded-lg border font-semibold",
                    mode === "text"
                      ? "bg-[#e7eeff] border-[#0b2dff]"
                      : "bg-white border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                >
                  Text Emoji
                </button>
                <button
                  type="button"
                  onClick={() => setMode("image")}
                  className={[
                    "cursor-pointer px-3 py-2 rounded-lg border font-semibold",
                    mode === "image"
                      ? "bg-[#e7eeff] border-[#0b2dff]"
                      : "bg-white border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                >
                  Emoji Image
                </button>
              </div>
              {mode === "text" ? (
                <>
                  <div className="text-sm text-slate-600 mb-2">
                    Paste emoji characters. Supports sequences (skin tones,
                    ZWJ), flags, and multiple emojis.
                  </div>

                  <textarea
                    value={emojiText}
                    onChange={(e) => setEmojiText(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
                    placeholder="Paste emoji like 😀🔥❤️"
                  />

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
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                          <span>
                            Advanced changes do not live preview automatically.
                            Click Update preview to apply these settings.
                          </span>
                          <button
                            type="button"
                            onClick={submitTextConvert}
                            disabled={buttonDisabled}
                            className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Update preview
                          </button>
                        </div>

                        <Field label="Output">
                          <select
                            value={tset.outputMode}
                            onChange={(e) =>
                              setTset((s) => ({
                                ...s,
                                outputMode: e.target.value as any,
                              }))
                            }
                            className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                          >
                            <option value="grouped">
                              All together (one SVG)
                            </option>
                            <option value="individual">
                              Each emoji individually
                            </option>
                          </select>
                        </Field>

                        {tset.outputMode === "grouped" && (
                          <>
                            <Field label="Layout">
                              <select
                                value={tset.layout}
                                onChange={(e) =>
                                  setTset((s) => ({
                                    ...s,
                                    layout: e.target.value as any,
                                  }))
                                }
                                className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                              >
                                <option value="grid">Grid</option>
                                <option value="row">Row</option>
                              </select>
                            </Field>

                            <Field label="Fit">
                              <select
                                value={tset.fit}
                                onChange={(e) =>
                                  setTset((s) => ({
                                    ...s,
                                    fit: e.target.value as any,
                                  }))
                                }
                                className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                              >
                                <option value="center">Center the set</option>
                                <option value="repeat">
                                  Repeat to fill canvas
                                </option>
                              </select>
                            </Field>

                            <Field label="Cell size (px)">
                              <Num
                                value={tset.cell}
                                min={16}
                                max={512}
                                step={1}
                                onChange={(v) =>
                                  setTset((s) => ({ ...s, cell: v }))
                                }
                              />
                            </Field>

                            <Field label="Padding (px)">
                              <Num
                                value={tset.pad}
                                min={0}
                                max={256}
                                step={1}
                                onChange={(v) =>
                                  setTset((s) => ({ ...s, pad: v }))
                                }
                              />
                            </Field>

                            {tset.layout === "grid" && (
                              <Field label="Columns">
                                <Num
                                  value={tset.cols}
                                  min={1}
                                  max={64}
                                  step={1}
                                  onChange={(v) =>
                                    setTset((s) => ({ ...s, cols: v }))
                                  }
                                />
                              </Field>
                            )}

                            <Field label="Margin (px)">
                              <Num
                                value={tset.margin}
                                min={0}
                                max={512}
                                step={1}
                                onChange={(v) =>
                                  setTset((s) => ({ ...s, margin: v }))
                                }
                              />
                            </Field>

                            <Field label="Canvas">
                              <select
                                value={tset.canvasMode}
                                onChange={(e) =>
                                  setTset((s) => ({
                                    ...s,
                                    canvasMode: e.target.value as any,
                                  }))
                                }
                                className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                              >
                                <option value="auto">Auto (tight)</option>
                                <option value="fixed">Fixed size</option>
                              </select>
                            </Field>

                            {tset.canvasMode === "fixed" && (
                              <div className="grid grid-cols-2 gap-2">
                                <Field label="Width">
                                  <Num
                                    value={tset.canvasW}
                                    min={64}
                                    max={8192}
                                    step={1}
                                    onChange={(v) =>
                                      setTset((s) => ({ ...s, canvasW: v }))
                                    }
                                  />
                                </Field>
                                <Field label="Height">
                                  <Num
                                    value={tset.canvasH}
                                    min={64}
                                    max={8192}
                                    step={1}
                                    onChange={(v) =>
                                      setTset((s) => ({ ...s, canvasH: v }))
                                    }
                                  />
                                </Field>
                              </div>
                            )}

                            <Field label="Background">
                              <div className="flex items-center gap-2 min-w-0">
                                <select
                                  value={tset.bg}
                                  onChange={(e) =>
                                    setTset((s) => ({
                                      ...s,
                                      bg: e.target.value as any,
                                    }))
                                  }
                                  className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                                >
                                  <option value="transparent">
                                    Transparent
                                  </option>
                                  <option value="solid">Solid</option>
                                </select>

                                <input
                                  type="color"
                                  value={tset.bgColor}
                                  onChange={(e) =>
                                    setTset((s) => ({
                                      ...s,
                                      bgColor: e.target.value,
                                    }))
                                  }
                                  aria-disabled={tset.bg !== "solid"}
                                  className={[
                                    "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer",
                                    tset.bg !== "solid"
                                      ? "opacity-50 pointer-events-none"
                                      : "",
                                  ].join(" ")}
                                />
                              </div>
                            </Field>
                          </>
                        )}

                        <Field label="Deduplicate">
                          <input
                            type="checkbox"
                            checked={tset.dedupe}
                            onChange={(e) =>
                              setTset((s) => ({
                                ...s,
                                dedupe: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                          />
                          <span className="text-[13px] text-slate-700">
                            Remove duplicates
                          </span>
                        </Field>

                        <Field label="Recolor">
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={tset.recolor}
                              onChange={(e) =>
                                setTset((s) => ({
                                  ...s,
                                  recolor: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                            />
                            <span className="text-[13px] text-slate-700">
                              Single color
                            </span>

                            <input
                              type="color"
                              value={tset.recolorColor}
                              onChange={(e) =>
                                setTset((s) => ({
                                  ...s,
                                  recolorColor: e.target.value,
                                }))
                              }
                              aria-disabled={!tset.recolor}
                              className={[
                                "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer",
                                !tset.recolor
                                  ? "opacity-50 pointer-events-none"
                                  : "",
                              ].join(" ")}
                            />
                          </div>
                        </Field>

                        {editableTextItems.length > 0 && (
                          <EmojiLayerControlPanel
                            title="Per-emoji colour layers"
                            items={editableTextItems}
                            selectedIndex={advancedEmojiLayerIndex}
                            setSelectedIndex={setAdvancedEmojiLayerIndex}
                            query={advancedEmojiLayerQuery}
                            setQuery={setAdvancedEmojiLayerQuery}
                            onLayerChange={setTextItemLayer}
                            onLayerReset={resetTextItemLayer}
                            onAllReset={resetAllTextItemLayers}
                            onSameEmojiLayerChange={setSameEmojiLayerGroup}
                            onSameEmojiLayerReset={resetSameEmojiLayerGroup}
                            onAllSameEmojiReset={resetAllSameEmojiLayers}
                            compact
                          />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <button
                      type="button"
                      onClick={submitTextConvert}
                      disabled={buttonDisabled}
                      suppressHydrationWarning
                      className={[
                        "w-full px-3.5 py-2 rounded-lg font-bold border transition-colors",
                        "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0]",
                        "disabled:opacity-70 disabled:cursor-not-allowed",
                      ].join(" ")}
                    >
                      {busy ? "Converting…" : "Convert emoji text"}
                    </button>

                    <span className="text-[13px] text-slate-600">
                      Limits: {MAX_EMOJI_COUNT} emoji max,{" "}
                      {MAX_EMOJI_TEXT_CHARS} chars.
                    </span>

                    {err && <span className="text-red-700 text-sm">{err}</span>}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-slate-600 mb-2">
                    Upload an emoji image or screenshot (PNG/JPEG). This traces
                    it into editable paths. Best for stickers, icons, and simple
                    art.
                  </div>

                  {!file ? (
                    <DragArea onPick={onPick} onDrop={onDrop} />
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
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (previewUrl) URL.revokeObjectURL(previewUrl);
                            setFile(null);
                            setPreviewUrl(null);
                            setDims(null);
                            setErr(null);
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
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                          <span>
                            Advanced changes do not live preview automatically.
                            Click Update preview to apply these settings.
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              void submitImageConvert();
                            }}
                            disabled={buttonDisabled || !file}
                            className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Update preview
                          </button>
                        </div>

                        <Field label="Preprocess">
                          <select
                            value={iset.preprocess}
                            onChange={(e) =>
                              setIset((s) => ({
                                ...s,
                                preprocess: e.target.value as any,
                              }))
                            }
                            className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                          >
                            <option value="none">None (clean art)</option>
                            <option value="edge">
                              Screenshot cleanup (edges)
                            </option>
                          </select>
                        </Field>

                        {iset.preprocess === "edge" && (
                          <>
                            <Field label={`Blur σ (${iset.blurSigma})`}>
                              <Num
                                value={iset.blurSigma}
                                min={0}
                                max={3}
                                step={0.1}
                                onChange={(v) =>
                                  setIset((s) => ({ ...s, blurSigma: v }))
                                }
                              />
                            </Field>

                            <Field label={`Edge boost (${iset.edgeBoost})`}>
                              <Num
                                value={iset.edgeBoost}
                                min={0.5}
                                max={2.0}
                                step={0.1}
                                onChange={(v) =>
                                  setIset((s) => ({ ...s, edgeBoost: v }))
                                }
                              />
                            </Field>
                          </>
                        )}

                        <Field label={`Threshold (${iset.threshold})`}>
                          <input
                            type="range"
                            min={0}
                            max={255}
                            step={1}
                            value={iset.threshold}
                            onChange={(e) =>
                              setIset((s) => ({
                                ...s,
                                threshold: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-[#0b2dff] cursor-pointer"
                          />
                        </Field>

                        <Field label="Turd size (specks)">
                          <Num
                            value={iset.turdSize}
                            min={0}
                            max={20}
                            step={1}
                            onChange={(v) =>
                              setIset((s) => ({ ...s, turdSize: v }))
                            }
                          />
                        </Field>

                        <Field label="Curve tolerance">
                          <Num
                            value={iset.optTolerance}
                            min={0.05}
                            max={1.2}
                            step={0.05}
                            onChange={(v) =>
                              setIset((s) => ({ ...s, optTolerance: v }))
                            }
                          />
                        </Field>

                        <Field label="Turn policy">
                          <select
                            value={iset.turnPolicy}
                            onChange={(e) =>
                              setIset((s) => ({
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
                            value={iset.lineColor}
                            onChange={(e) =>
                              setIset((s) => ({
                                ...s,
                                lineColor: e.target.value,
                              }))
                            }
                            className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer"
                          />
                        </Field>

                        <Field label="Invert">
                          <input
                            type="checkbox"
                            checked={iset.invert}
                            onChange={(e) =>
                              setIset((s) => ({
                                ...s,
                                invert: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                          />
                        </Field>

                        <Field label="Background">
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={iset.transparent}
                              onChange={(e) =>
                                setIset((s) => ({
                                  ...s,
                                  transparent: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                            />
                            <span className="text-[13px] text-slate-700">
                              Transparent
                            </span>

                            <input
                              type="color"
                              value={iset.bgColor}
                              onChange={(e) =>
                                setIset((s) => ({
                                  ...s,
                                  bgColor: e.target.value,
                                }))
                              }
                              aria-disabled={iset.transparent}
                              className={[
                                "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer",
                                iset.transparent
                                  ? "opacity-50 pointer-events-none"
                                  : "",
                              ].join(" ")}
                            />
                          </div>
                        </Field>

                        <div className="text-[13px] text-slate-600">
                          Limits: <b>{MAX_UPLOAD_BYTES / (1024 * 1024)} MB</b> •{" "}
                          <b>{MAX_MP} MP</b> • <b>{MAX_SIDE}px longest side</b>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        void submitImageConvert();
                      }}
                      disabled={buttonDisabled || !file}
                      suppressHydrationWarning
                      className={[
                        "w-full px-3.5 py-2 rounded-lg font-bold border transition-colors",
                        "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0]",
                        "disabled:opacity-70 disabled:cursor-not-allowed",
                      ].join(" ")}
                    >
                      {busy ? "Converting…" : "Convert emoji image"}
                    </button>

                    {err && <span className="text-red-700 text-sm">{err}</span>}
                  </div>

                  {previewUrl && (
                    <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <img
                        src={previewUrl}
                        alt="Input"
                        className="w-full h-auto block"
                      />
                    </div>
                  )}
                </>
              )}

              {warns.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="text-sm font-semibold text-amber-900">
                    Notes
                  </div>
                  <ul className="mt-1 text-sm text-amber-900 list-disc pl-5">
                    {warns.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* RIGHT: RESULT */}
            <div className="bg-slate-600 border border-slate-200 rounded-xl p-4 h-full max-h-[124.25em] overflow-auto shadow-sm min-w-0">
              {busy && (
                <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
              )}

              {/* TEXT MODE RESULTS */}
              {mode === "text" ? (
                <>
                  {tset.outputMode === "grouped" ? (
                    groupedSvg ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-2">
                        <div className="rounded-xl border border-slate-200 bg-white min-h-[240px] flex items-center justify-center p-2">
                          <img
                            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                              groupedSvg,
                            )}`}
                            alt="Grouped SVG"
                            className="max-w-full h-auto"
                          />
                        </div>

                        <div className="flex gap-2 flex-wrap justify-end mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              const b = new Blob([groupedSvg], {
                                type: "image/svg+xml;charset=utf-8",
                              });
                              const u = URL.createObjectURL(b);
                              const a = document.createElement("a");
                              a.href = u;
                              a.download = "emoji-group.svg";
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              URL.revokeObjectURL(u);
                            }}
                            className="flex items-center justify-center px-3 py-2 rounded-lg font-semibold border bg-sky-500 hover:bg-sky-600 text-white border-sky-600 cursor-pointer"
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
                            onClick={() => copyText(groupedSvg)}
                            className="flex items-center justify-center px-3 py-2 rounded-lg font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                          >
                            <Icons
                              name="copy"
                              size={16}
                              className="inline-block mr-1"
                            />
                            Copy SVG
                          </button>
                        </div>

                        {textItems.length > 0 && (
                          <>
                            <EmojiLayerControlPanel
                              title="Preview colour layers"
                              items={textItems}
                              selectedIndex={advancedEmojiLayerIndex}
                              setSelectedIndex={setAdvancedEmojiLayerIndex}
                              query={advancedEmojiLayerQuery}
                              setQuery={setAdvancedEmojiLayerQuery}
                              onLayerChange={setTextItemLayer}
                              onLayerReset={resetTextItemLayer}
                              onAllReset={resetAllTextItemLayers}
                              onSameEmojiLayerChange={setSameEmojiLayerGroup}
                              onSameEmojiLayerReset={resetSameEmojiLayerGroup}
                              onAllSameEmojiReset={resetAllSameEmojiLayers}
                              compact
                            />
                            <div className="mt-3 text-[13px] text-slate-600">
                              Converted {textItems.length} emoji.
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-white  m-0">
                        {busy
                          ? "Converting…"
                          : "Your grouped SVG will appear here..."}
                      </p>
                    )
                  ) : textItems.length > 0 ? (
                    <div className="grid gap-3">
                      {textItems.map((it, idx) => (
                        <div
                          key={`${it.code}-${idx}`}
                          className="rounded-xl border border-slate-200 bg-white p-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-900">
                              {it.emoji}{" "}
                              <span className="text-slate-400 font-normal">
                                ({it.code})
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => copyText(getTextItemSvg(it))}
                                className="px-2.5 py-1.5 rounded-lg font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer text-sm"
                              >
                                Copy
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const b = new Blob([getTextItemSvg(it)], {
                                    type: "image/svg+xml;charset=utf-8",
                                  });
                                  const u = URL.createObjectURL(b);
                                  const a = document.createElement("a");
                                  a.href = u;
                                  a.download = `emoji-${it.code}.svg`;
                                  document.body.appendChild(a);
                                  a.click();
                                  a.remove();
                                  URL.revokeObjectURL(u);
                                }}
                                className="px-2.5 py-1.5 rounded-lg font-semibold border bg-sky-500 hover:bg-sky-600 text-white border-sky-600 cursor-pointer text-sm"
                              >
                                Download
                              </button>
                            </div>
                          </div>

                          <div className="mt-2 rounded-xl border border-slate-200 bg-white min-h-[140px] flex items-center justify-center p-2">
                            <img
                              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                                getTextItemSvg(it),
                              )}`}
                              alt="Emoji SVG"
                              className="max-w-full h-auto"
                            />
                          </div>

                          {(it.layers?.length ?? 0) > 0 && (
                            <LayerPaletteEditor
                              layers={it.layers ?? []}
                              onLayerChange={(layerId, patch) =>
                                setTextItemLayer(idx, layerId, patch)
                              }
                              onLayerReset={(layerId) =>
                                resetTextItemLayer(idx, layerId)
                              }
                              onAllReset={() => resetAllTextItemLayers(idx)}
                              title="Colour layers"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-600 m-0">
                      {busy
                        ? "Converting…"
                        : "Your emoji SVGs will appear here."}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {/* IMAGE MODE RESULTS */}
                  {tracedSvg ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                      <div className="rounded-xl border border-slate-200 bg-white min-h-[240px] flex items-center justify-center p-2">
                        <img
                          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                            tracedSvg,
                          )}`}
                          alt="Traced SVG"
                          className="max-w-full h-auto"
                        />
                      </div>

                      {editableImageResult?.layers?.length ? (
                        <LayerPaletteEditor
                          layers={editableImageResult.layers}
                          onLayerChange={setImageLayer}
                          onLayerReset={resetImageLayer}
                          onAllReset={resetAllImageLayers}
                          title="Colour layers"
                        />
                      ) : null}

                      <div className="flex gap-2 flex-wrap justify-end mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            const b = new Blob([tracedSvg], {
                              type: "image/svg+xml;charset=utf-8",
                            });
                            const u = URL.createObjectURL(b);
                            const a = document.createElement("a");
                            a.href = u;
                            a.download = "emoji-traced.svg";
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
                          onClick={() => copyText(tracedSvg)}
                          className="px-3 py-2 rounded-lg font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                        >
                          Copy SVG
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-white m-0">
                      {busy
                        ? "Converting…"
                        : "Your traced SVG will appear here..."}
                    </p>
                  )}
                </>
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

/* ========================
   UI small components
======================== */

function EmojiLayerControlPanel({
  title,
  items,
  selectedIndex,
  setSelectedIndex,
  query,
  setQuery,
  onLayerChange,
  onLayerReset,
  onAllReset,
  onSameEmojiLayerChange,
  onSameEmojiLayerReset,
  onAllSameEmojiReset,
  compact = false,
}: {
  title: string;
  items: TextResultItem[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  query: string;
  setQuery: (query: string) => void;
  onLayerChange: (
    itemIndex: number,
    layerId: string,
    patch: Partial<SvgLayerMeta>,
  ) => void;
  onLayerReset: (itemIndex: number, layerId: string) => void;
  onAllReset: (itemIndex: number) => void;
  onSameEmojiLayerChange?: (
    sourceItemIndex: number,
    match: SameEmojiLayerMatch,
    patch: Partial<SvgLayerMeta>,
  ) => void;
  onSameEmojiLayerReset?: (
    sourceItemIndex: number,
    match: SameEmojiLayerMatch,
  ) => void;
  onAllSameEmojiReset?: (sourceItemIndex: number) => void;
  compact?: boolean;
}) {
  const searchableItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        item.emoji.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        String(index + 1).includes(q)
      );
    });

  const selected =
    items[selectedIndex] ?? searchableItems[0]?.item ?? items[0] ?? null;
  const safeSelectedIndex = selected ? items.indexOf(selected) : 0;

  React.useEffect(() => {
    if (items.length === 0) return;
    if (selectedIndex >= items.length) setSelectedIndex(0);
  }, [items.length, selectedIndex, setSelectedIndex]);

  if (!items.length || !selected) return null;

  return (
    <div
      className={[
        "mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3",
        compact ? "text-[13px]" : "text-sm",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">
          {items.length} emoji • {(selected.layers ?? []).length} layers shown
        </div>
      </div>

      <div className="mt-2 grid gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-900 outline-none transition-colors hover:bg-slate-50 focus:border-[#0b2dff]"
          placeholder="Filter emoji by symbol, code, or number"
        />
        <select
          value={safeSelectedIndex}
          onChange={(event) => setSelectedIndex(Number(event.target.value))}
          className="min-w-0 cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-900 transition-colors hover:bg-slate-50"
        >
          {(searchableItems.length
            ? searchableItems
            : items.map((item, index) => ({ item, index }))
          ).map(({ item, index }) => (
            <option key={`${item.code}-${index}`} value={index}>
              {index + 1}. {item.emoji} {item.code}
            </option>
          ))}
        </select>
      </div>

      <LayerPaletteEditor
        layers={selected.layers ?? []}
        onLayerChange={(layerId, patch) =>
          onLayerChange(safeSelectedIndex, layerId, patch)
        }
        onLayerReset={(layerId) => onLayerReset(safeSelectedIndex, layerId)}
        onAllReset={() => onAllReset(safeSelectedIndex)}
        title={`${selected.emoji} selected instance`}
        compact
      />

      {onSameEmojiLayerChange &&
        onSameEmojiLayerReset &&
        onAllSameEmojiReset && (
          <SameEmojiLayerBatchEditor
            items={items}
            selectedIndex={safeSelectedIndex}
            onLayerChange={onSameEmojiLayerChange}
            onLayerReset={onSameEmojiLayerReset}
            onAllReset={onAllSameEmojiReset}
            compact
          />
        )}
    </div>
  );
}

type SameEmojiLayerMatch = {
  kind: SvgLayerKind;
  originalColor: string;
};

type SameEmojiLayerGroup = SameEmojiLayerMatch & {
  id: string;
  currentColor: string;
  mixed: boolean;
  visible: boolean;
  mixedVisibility: boolean;
  affectedCount: number;
};

function isSameEmojiLayerMatch(
  layer: SvgLayerMeta,
  match: SameEmojiLayerMatch,
): boolean {
  return (
    (layer.kind || "fill") === match.kind &&
    layer.originalColor.toLowerCase() === match.originalColor.toLowerCase()
  );
}

function buildSameEmojiLayerGroups(
  items: TextResultItem[],
  selectedIndex: number,
): SameEmojiLayerGroup[] {
  const selected = items[selectedIndex];
  if (!selected) return [];

  const groups = new Map<
    string,
    SameEmojiLayerGroup & { colors: Set<string>; vis: Set<string> }
  >();

  for (const item of items) {
    if (item.code !== selected.code) continue;

    for (const layer of item.layers ?? []) {
      const kind = layer.kind || "fill";
      const originalColor = layer.originalColor.toLowerCase();
      const key = `${kind}:${originalColor}`;
      const existing = groups.get(key);

      if (existing) {
        existing.affectedCount += 1;
        existing.colors.add(layer.color.toLowerCase());
        existing.vis.add(layer.visible ? "visible" : "hidden");
        existing.mixed = existing.colors.size > 1;
        existing.mixedVisibility = existing.vis.size > 1;
        if (!existing.mixed) existing.currentColor = layer.color;
        if (!existing.mixedVisibility) existing.visible = layer.visible;
        continue;
      }

      groups.set(key, {
        id: key,
        kind,
        originalColor,
        currentColor: layer.color,
        mixed: false,
        visible: layer.visible,
        mixedVisibility: false,
        affectedCount: 1,
        colors: new Set([layer.color.toLowerCase()]),
        vis: new Set([layer.visible ? "visible" : "hidden"]),
      });
    }
  }

  return Array.from(groups.values())
    .map(({ colors: _colors, vis: _vis, ...group }) => group)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
      return a.originalColor.localeCompare(b.originalColor);
    });
}

function SameEmojiLayerBatchEditor({
  items,
  selectedIndex,
  onLayerChange,
  onLayerReset,
  onAllReset,
  compact = false,
}: {
  items: TextResultItem[];
  selectedIndex: number;
  onLayerChange: (
    sourceItemIndex: number,
    match: SameEmojiLayerMatch,
    patch: Partial<SvgLayerMeta>,
  ) => void;
  onLayerReset: (sourceItemIndex: number, match: SameEmojiLayerMatch) => void;
  onAllReset: (sourceItemIndex: number) => void;
  compact?: boolean;
}) {
  const selected = items[selectedIndex];
  const groups = React.useMemo(
    () => buildSameEmojiLayerGroups(items, selectedIndex),
    [items, selectedIndex],
  );

  if (!selected || groups.length === 0) return null;

  const sameEmojiCount = items.filter(
    (item) => item.code === selected.code,
  ).length;

  return (
    <div
      className={[
        "mt-3 rounded-xl border border-sky-100 bg-sky-50 p-3",
        compact ? "text-[13px]" : "text-sm",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-slate-900">
          Same emoji batch edit
        </div>
        <button
          type="button"
          onClick={() => onAllReset(selectedIndex)}
          className="cursor-pointer rounded-md border border-sky-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-sky-100"
        >
          Reset same emoji
        </button>
      </div>

      <p className="mt-1 text-[11px] leading-4 text-slate-600">
        Edits below affect only {selected.emoji} items with the matching
        original colour layer. Other emoji and other colours stay unchanged.
      </p>

      <div className="mt-2 grid gap-1.5">
        {groups.map((group) => (
          <SameEmojiLayerBatchRow
            key={group.id}
            group={group}
            sameEmojiCount={sameEmojiCount}
            onLayerChange={(patch) =>
              onLayerChange(
                selectedIndex,
                { kind: group.kind, originalColor: group.originalColor },
                patch,
              )
            }
            onLayerReset={() =>
              onLayerReset(selectedIndex, {
                kind: group.kind,
                originalColor: group.originalColor,
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

function SameEmojiLayerBatchRow({
  group,
  sameEmojiCount,
  onLayerChange,
  onLayerReset,
}: {
  group: SameEmojiLayerGroup;
  sameEmojiCount: number;
  onLayerChange: (patch: Partial<SvgLayerMeta>) => void;
  onLayerReset: () => void;
}) {
  const [localColor, setLocalColor] = React.useState(group.currentColor);
  const latestColorRef = React.useRef(group.currentColor);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setLocalColor(group.currentColor);
    latestColorRef.current = group.currentColor;
  }, [group.currentColor]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function scheduleColorCommit() {
    if (timeoutRef.current) return;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onLayerChange({ color: latestColorRef.current });
    }, 100);
  }

  function commitColor() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onLayerChange({ color: latestColorRef.current });
  }

  return (
    <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-lg border border-sky-100 bg-white px-2 py-1.5">
      <input
        type="checkbox"
        checked={group.mixedVisibility ? true : group.visible}
        onChange={(event) => onLayerChange({ visible: event.target.checked })}
        className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
        title="Toggle this colour layer across matching emoji"
      />
      <input
        type="color"
        value={localColor}
        onChange={(event) => {
          const nextColor = event.target.value;
          setLocalColor(nextColor);
          latestColorRef.current = nextColor;
          scheduleColorCommit();
        }}
        onPointerUp={commitColor}
        onMouseUp={commitColor}
        onTouchEnd={commitColor}
        onBlur={commitColor}
        className="h-7 w-10 cursor-pointer rounded-md border border-sky-200 bg-white"
        title={`Edit all matching ${group.originalColor} layers for this emoji`}
      />
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-slate-800">
          {group.kind === "fill" ? "Fill" : "Stroke"} {group.originalColor}
          {group.mixed ? " • mixed" : ""}
        </div>
        <div className="truncate text-[11px] text-slate-500">
          {group.affectedCount} layer{group.affectedCount === 1 ? "" : "s"}{" "}
          across {sameEmojiCount} same emoji
        </div>
      </div>
      <button
        type="button"
        onClick={onLayerReset}
        className="cursor-pointer rounded-md border border-sky-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-sky-100"
      >
        Reset
      </button>
    </div>
  );
}

function LayerPaletteEditor({
  layers,
  onLayerChange,
  onLayerReset,
  onAllReset,
  title = "Colour layers",
  compact = false,
}: {
  layers: SvgLayerMeta[];
  onLayerChange: (layerId: string, patch: Partial<SvgLayerMeta>) => void;
  onLayerReset: (layerId: string) => void;
  onAllReset: () => void;
  title?: string;
  compact?: boolean;
}) {
  if (!layers.length) return null;

  return (
    <div
      className={[
        "mt-3 rounded-xl border border-slate-200 bg-white p-3",
        compact ? "text-[13px]" : "text-sm",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-slate-900">{title}</div>
        <button
          type="button"
          onClick={onAllReset}
          className="cursor-pointer rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          Reset all
        </button>
      </div>

      <div className="mt-2 grid gap-1.5">
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
  layer: SvgLayerMeta;
  onLayerChange: (layerId: string, patch: Partial<SvgLayerMeta>) => void;
  onLayerReset: (layerId: string) => void;
}) {
  const [localColor, setLocalColor] = React.useState(layer.color);
  const latestColorRef = React.useRef(layer.color);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setLocalColor(layer.color);
    latestColorRef.current = layer.color;
  }, [layer.color]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function scheduleColorCommit(nextColor: string) {
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
    <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
      <input
        type="checkbox"
        checked={layer.visible}
        onChange={(event) =>
          onLayerChange(layer.id, { visible: event.target.checked })
        }
        className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
        title="Toggle layer visibility"
      />
      <input
        type="color"
        value={localColor}
        onChange={(event) => {
          const nextColor = event.target.value;
          setLocalColor(nextColor);
          latestColorRef.current = nextColor;
          scheduleColorCommit(nextColor);
        }}
        onPointerUp={commitColor}
        onMouseUp={commitColor}
        onTouchEnd={commitColor}
        onBlur={commitColor}
        className="h-7 w-10 cursor-pointer rounded-md border border-slate-200 bg-white"
        title={`Edit ${layer.label}`}
      />
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-slate-800">
          {layer.label}
        </div>
        <div className="truncate text-[11px] text-slate-500">
          Original {layer.originalColor}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onLayerReset(layer.id)}
        className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
      >
        Reset
      </button>
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
    <label className="flex items-center gap-2 bg-[#fafcff] border border-[#edf2fb] rounded-lg px-3 py-2 min-w-0">
      <span className="min-w-[160px] text-[13px] text-slate-700 shrink-0">
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
      className="w-[120px] px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
    />
  );
}

/* ========================
   SEO section (kept short)
======================== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 pt-8 text-slate-900">
        <div className="grid">
          {/* Main content */}
          <article className=" ">
            <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Emoji to SVG Converter
              </p>
              <h2 className="mt-2 text-2xl md:text-3xl font-bold leading-tight">
                Convert emoji to SVG from text or images
              </h2>
              <p className="mt-3 text-slate-700 leading-relaxed">
                This utility converts emoji into real SVG graphics that scale
                cleanly in browsers, design tools, and print workflows. You can
                generate SVG from emoji text using Twemoji’s vector sources, or
                upload emoji images and trace them into editable vector paths.
                The output is a single SVG file that you can drop into a design
                system, inline in HTML, or export for downstream use.
              </p>
              <p className="mt-2 text-slate-600  mx-auto">
                Convert emoji to SVG from pasted emoji text (Twemoji SVG) or
                from emoji images (PNG/JPEG traced to editable paths). Live
                preview is disabled here to keep the server stable.
              </p>
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

            <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
              <h3 className="text-xl font-bold">How the converter works</h3>

              <div className="mt-4 space-y-5 text-slate-700 leading-relaxed">
                <p>
                  The converter supports two distinct pipelines: text-based
                  conversion using Twemoji SVG sources, and image-based tracing
                  for PNG or JPEG uploads. Both pipelines produce a standards-
                  compliant SVG with a predictable viewBox, so the result can be
                  resized without distortion and aligned cleanly inside layouts.
                </p>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">
                    1) Text → SVG (Twemoji pipeline)
                  </p>
                  <p className="mt-2">
                    When you paste emoji characters, each emoji is resolved to
                    its Twemoji vector source. The converter normalizes the
                    geometry, applies consistent sizing, and optionally groups
                    multiple emoji into a single SVG. This avoids platform-
                    specific emoji fonts and guarantees consistent rendering
                    across browsers and devices.
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Unicode emoji are mapped to vector sources</li>
                    <li>• Geometry is normalized into a single SVG viewBox</li>
                    <li>• Multiple emoji can be grouped into one file</li>
                    <li>• Output remains sharp at any scale</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">
                    2) Image → SVG (Tracing pipeline)
                  </p>
                  <p className="mt-2">
                    When you upload an emoji image, the converter traces raster
                    pixels into vector paths. This produces editable SVG paths
                    that you can modify in vector editors. Tracing is best used
                    when you need to preserve a specific emoji style or when the
                    source is not available as Twemoji.
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• PNG and JPEG inputs supported</li>
                    <li>• Raster edges are converted into vector paths</li>
                    <li>• Output paths are editable in design tools</li>
                    <li>• Higher-resolution sources produce cleaner results</li>
                  </ul>
                </div>

                <p>
                  Both pipelines output a single SVG file with explicit width,
                  height, and viewBox attributes. This ensures predictable
                  scaling when the SVG is used inline, as an{" "}
                  <code>{"<img />"}</code> source, or as a background asset in
                  CSS.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 my-6">
              <h3 className="text-xl font-bold">
                Layout, grouping, and canvas behavior
              </h3>

              <div className="mt-4 space-y-4 text-slate-700 leading-relaxed">
                <p>
                  The converter is utility-first. Instead of exporting isolated
                  files only, it can assemble multiple emoji into a single SVG
                  and place them inside a defined canvas. This reduces asset
                  sprawl and makes it easier to manage composite graphics.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">Grouping</p>
                    <p className="mt-1 text-sm">
                      Multiple emoji pasted in sequence can be exported as one
                      SVG. Internally, each emoji is wrapped and aligned, then
                      combined into a single coordinate system. This is useful
                      for headers, badges, or sticker-like composites.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">Centering</p>
                    <p className="mt-1 text-sm">
                      Centering repositions the content inside the SVG viewBox
                      so the graphic sits in the middle when placed in a layout.
                      This prevents off-center alignment when the SVG is used in
                      buttons, cards, or icons.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">
                      Repeat to fill
                    </p>
                    <p className="mt-1 text-sm">
                      Repetition tiles the emoji across a fixed canvas. This is
                      designed for lightweight pattern backgrounds or decorative
                      separators without shipping large raster images.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">
                      Predictable sizing
                    </p>
                    <p className="mt-1 text-sm">
                      Output dimensions are explicit. You can scale the SVG with
                      CSS or attributes without changing internal proportions.
                    </p>
                  </div>
                </div>

                <p>
                  These layout controls are deterministic. The same inputs and
                  settings always produce the same geometry, which is important
                  for reproducible assets in design systems and CI pipelines.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 mb-6">
              <h3 className="text-xl font-bold">
                Output guarantees and integration
              </h3>

              <div className="mt-4 space-y-4 text-slate-700 leading-relaxed">
                <p>
                  The exported SVG is standards-compliant and designed to drop
                  into common workflows without cleanup. You can inline it in
                  HTML, import it into React or Vue components, or open it in
                  vector editors for further edits.
                </p>

                <ul className="space-y-2 text-sm">
                  <li>
                    <span className="font-semibold">Clean markup:</span> no
                    platform emoji fonts or bitmap embeds.
                  </li>
                  <li>
                    <span className="font-semibold">
                      Deterministic viewBox:
                    </span>{" "}
                    consistent scaling and alignment.
                  </li>
                  <li>
                    <span className="font-semibold">Single-file export:</span>{" "}
                    grouped emoji are exported together.
                  </li>
                  <li>
                    <span className="font-semibold">Editor-friendly:</span>{" "}
                    paths can be edited in Figma, Illustrator, or Inkscape.
                  </li>
                  <li>
                    <span className="font-semibold">Framework-ready:</span>{" "}
                    usable as inline SVG in React, Remix, or static HTML.
                  </li>
                </ul>

                <p>
                  Because the output is geometry, not a font glyph, the SVG will
                  render the same across browsers and operating systems. This is
                  the primary reason to convert emoji to SVG instead of relying
                  on native emoji fonts.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
              <h3 className="text-xl font-bold">Performance and reliability</h3>

              <div className="mt-4 space-y-4 text-slate-700 leading-relaxed">
                <p>
                  The converter is designed for predictable exports rather than
                  heavy real-time rendering. In some deployments, live preview
                  is disabled to protect server stability. This does not affect
                  output quality. Settings are applied deterministically at
                  export time.
                </p>

                <p>
                  Image tracing is more expensive than text-based conversion.
                  For batch work or automated workflows, text mode is faster and
                  produces more consistent geometry. Tracing should be reserved
                  for cases where you must preserve a specific raster style.
                </p>

                <p>
                  This emoji to SVG conversion page only rate limits backend
                  conversion work, including Twemoji SVG generation and raster
                  image tracing. Client-side preview rendering, colour layer
                  edits, copy actions, and local download generation are not
                  rate limited because they run in the browser after conversion.
                  Backend conversion actions allow up to 120 conversions per
                  minute, 400 conversions every 5 minutes, 1500 conversions per
                  hour, and 3000 conversions per day for the same connection and
                  browser profile.
                </p>

                <p>
                  The output SVG is lightweight compared to raster images at
                  multiple resolutions. This reduces asset size in web projects
                  and avoids shipping multiple PNG sizes for different screens.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 my-4">
                <h3 className="text-lg font-bold">Workflow summary</h3>
                <ol className="mt-3 space-y-2 text-sm text-slate-700 leading-relaxed list-decimal list-inside">
                  <li>Choose text or image input</li>
                  <li>Set layout options (group, center, repeat)</li>
                  <li>Export a single SVG file</li>
                  <li>Use inline or in your design system</li>
                </ol>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 my-4">
                <h3 className="text-lg font-bold">Best practice</h3>
                <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                  Default to text-based conversion for UI and product surfaces.
                  Use image tracing only when you need to preserve a specific
                  emoji style that is not available as vector sources.
                </p>
              </div>
            </section>
          </article>
        </div>
      </div>
    </section>
  );
}
