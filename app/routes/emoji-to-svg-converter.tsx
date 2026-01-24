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

/** Stable server flag: true on SSR render, false in client bundle */
const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "Emoji to SVG Converter (Text or Image) - Export SVG fast";
  const description =
    "Convert emoji to SVG from either pasted emoji text (Twemoji SVG) or emoji images (PNG/JPEG traced to paths). Supports grouped layouts, repeat-fill, background, recolor, and in-memory processing.";
  const urlPath = "/emoji-to-svg-converter";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },

    { tagName: "link", rel: "canonical", href: urlPath },

    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: urlPath },
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
  if (g.__iheartsvg_gate) return g.__iheartsvg_gate as Gate;

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

  g.__iheartsvg_gate = new SimpleGate(MAX, QUEUE_MAX);
  return g.__iheartsvg_gate as Gate;
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

type TextResultItem = {
  emoji: string;
  code: string;
  svg: string; // full svg
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
    items.push({ emoji: e, code, svg: final });
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
  // Parse each SVG into symbol
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

  // Determine base grid
  let cols = opts.layout === "row" ? n : Math.max(1, opts.cols);
  cols = Math.min(cols, n);
  const rows = Math.ceil(n / cols);

  const contentW =
    cols * opts.cell + Math.max(0, cols - 1) * opts.pad + 2 * opts.margin;
  const contentH =
    rows * opts.cell + Math.max(0, rows - 1) * opts.pad + 2 * opts.margin;

  let canvasW = opts.canvasMode === "fixed" ? opts.canvasW : contentW;
  let canvasH = opts.canvasMode === "fixed" ? opts.canvasH : contentH;

  canvasW = Math.max(1, Math.floor(canvasW));
  canvasH = Math.max(1, Math.floor(canvasH));

  // Placement helpers
  const stepX = opts.cell + opts.pad;
  const stepY = opts.cell + opts.pad;

  let offsetX = opts.margin;
  let offsetY = opts.margin;

  if (opts.fit === "center") {
    // Only meaningful when canvas bigger than content
    const cx = Math.max(0, Math.floor((canvasW - contentW) / 2));
    const cy = Math.max(0, Math.floor((canvasH - contentH) / 2));
    offsetX = cx + opts.margin;
    offsetY = cy + opts.margin;
  }

  // Build <defs> with symbols
  const defs =
    `<defs>` +
    symbols
      .map(
        (s) =>
          `<symbol id="${s.id}" viewBox="${escapeAttr(
            s.viewBox,
          )}">${s.inner}</symbol>`,
      )
      .join("") +
    `</defs>`;

  // Build <use> elements
  let uses = "";

  if (opts.fit === "repeat" && opts.canvasMode === "fixed") {
    // Repeat fill: tile emojis in order across the canvas
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
      uses += `<use href="#${sym.id}" x="${x}" y="${y}" width="${opts.cell}" height="${opts.cell}"/>`;
    }
  } else {
    // Center or auto canvas: place each emoji once
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const sym = symbols[i];
      const x = offsetX + c * stepX;
      const y = offsetY + r * stepY;
      uses += `<use href="#${sym.id}" x="${x}" y="${y}" width="${opts.cell}" height="${opts.cell}"/>`;
    }
  }

  const bgRect =
    opts.bg === "solid"
      ? `<rect x="0" y="0" width="${canvasW}" height="${canvasH}" fill="${escapeAttr(
          opts.bgColor,
        )}"/>`
      : "";

  // Root SVG: responsive (no width/height attributes by default)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}">` +
    bgRect +
    defs +
    uses +
    `</svg>`;

  return svg;
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

/* ========================
   Image trace mode (Potrace)
======================== */
type ImageActionResult = {
  mode: "image";
  svg?: string;
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

    return json<ImageActionResult>({
      mode: "image",
      svg: finalSVG,
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

  // Image mode state
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [iset, setIset] = React.useState<ImageSettings>(IMAGE_DEFAULTS);
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
      action: `${window.location.pathname}?index`,
    });
  }

  async function submitImageConvert() {
    if (!file) {
      setErr("Upload an emoji image first.");
      return;
    }

    setErr(null);

    const fd = new FormData();
    fd.append("mode", "image");
    fd.append("file", file);

    fd.append("threshold", String(iset.threshold));
    fd.append("turdSize", String(iset.turdSize));
    fd.append("optTolerance", String(iset.optTolerance));
    fd.append("turnPolicy", iset.turnPolicy);
    fd.append("lineColor", iset.lineColor);
    fd.append("invert", String(iset.invert));

    fd.append("transparent", String(iset.transparent));
    fd.append("bgColor", iset.bgColor);

    fd.append("preprocess", iset.preprocess);
    fd.append("blurSigma", String(iset.blurSigma));
    fd.append("edgeBoost", String(iset.edgeBoost));

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action: `${window.location.pathname}?index`,
    });
  }

  // Render helpers from server data
  const data = fetcher.data as any;

  const textItems: TextResultItem[] =
    data?.mode === "text" && Array.isArray(data.items) ? data.items : [];

  const groupedSvg: string | null =
    data?.mode === "text" && typeof data.groupedSvg === "string"
      ? data.groupedSvg
      : null;

  const tracedSvg: string | null =
    data?.mode === "image" && typeof data.svg === "string" ? data.svg : null;

  const buttonDisabled = isServer || !hydrated || busy;

  return (
    <>

      <main className="min-h-[100dvh] bg-slate-50 text-slate-900">
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-12">
          <header className="text-center mb-3">
            <h1 className="text-[34px] font-extrabold leading-none m-0">
              Emoji to SVG Converter
            </h1>
            <p className="mt-2 text-slate-600 max-w-[90ch] mx-auto">
              Convert emoji to SVG from pasted emoji text (Twemoji SVG) or from
              emoji images (PNG/JPEG traced to editable paths). Live preview is
              disabled here to keep the server stable.
            </p>
          </header>

          {/* Mode selector */}
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            <button
              type="button"
              onClick={() => setMode("text")}
              className={[
                "px-3 py-2 rounded-lg border font-semibold",
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
                "px-3 py-2 rounded-lg border font-semibold",
                mode === "image"
                  ? "bg-[#e7eeff] border-[#0b2dff]"
                  : "bg-white border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              Emoji Image
            </button>
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* LEFT: INPUT */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden min-w-0">
              <h2 className="m-0 mb-3 text-lg text-slate-900">Input</h2>

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

                  <div className="mt-3 grid gap-2">
                    <Field label="Output">
                      <select
                        value={tset.outputMode}
                        onChange={(e) =>
                          setTset((s) => ({
                            ...s,
                            outputMode: e.target.value as any,
                          }))
                        }
                        className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                      >
                        <option value="grouped">All together (one SVG)</option>
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
                            className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
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
                            className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
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
                            onChange={(v) => setTset((s) => ({ ...s, pad: v }))}
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
                            className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
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
                              className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                            >
                              <option value="transparent">Transparent</option>
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
                                "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white",
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
                          setTset((s) => ({ ...s, dedupe: e.target.checked }))
                        }
                        className="h-4 w-4 accent-[#0b2dff]"
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
                          className="h-4 w-4 accent-[#0b2dff]"
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
                            "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white",
                            !tset.recolor
                              ? "opacity-50 pointer-events-none"
                              : "",
                          ].join(" ")}
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <button
                      type="button"
                      onClick={submitTextConvert}
                      disabled={buttonDisabled}
                      suppressHydrationWarning
                      className={[
                        "px-3.5 py-2 rounded-lg font-bold border transition-colors",
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
                    <div
                      role="button"
                      tabIndex={0}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={onDrop}
                      onClick={() =>
                        document.getElementById("file-inp")?.click()
                      }
                      className="border border-dashed border-[#c8d3ea] rounded-xl p-4 text-center cursor-pointer min-h-[10em] flex justify-center items-center bg-[#f9fbff] hover:bg-[#f2f6ff] focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <div className="text-sm text-slate-600">
                        Click, drag & drop, or paste an emoji image (PNG/JPEG)
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

                  <div className="mt-3 flex flex-col gap-2 min-w-0">
                    <Field label="Preprocess">
                      <select
                        value={iset.preprocess}
                        onChange={(e) =>
                          setIset((s) => ({
                            ...s,
                            preprocess: e.target.value as any,
                          }))
                        }
                        className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                      >
                        <option value="none">None (clean art)</option>
                        <option value="edge">Screenshot cleanup (edges)</option>
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
                        className="w-full accent-[#0b2dff]"
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
                        value={iset.lineColor}
                        onChange={(e) =>
                          setIset((s) => ({ ...s, lineColor: e.target.value }))
                        }
                        className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white"
                      />
                    </Field>

                    <Field label="Invert">
                      <input
                        type="checkbox"
                        checked={iset.invert}
                        onChange={(e) =>
                          setIset((s) => ({ ...s, invert: e.target.checked }))
                        }
                        className="h-4 w-4 accent-[#0b2dff]"
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
                          className="h-4 w-4 accent-[#0b2dff]"
                        />
                        <span className="text-[13px] text-slate-700">
                          Transparent
                        </span>
                        <input
                          type="color"
                          value={iset.bgColor}
                          onChange={(e) =>
                            setIset((s) => ({ ...s, bgColor: e.target.value }))
                          }
                          aria-disabled={iset.transparent}
                          className={[
                            "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white",
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

                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <button
                      type="button"
                      onClick={submitImageConvert}
                      disabled={buttonDisabled || !file}
                      suppressHydrationWarning
                      className={[
                        "px-3.5 py-2 rounded-lg font-bold border transition-colors",
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
            <div className="bg-sky-50/10 border border-slate-200 rounded-xl p-4 h-full max-h-[124.25em] overflow-auto shadow-sm min-w-0">
              <h2 className="m-0 mb-3 text-lg text-slate-900 flex items-center gap-2">
                Result
                {busy && (
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
                )}
              </h2>

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
                            className="px-3 py-2 rounded-lg font-semibold border bg-sky-500 hover:bg-sky-600 text-white border-sky-600 cursor-pointer"
                          >
                            Download SVG
                          </button>
                          <button
                            type="button"
                            onClick={() => copyText(groupedSvg)}
                            className="px-3 py-2 rounded-lg font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                          >
                            Copy SVG
                          </button>
                        </div>

                        {textItems.length > 0 && (
                          <div className="mt-3 text-[13px] text-slate-600">
                            Converted {textItems.length} emoji.
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-600 m-0">
                        {busy
                          ? "Converting…"
                          : "Your grouped SVG will appear here."}
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
                                onClick={() => copyText(it.svg)}
                                className="px-2.5 py-1.5 rounded-lg font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer text-sm"
                              >
                                Copy
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const b = new Blob([it.svg], {
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
                                it.svg,
                              )}`}
                              alt="Emoji SVG"
                              className="max-w-full h-auto"
                            />
                          </div>
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
                    <p className="text-slate-600 m-0">
                      {busy
                        ? "Converting…"
                        : "Your traced SVG will appear here."}
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
                  to="/emoji-to-svg-converter"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Emoji to SVG
                </Link>
              </li>
              <li>
                <Link
                  to="/logo-to-svg-converter"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Logo to SVG
                </Link>
              </li>
              <li>
                <Link
                  to="/scan-to-svg-converter"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Scan to SVG
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

/* ========================
   SEO section (kept short)
======================== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-12 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              emoji to svg converter
            </p>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">
              Convert emoji to SVG from text or images
            </h2>
            <p className="text-slate-600 max-w-[90ch]">
              Paste emoji text to get clean SVG from Twemoji, or upload an emoji
              image to trace it into paths. Group multiple emojis into one SVG,
              center them, or repeat to fill a canvas.
            </p>
          </header>
        </article>
      </div>
    </section>
  );
}
