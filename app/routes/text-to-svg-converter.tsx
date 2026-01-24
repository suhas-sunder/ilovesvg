import * as React from "react";
import type { Route } from "./+types/text-to-svg-converter";
import {
  json,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { Link, useFetcher, type ActionFunctionArgs } from "react-router";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";



const isServer = typeof document === "undefined";


export function meta({}: Route.MetaArgs) {
  const title =
    "Text to SVG Converter (Paths) - Upload any font, export SVG outlines";
  const description =
    "Convert text to true SVG outline paths (vector). Upload your own font file (TTF/OTF/WOFF) to generate clean SVG paths. Control size, line height, spacing, alignment, padding, canvas sizing, repeat-fill, stroke, and background. Export one SVG or separate SVGs by line, word, or character.";
  const urlPath = "/text-to-svg-converter";

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

    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.VALUE_FROM_EXPRESS };
}

/* ========================
   Limits
======================== */
const MAX_TEXT_CHARS = 5000;
const MAX_ITEMS = 200;
const MAX_FONT_BYTES = 16 * 1024 * 1024; // 16MB

/* ========================
   Builtin fonts (TTF)
======================== */
type BuiltinFontId =
  | "roboto"
  | "noto_sans"
  | "montserrat"
  | "oswald"
  | "lato"
  | "poppins";

const BUILTIN_FONTS: Array<{
  id: BuiltinFontId;
  label: string;
  ttfUrl: string;
}> = [
  {
    id: "roboto",
    label: "Roboto (regular)",
    ttfUrl:
      "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf",
  },
  {
    id: "noto_sans",
    label: "Noto Sans (regular)",
    ttfUrl:
      "https://fonts.gstatic.com/s/notosans/v36/o-0IIpQlx3QUlC5A4PNr5TRA.ttf",
  },
  {
    id: "montserrat",
    label: "Montserrat (regular)",
    ttfUrl:
      "https://fonts.gstatic.com/s/montserrat/v26/JTUSjIg1_i6t8kCHKm459WRhyyTh89Y.ttf",
  },
  {
    id: "oswald",
    label: "Oswald (regular)",
    ttfUrl: "https://fonts.gstatic.com/s/oswald/v53/TK3iWkUHHAIjg752GT8G.ttf",
  },
  {
    id: "lato",
    label: "Lato (regular)",
    ttfUrl: "https://fonts.gstatic.com/s/lato/v24/S6uyw4BMUTPHjx4wWw.ttf",
  },
  {
    id: "poppins",
    label: "Poppins (regular)",
    ttfUrl:
      "https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrJJfedw.ttf",
  },
];

/* ========================
   Types
======================== */
type RenderMode = "outline";
type OutputMode = "grouped" | "individual";
type SplitMode = "line" | "word" | "char";

type Align = "left" | "center" | "right";
type CanvasMode = "auto" | "fixed";
type FitMode = "center" | "repeat";
type BgMode = "transparent" | "solid";

type FontSource = "builtin" | "upload";
type WrapMode = "none" | "wrap";

type ResultItem = { text: string; svg: string };

type ActionResult = {
  error?: string;
  warnings?: string[];
  groupedSvg?: string;
  items?: ResultItem[];
  meta?: {
    renderMode: RenderMode;
    outputMode: OutputMode;
    splitMode: SplitMode;
    count: number;
  };
};

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

    const uploadHandler = createMemoryUploadHandler({
      maxPartSize: Math.max(MAX_FONT_BYTES, 2 * 1024 * 1024),
    });
    const form = await parseMultipartFormData(request, uploadHandler);

    const textRaw = String(form.get("text") ?? "");
    if (!textRaw.trim())
      return json<ActionResult>(
        { error: "Enter some text first." },
        { status: 400 },
      );
    if (textRaw.length > MAX_TEXT_CHARS) {
      return json<ActionResult>(
        { error: `Text too long. Max ${MAX_TEXT_CHARS} characters.` },
        { status: 413 },
      );
    }

    const renderMode: RenderMode = "outline";
    const outputMode = String(
      form.get("outputMode") ?? "grouped",
    ) as OutputMode;
    const splitMode = String(form.get("splitMode") ?? "line") as SplitMode;

    const fontSource = String(
      form.get("fontSource") ?? "builtin",
    ) as FontSource;
    const builtinFont = String(
      form.get("builtinFont") ?? "roboto",
    ) as BuiltinFontId;

    const fontFile = form.get("fontFile");
    const uploadedFont =
      fontFile && typeof fontFile !== "string" ? (fontFile as File) : null;

    const fontSize = clampNum(form.get("fontSize"), 8, 512, 96);
    const lineHeight = clampNum(form.get("lineHeight"), 0.8, 3.0, 1.2);
    const letterSpacing = clampNum(form.get("letterSpacing"), -50, 200, 0);
    const wordSpacing = clampNum(form.get("wordSpacing"), -50, 200, 0);

    const align = String(form.get("align") ?? "center") as Align;
    const fill = String(form.get("fill") ?? "#000000");
    const stroke = String(form.get("stroke") ?? "none");
    const strokeWidth = clampNum(form.get("strokeWidth"), 0, 50, 0);

    const pad = clampNum(form.get("pad"), 0, 500, 24);

    const canvasMode = String(form.get("canvasMode") ?? "auto") as CanvasMode;
    const canvasW = clampNum(form.get("canvasW"), 64, 20000, 1024);
    const canvasH = clampNum(form.get("canvasH"), 64, 20000, 1024);

    const fit = String(form.get("fit") ?? "center") as FitMode;
    const repeatPad = clampNum(form.get("repeatPad"), 0, 500, 40);

    const bg = String(form.get("bg") ?? "transparent") as BgMode;
    const bgColor = String(form.get("bgColor") ?? "#ffffff");

    const wrapMode = String(form.get("wrapMode") ?? "none") as WrapMode;
    const wrapWidth = clampNum(form.get("wrapWidth"), 64, 20000, 720);

    const warnings: string[] = [];

    let normalized = textRaw.replace(/\r\n/g, "\n");
    if (wrapMode === "wrap") {
      normalized = greedyWrap(
        normalized,
        wrapWidth,
        fontSize,
        letterSpacing,
        wordSpacing,
        warnings,
      );
    }

    const allItems =
      outputMode === "individual"
        ? splitTextIntoItems(normalized, splitMode)
        : [normalized];
    const itemsText =
      outputMode === "individual" ? allItems.slice(0, MAX_ITEMS) : [normalized];
    if (outputMode === "individual" && allItems.length > MAX_ITEMS) {
      warnings.push(`Too many items. Only first ${MAX_ITEMS} exported.`);
    }

    const outlineFont = await loadOutlineFont(
      fontSource,
      builtinFont,
      uploadedFont,
    );
    if (!outlineFont)
      return json<ActionResult>(
        { error: "Could not load the selected font." },
        { status: 422 },
      );

    const outItems: ResultItem[] = [];
    for (const t of itemsText) {
      const svg = buildOutlinedSvgFromText(t, outlineFont, {
        fontSize,
        lineHeight,
        letterSpacing,
        wordSpacing,
        align,
        fill,
        stroke,
        strokeWidth,
        pad,
        canvasMode,
        canvasW,
        canvasH,
        fit,
        repeatPad,
        bg,
        bgColor,
      });
      outItems.push({ text: t, svg });
    }

    return json<ActionResult>({
      groupedSvg: outputMode === "grouped" ? outItems[0]?.svg : undefined,
      items: outputMode === "individual" ? outItems : undefined,
      warnings: warnings.length ? warnings : undefined,
      meta: {
        renderMode,
        outputMode,
        splitMode,
        count: outputMode === "individual" ? outItems.length : 1,
      },
    });
  } catch (err: any) {
    return json<ActionResult>(
      { error: err?.message || "Server error during conversion." },
      { status: 500 },
    );
  }
}

/* ========================
   Server helpers
======================== */
function clampNum(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function splitTextIntoItems(text: string, mode: SplitMode): string[] {
  const lines = text.split("\n");
  if (mode === "line") return lines.filter((l) => l.length > 0);

  if (mode === "word") {
    const out: string[] = [];
    for (const line of lines) {
      const words = line.split(/\s+/).filter(Boolean);
      for (const w of words) out.push(w);
    }
    return out;
  }

  const out: string[] = [];
  try {
    // @ts-ignore
    if (typeof Intl !== "undefined" && (Intl as any).Segmenter) {
      // @ts-ignore
      const seg = new (Intl as any).Segmenter(undefined, {
        granularity: "grapheme",
      });
      for (const line of lines) {
        for (const p of seg.segment(line)) {
          const s = String((p as any).segment || "");
          if (s.trim().length) out.push(s);
        }
      }
      return out;
    }
  } catch {}
  for (const line of lines) {
    for (const ch of Array.from(line)) {
      if (ch.trim().length) out.push(ch);
    }
  }
  return out;
}

function greedyWrap(
  text: string,
  wrapWidth: number,
  fontSize: number,
  letterSpacing: number,
  wordSpacing: number,
  warnings: string[],
): string {
  const approxCharW = fontSize * 0.56;
  const maxW = Math.max(64, wrapWidth);
  const lines = text.split("\n");
  const outLines: string[] = [];

  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      outLines.push("");
      continue;
    }

    let cur = "";
    let curW = 0;

    const wordW = (w: string) =>
      w.length * approxCharW + Math.max(0, w.length - 1) * letterSpacing;

    for (const w of words) {
      const wW = wordW(w);
      const spaceW = approxCharW * 0.45 + wordSpacing;

      if (!cur) {
        cur = w;
        curW = wW;
        continue;
      }

      if (curW + spaceW + wW <= maxW) {
        cur += " " + w;
        curW += spaceW + wW;
      } else {
        outLines.push(cur);
        cur = w;
        curW = wW;
      }
    }

    outLines.push(cur);
  }

  const out = outLines.join("\n");
  if (out.length > MAX_TEXT_CHARS) {
    warnings.push(
      "Wrapping increased output length. Some content may be truncated.",
    );
    return out.slice(0, MAX_TEXT_CHARS);
  }
  return out;
}

/* ========================
   Robust fetch
======================== */
async function fetchWithTimeout(url: string, ms: number, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        ...(init?.headers || {}),
        accept: "application/octet-stream,*/*;q=0.1",
      },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function fetchRetry(
  url: string,
  tries: number,
  ms: number,
  init?: RequestInit,
) {
  let lastErr: any = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetchWithTimeout(url, ms, init);
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Network error");
}

/* ========================
   Font loading (outline)
======================== */
type FontCache = {
  bin: Map<string, Uint8Array>;
  order: string[];
  max: number;
};
function getFontCache(): FontCache {
  const g = globalThis as any;
  if (g.__textsvg_font_cache) return g.__textsvg_font_cache as FontCache;
  g.__textsvg_font_cache = { bin: new Map(), order: [], max: 64 } as FontCache;
  return g.__textsvg_font_cache as FontCache;
}

async function getOpenType() {
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  const ot = req("opentype.js");
  return ot && ot.default ? ot.default : ot;
}

function extLower(name: string) {
  const p = name.split(".").pop() || "";
  return p.toLowerCase();
}

function failUnsupportedUpload(file: File) {
  const ext = extLower(file.name);
  // opentype.js supports ttf/otf and woff (not woff2).
  if (ext === "woff2") {
    throw new Error(
      "WOFF2 is not supported for outline conversion. Upload TTF, OTF, or WOFF.",
    );
  }
  if (ext === "eot" || ext === "svg") {
    throw new Error(
      "EOT/SVG fonts are not supported. Upload TTF, OTF, or WOFF.",
    );
  }
}

async function loadOutlineFont(
  source: FontSource,
  builtinId: BuiltinFontId,
  uploaded: File | null,
) {
  const opentype = await getOpenType();

  if (source === "upload") {
    if (!uploaded) throw new Error("Upload a font file first.");
    if (uploaded.size > MAX_FONT_BYTES) throw new Error("Font file too large.");

    failUnsupportedUpload(uploaded);

    const ab = await uploaded.arrayBuffer();
    const u8 = new Uint8Array(ab);
    try {
      return opentype.parse(u8.buffer);
    } catch {
      throw new Error(
        "Could not parse that font. Use a valid TTF, OTF, or WOFF.",
      );
    }
  }

  const fontRow =
    BUILTIN_FONTS.find((x) => x.id === builtinId) || BUILTIN_FONTS[0];
  const url = fontRow.ttfUrl;

  const cache = getFontCache();
  let bin = cache.bin.get(url) || null;

  if (!bin) {
    const res = await fetchRetry(url, 3, 6500);
    if (!res.ok) {
      if (builtinId !== "roboto")
        return await loadOutlineFont("builtin", "roboto", null);
      throw new Error("Failed to fetch builtin font.");
    }
    const ab = await res.arrayBuffer();
    bin = new Uint8Array(ab);

    cache.bin.set(url, bin);
    cache.order.push(url);
    if (cache.order.length > cache.max) {
      const old = cache.order.shift();
      if (old) cache.bin.delete(old);
    }
  }

  try {
    return opentype.parse(bin.buffer);
  } catch {
    if (builtinId !== "roboto")
      return await loadOutlineFont("builtin", "roboto", null);
    throw new Error("Could not parse the builtin font.");
  }
}

/* ========================
   Outline SVG building (no cut off)
======================== */
type OutlineOpts = {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  align: Align;
  fill: string;
  stroke: string;
  strokeWidth: number;
  pad: number;
  canvasMode: CanvasMode;
  canvasW: number;
  canvasH: number;
  fit: FitMode;
  repeatPad: number;
  bg: BgMode;
  bgColor: string;
};

function buildOutlinedSvgFromText(
  text: string,
  font: any,
  opts: OutlineOpts,
): string {
  const lines = text.split("\n");
  const fontSize = opts.fontSize;

  const lineObjs = lines.map((line) => {
    const path = buildPathWithSpacingPx(
      font,
      line,
      0,
      0,
      fontSize,
      opts.letterSpacing,
      opts.wordSpacing,
    );
    const d = path.toPathData(4);
    const bb = safeBBox(path);
    const w = Math.max(0, bb.x2 - bb.x1);
    const h = Math.max(0, bb.y2 - bb.y1);
    return { d, bb, w, h, line };
  });

  const hasAny = lineObjs.some((x) => (x.line || "").trim().length > 0);
  if (!hasAny)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet"></svg>`;

  const maxLineW = lineObjs.reduce((m, x) => Math.max(m, x.w), 0);
  const lineAdvance = fontSize * opts.lineHeight;

  let uX1 = Number.POSITIVE_INFINITY;
  let uY1 = Number.POSITIVE_INFINITY;
  let uX2 = Number.NEGATIVE_INFINITY;
  let uY2 = Number.NEGATIVE_INFINITY;

  const placements: Array<{
    d: string;
    tx: number;
    ty: number;
    bb: { x1: number; y1: number; x2: number; y2: number };
  }> = [];

  for (let i = 0; i < lineObjs.length; i++) {
    const lo = lineObjs[i];
    const baseY = i * lineAdvance;

    const alignX =
      opts.align === "left"
        ? 0
        : opts.align === "right"
          ? Math.max(0, maxLineW - lo.w)
          : Math.max(0, (maxLineW - lo.w) / 2);

    const tx = alignX - lo.bb.x1;
    const ty = baseY;

    const x1 = lo.bb.x1 + tx;
    const x2 = lo.bb.x2 + tx;
    const y1 = lo.bb.y1 + ty;
    const y2 = lo.bb.y2 + ty;

    uX1 = Math.min(uX1, x1);
    uX2 = Math.max(uX2, x2);
    uY1 = Math.min(uY1, y1);
    uY2 = Math.max(uY2, y2);

    placements.push({ d: lo.d, tx, ty, bb: lo.bb });
  }

  if (!Number.isFinite(uX1) || !Number.isFinite(uY1)) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet"></svg>`;
  }

  // Expand bounds for stroke so it never clips.
  const strokePad =
    opts.stroke !== "none" && opts.strokeWidth > 0
      ? opts.strokeWidth * 0.75
      : 0;

  const contentW = Math.max(1, uX2 - uX1 + strokePad * 2);
  const contentH = Math.max(1, uY2 - uY1 + strokePad * 2);

  const normX = -uX1 + strokePad;
  const normY = -uY1 + strokePad;

  const symbolPaths = placements
    .map(
      (p) =>
        `<path d="${escapeAttr(p.d)}" transform="translate(${p.tx + normX} ${p.ty + normY})" />`,
    )
    .join("");

  const paint =
    ` fill="${escapeAttr(opts.fill)}"` +
    (opts.stroke !== "none" && opts.strokeWidth > 0
      ? ` stroke="${escapeAttr(opts.stroke)}" stroke-width="${opts.strokeWidth}" stroke-linejoin="round" stroke-linecap="round"`
      : "");

  const defs = `<defs><symbol id="t" viewBox="0 0 ${contentW} ${contentH}"><g${paint}>${symbolPaths}</g></symbol></defs>`;

  let canvasW =
    opts.canvasMode === "fixed" ? opts.canvasW : contentW + 2 * opts.pad;
  let canvasH =
    opts.canvasMode === "fixed" ? opts.canvasH : contentH + 2 * opts.pad;
  canvasW = Math.max(1, Math.floor(canvasW));
  canvasH = Math.max(1, Math.floor(canvasH));

  const bgRect =
    opts.bg === "solid"
      ? `<rect x="0" y="0" width="${canvasW}" height="${canvasH}" fill="${escapeAttr(opts.bgColor)}"/>`
      : "";

  const placeAutoTight = () =>
    `<use href="#t" x="${opts.pad}" y="${opts.pad}" width="${contentW}" height="${contentH}"/>`;

  const placeCenterFixed = () => {
    const x = Math.max(0, Math.floor((canvasW - contentW) / 2));
    const y = Math.max(0, Math.floor((canvasH - contentH) / 2));
    return `<use href="#t" x="${x}" y="${y}" width="${contentW}" height="${contentH}"/>`;
  };

  const placeRepeatFixed = () => {
    const stepX = contentW + opts.repeatPad;
    const stepY = contentH + opts.repeatPad;
    const cols = Math.max(1, Math.floor((canvasW + opts.repeatPad) / stepX));
    const rows = Math.max(1, Math.floor((canvasH + opts.repeatPad) / stepY));
    let out = "";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out += `<use href="#t" x="${c * stepX}" y="${r * stepY}" width="${contentW}" height="${contentH}"/>`;
      }
    }
    return out;
  };

  const uses =
    opts.canvasMode === "auto"
      ? placeAutoTight()
      : opts.fit === "repeat"
        ? placeRepeatFixed()
        : placeCenterFixed();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}" preserveAspectRatio="xMidYMid meet">${bgRect}${defs}${uses}</svg>`;
}

function safeBBox(path: any): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} {
  try {
    const bb = path.getBoundingBox();
    const x1 = Number(bb.x1);
    const y1 = Number(bb.y1);
    const x2 = Number(bb.x2);
    const y2 = Number(bb.y2);
    if ([x1, y1, x2, y2].every((v) => Number.isFinite(v)))
      return { x1, y1, x2, y2 };
  } catch {}
  return { x1: 0, y1: 0, x2: 1, y2: 1 };
}

function buildPathWithSpacingPx(
  font: any,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  letterSpacingPx: number,
  wordSpacingPx: number,
) {
  const out = font.getPath("", 0, 0, fontSize, { kerning: true });
  out.commands.length = 0;
  if (!text) return out;

  const glyphs = font.stringToGlyphs(text);
  let xCursor = x;

  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    const ch = text[i] || "";

    if (i > 0) {
      try {
        const prev = glyphs[i - 1];
        const kern = font.getKerningValue(prev, g) || 0;
        xCursor += (kern * fontSize) / (font.unitsPerEm || 1000);
      } catch {}
    }

    const gp = g.getPath(xCursor, y, fontSize);
    out.commands.push(...gp.commands);

    const adv = Number(g.advanceWidth || 0);
    const advPx = (adv * fontSize) / (font.unitsPerEm || 1000);
    xCursor += advPx;

    xCursor += letterSpacingPx;
    if (ch === " ") xCursor += wordSpacingPx;
  }

  return out;
}

function escapeAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ========================
   Component
======================== */
const DEFAULTS = {
  text: "Hello SVG\nSecond line",
  outputMode: "grouped" as OutputMode,
  splitMode: "line" as SplitMode,

  fontSource: "builtin" as FontSource,
  builtinFont: "roboto" as BuiltinFontId,

  fontSize: 96,
  lineHeight: 1.2,
  letterSpacing: 0,
  wordSpacing: 0,

  align: "center" as Align,
  fill: "#000000",
  stroke: "none",
  strokeWidth: 0,

  pad: 24,

  canvasMode: "auto" as CanvasMode,
  canvasW: 1024,
  canvasH: 1024,

  fit: "center" as FitMode,
  repeatPad: 40,

  bg: "transparent" as BgMode,
  bgColor: "#ffffff",

  wrapMode: "none" as WrapMode,
  wrapWidth: 720,
};

export default function TextToSvgConverter(_: Route.ComponentProps) {
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";

  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [text, setText] = React.useState(DEFAULTS.text);

  const [outputMode, setOutputMode] = React.useState<OutputMode>(
    DEFAULTS.outputMode,
  );
  const [splitMode, setSplitMode] = React.useState<SplitMode>(
    DEFAULTS.splitMode,
  );

  const [fontSource, setFontSource] = React.useState<FontSource>(
    DEFAULTS.fontSource,
  );
  const [builtinFont, setBuiltinFont] = React.useState<BuiltinFontId>(
    DEFAULTS.builtinFont,
  );

  const [fontFile, setFontFile] = React.useState<File | null>(null);

  const [fontSize, setFontSize] = React.useState(DEFAULTS.fontSize);
  const [lineHeight, setLineHeight] = React.useState(DEFAULTS.lineHeight);
  const [letterSpacing, setLetterSpacing] = React.useState(
    DEFAULTS.letterSpacing,
  );
  const [wordSpacing, setWordSpacing] = React.useState(DEFAULTS.wordSpacing);

  const [align, setAlign] = React.useState<Align>(DEFAULTS.align);
  const [fill, setFill] = React.useState(DEFAULTS.fill);
  const [stroke, setStroke] = React.useState(DEFAULTS.stroke);
  const [strokeWidth, setStrokeWidth] = React.useState(DEFAULTS.strokeWidth);

  const [pad, setPad] = React.useState(DEFAULTS.pad);

  const [canvasMode, setCanvasMode] = React.useState<CanvasMode>(
    DEFAULTS.canvasMode,
  );
  const [canvasW, setCanvasW] = React.useState(DEFAULTS.canvasW);
  const [canvasH, setCanvasH] = React.useState(DEFAULTS.canvasH);

  const [fit, setFit] = React.useState<FitMode>(DEFAULTS.fit);
  const [repeatPad, setRepeatPad] = React.useState(DEFAULTS.repeatPad);

  const [bg, setBg] = React.useState<BgMode>(DEFAULTS.bg);
  const [bgColor, setBgColor] = React.useState(DEFAULTS.bgColor);

  const [wrapMode, setWrapMode] = React.useState<WrapMode>(DEFAULTS.wrapMode);
  const [wrapWidth, setWrapWidth] = React.useState(DEFAULTS.wrapWidth);

  const [err, setErr] = React.useState<string | null>(null);
  const [warns, setWarns] = React.useState<string[]>([]);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!fetcher.data) return;
    setErr(fetcher.data.error || null);
    setWarns(Array.isArray(fetcher.data.warnings) ? fetcher.data.warnings : []);
  }, [fetcher.data]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1200);
  }

  function copyText(s: string) {
    navigator.clipboard.writeText(s).then(() => showToast("Copied"));
  }

  function submitConvert() {
    if (!text.trim()) {
      setErr("Enter some text first.");
      return;
    }
    setErr(null);

    const fd = new FormData();
    fd.append("text", text);

    fd.append("outputMode", outputMode);
    fd.append("splitMode", splitMode);

    fd.append("fontSource", fontSource);
    fd.append("builtinFont", builtinFont);

    if (fontSource === "upload") {
      if (!fontFile) {
        setErr("Upload a font file first.");
        return;
      }
      fd.append("fontFile", fontFile);
    }

    fd.append("fontSize", String(fontSize));
    fd.append("lineHeight", String(lineHeight));
    fd.append("letterSpacing", String(letterSpacing));
    fd.append("wordSpacing", String(wordSpacing));

    fd.append("align", align);
    fd.append("fill", fill);
    fd.append("stroke", stroke);
    fd.append("strokeWidth", String(strokeWidth));

    fd.append("pad", String(pad));

    fd.append("canvasMode", canvasMode);
    fd.append("canvasW", String(canvasW));
    fd.append("canvasH", String(canvasH));

    fd.append("fit", fit);
    fd.append("repeatPad", String(repeatPad));

    fd.append("bg", bg);
    fd.append("bgColor", bgColor);

    fd.append("wrapMode", wrapMode);
    fd.append("wrapWidth", String(wrapWidth));

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action: `${window.location.pathname}?index`,
    });
  }

  const buttonDisabled = isServer || !hydrated || busy;
  const groupedSvg = fetcher.data?.groupedSvg || null;
  const items = fetcher.data?.items || [];

  const showUpload = fontSource === "upload";

  return (
    <>

      <main className="min-h-[100dvh] bg-slate-50 text-slate-900">
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-12">
          <header className="text-center mb-3">
            <h1 className="text-[34px] font-extrabold leading-none m-0">
              Text to SVG Converter
            </h1>
            <p className="mt-2 text-slate-600 max-w-[92ch] mx-auto">
              Exports true SVG outline paths using your selected font file.
              Upload TTF, OTF, or WOFF for best results.
            </p>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden min-w-0">
              <h2 className="m-0 mb-3 text-lg text-slate-900">Input</h2>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
                placeholder="Type text here"
              />

              <div className="mt-3 grid gap-2">
                <Field label="Output">
                  <select
                    value={outputMode}
                    onChange={(e) => setOutputMode(e.target.value as any)}
                    className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                  >
                    <option value="grouped">All together (one SVG)</option>
                    <option value="individual">Individual SVGs</option>
                  </select>
                </Field>

                {outputMode === "individual" && (
                  <Field label="Split by">
                    <select
                      value={splitMode}
                      onChange={(e) => setSplitMode(e.target.value as any)}
                      className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    >
                      <option value="line">Line</option>
                      <option value="word">Word</option>
                      <option value="char">Character</option>
                    </select>
                  </Field>
                )}

                <Field label="Font source">
                  <select
                    value={fontSource}
                    onChange={(e) => {
                      setFontSource(e.target.value as any);
                      setErr(null);
                    }}
                    className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                  >
                    <option value="builtin">Builtin fonts</option>
                    <option value="upload">Upload font file</option>
                  </select>
                </Field>

                {fontSource === "builtin" && (
                  <Field label="Builtin font">
                    <select
                      value={builtinFont}
                      onChange={(e) => setBuiltinFont(e.target.value as any)}
                      className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    >
                      {BUILTIN_FONTS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                {showUpload && (
                  <div className="grid gap-2">
                    <Field label="Upload font">
                      <input
                        type="file"
                        // Accept a lot, but we only convert TTF/OTF/WOFF. WOFF2/EOT/SVG will show a server error.
                        accept=".ttf,.otf,.woff,.woff2,.eot,.svg,font/*,application/octet-stream"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setFontFile(f);
                          setErr(null);
                        }}
                        className="w-full text-sm"
                      />
                    </Field>
                    <div className="text-[12px] text-slate-600 px-3">
                      Supported for conversion: <b>TTF</b>, <b>OTF</b>,{" "}
                      <b>WOFF</b>. WOFF2 is not supported for path conversion.
                    </div>
                  </div>
                )}

                <Field label="Wrap">
                  <select
                    value={wrapMode}
                    onChange={(e) => setWrapMode(e.target.value as any)}
                    className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                  >
                    <option value="none">No wrap</option>
                    <option value="wrap">Wrap to width</option>
                  </select>
                  {wrapMode === "wrap" && (
                    <>
                      <span className="text-[13px] text-slate-700">Width</span>
                      <Num
                        value={wrapWidth}
                        min={64}
                        max={20000}
                        step={1}
                        onChange={setWrapWidth}
                      />
                    </>
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Font size">
                    <Num
                      value={fontSize}
                      min={8}
                      max={512}
                      step={1}
                      onChange={setFontSize}
                    />
                  </Field>
                  <Field label="Line height">
                    <Num
                      value={lineHeight}
                      min={0.8}
                      max={3}
                      step={0.05}
                      onChange={setLineHeight}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Letter spacing">
                    <Num
                      value={letterSpacing}
                      min={-50}
                      max={200}
                      step={1}
                      onChange={setLetterSpacing}
                    />
                  </Field>
                  <Field label="Word spacing">
                    <Num
                      value={wordSpacing}
                      min={-50}
                      max={200}
                      step={1}
                      onChange={setWordSpacing}
                    />
                  </Field>
                </div>

                <Field label="Align">
                  <select
                    value={align}
                    onChange={(e) => setAlign(e.target.value as any)}
                    className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </Field>

                <Field label="Fill">
                  <input
                    type="color"
                    value={fill}
                    onChange={(e) => setFill(e.target.value)}
                    className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white"
                  />
                </Field>

                <Field label="Stroke">
                  <select
                    value={stroke}
                    onChange={(e) => setStroke(e.target.value)}
                    className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                  >
                    <option value="none">None</option>
                    <option value="#000000">Black</option>
                    <option value="#ffffff">White</option>
                  </select>
                  <span className="text-[13px] text-slate-700">Width</span>
                  <Num
                    value={strokeWidth}
                    min={0}
                    max={50}
                    step={0.5}
                    onChange={setStrokeWidth}
                  />
                </Field>

                <Field label="Padding">
                  <Num
                    value={pad}
                    min={0}
                    max={500}
                    step={1}
                    onChange={setPad}
                  />
                </Field>

                <Field label="Canvas">
                  <select
                    value={canvasMode}
                    onChange={(e) => setCanvasMode(e.target.value as any)}
                    className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                  >
                    <option value="auto">Auto (tight)</option>
                    <option value="fixed">Fixed size</option>
                  </select>
                </Field>

                {canvasMode === "fixed" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Width">
                      <Num
                        value={canvasW}
                        min={64}
                        max={20000}
                        step={1}
                        onChange={setCanvasW}
                      />
                    </Field>
                    <Field label="Height">
                      <Num
                        value={canvasH}
                        min={64}
                        max={20000}
                        step={1}
                        onChange={setCanvasH}
                      />
                    </Field>
                  </div>
                )}

                <Field label="Fit">
                  <select
                    value={fit}
                    onChange={(e) => setFit(e.target.value as any)}
                    className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                  >
                    <option value="center">Center</option>
                    <option value="repeat">Repeat to fill</option>
                  </select>
                  <span className="text-[13px] text-slate-700">Repeat gap</span>
                  <Num
                    value={repeatPad}
                    min={0}
                    max={500}
                    step={1}
                    onChange={setRepeatPad}
                  />
                </Field>

                <Field label="Background">
                  <select
                    value={bg}
                    onChange={(e) => setBg(e.target.value as any)}
                    className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                  >
                    <option value="transparent">Transparent</option>
                    <option value="solid">Solid</option>
                  </select>
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    aria-disabled={bg !== "solid"}
                    className={[
                      "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white",
                      bg !== "solid" ? "opacity-50 pointer-events-none" : "",
                    ].join(" ")}
                  />
                </Field>
              </div>

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={submitConvert}
                  disabled={buttonDisabled}
                  suppressHydrationWarning
                  className={[
                    "px-3.5 py-2 rounded-lg font-bold border transition-colors",
                    "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0]",
                    "disabled:opacity-70 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  {busy ? "Converting…" : "Convert text to SVG"}
                </button>

                <span className="text-[13px] text-slate-600">
                  Limits: {MAX_TEXT_CHARS} chars, {MAX_ITEMS} items max in
                  individual mode.
                </span>

                {err && <span className="text-red-700 text-sm">{err}</span>}
              </div>

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

            {/* RESULTS */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-xl p-4 h-full max-h-[124.25em] overflow-auto shadow-sm min-w-0">
              <h2 className="m-0 mb-3 text-lg text-slate-900 flex items-center gap-2">
                Result
                {busy && (
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
                )}
              </h2>

              {outputMode === "grouped" ? (
                groupedSvg ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-2">
                    <div className="rounded-xl border border-slate-200 bg-white min-h-[240px] flex items-center justify-center p-2">
                      <img
                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(groupedSvg)}`}
                        alt="SVG result"
                        className="w-full h-[340px] max-h-[60vh]"
                        style={{ objectFit: "contain" }}
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
                          a.download = "text.svg";
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
                  </div>
                ) : (
                  <p className="text-slate-600 m-0">
                    {busy ? "Converting…" : "Your SVG will appear here."}
                  </p>
                )
              ) : items.length > 0 ? (
                <div className="grid gap-3">
                  {items.map((it, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-white p-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div
                          className="text-sm font-semibold text-slate-900 truncate"
                          title={it.text}
                        >
                          {it.text.length > 42
                            ? it.text.slice(0, 42) + "…"
                            : it.text}
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
                              a.download = `text-${idx + 1}.svg`;
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
                          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(it.svg)}`}
                          alt="SVG"
                          className="w-full h-[220px]"
                          style={{ objectFit: "contain" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600 m-0">
                  {busy ? "Converting…" : "Your SVGs will appear here."}
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

      <SeoSections />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ========================
   UI helpers
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
                  to="/text-to-svg-converter"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Text to SVG
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

function SeoSections() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "i🩵SVG",
        url: "/",
      },
      {
        "@type": "WebPage",
        name: "Text to SVG Converter (Outline Paths)",
        url: "/text-to-svg-converter",
        description:
          "Convert text into true SVG outline paths (vector). Upload a font (TTF/OTF/WOFF) or use builtin fonts. Adjust size, line height, spacing, alignment, padding, canvas sizing, repeat-fill, stroke, and background.",
      },
      {
        "@type": "SoftwareApplication",
        name: "Text to SVG Converter",
        applicationCategory: "DesignApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description:
          "Convert text into true SVG outline paths (vector). Upload a font file (TTF/OTF/WOFF) or use a builtin font. Control alignment, spacing, wrapping, canvas sizing, repeat-fill, stroke, and background.",
        url: "/text-to-svg-converter",
        featureList: [
          "True SVG outline paths (no external font dependency)",
          "Upload fonts: TTF, OTF, WOFF",
          "Builtin fonts included",
          "Split export: per line, per word, per character",
          "Letter spacing, word spacing, line height",
          "Auto-tight or fixed canvas",
          "Center or repeat-to-fill layout",
          "Optional stroke and background",
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What does this tool output: text or paths?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "This page outputs SVG PATH outlines. The exported SVG does not rely on the font being installed on the viewer’s device.",
            },
          },
          {
            "@type": "Question",
            name: "Which font file types are supported for conversion?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "For outline conversion, upload TTF, OTF, or WOFF. WOFF2, EOT, and SVG fonts are not supported for path conversion.",
            },
          },
          {
            "@type": "Question",
            name: "Why is WOFF2 not supported?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "The outline conversion uses opentype.js, which can parse TTF/OTF/WOFF but does not parse WOFF2 into outlines.",
            },
          },
          {
            "@type": "Question",
            name: "How do I avoid cut-off descenders like g, y, p?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "The converter computes a tight bounding box from glyph outlines and expands it to include padding and stroke width. If you still see clipping in a specific app, increase Padding or disable Stroke.",
            },
          },
          {
            "@type": "Question",
            name: "Can I export separate SVGs per line, word, or character?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. Switch Output to Individual SVGs and choose Split by: Line, Word, or Character.",
            },
          },
          {
            "@type": "Question",
            name: "What settings are best for Cricut, Glowforge, or laser cutters?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Use a TTF or OTF font, keep Stroke set to None for clean cut paths, and export the SVG. If your cutter software adds an outline, it will do so from the filled paths.",
            },
          },
        ],
      },
    ],
  };

  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-12 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              text to svg converter
            </p>

            <h2 className="text-2xl md:text-3xl font-bold leading-tight">
              Upload fonts and export true SVG outline paths
            </h2>

            <p className="text-slate-600 max-w-[92ch] mt-2">
              This tool converts text into real vector outlines (SVG{" "}
              <code>&lt;path&gt;</code>), so the result does not depend on fonts
              being installed. Upload a font file (TTF, OTF, or WOFF) or use
              builtin fonts, then export one SVG or split exports by line, word,
              or character.
            </p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Supported uploads
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  <b>TTF</b>, <b>OTF</b>, <b>WOFF</b>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Best results: use TTF/OTF for maximum compatibility with
                  design and cutter software.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Not supported for outlines
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  <b>WOFF2</b>, <b>EOT</b>, <b>SVG fonts</b>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  If your font is WOFF2, download a TTF/OTF version from the
                  font provider, then upload it here.
                </div>
              </div>
            </div>
          </header>

          {/* Visible FAQ (what you were missing) */}
          <section className="mt-8">
            <h3 className="text-xl font-bold text-slate-900">FAQ</h3>
            <div className="mt-3 grid gap-3">
              <FaqItem
                q="What does this tool output: text or paths?"
                a="Paths. The export is made of SVG <path> outlines, so it does not depend on installed fonts."
              />
              <FaqItem
                q="Which font file types are supported for conversion?"
                a="TTF, OTF, and WOFF are supported for outline conversion. WOFF2, EOT, and SVG fonts are not supported."
              />
              <FaqItem
                q="Why is WOFF2 not supported?"
                a="The converter uses opentype.js for parsing and outlining. It parses TTF/OTF/WOFF, but not WOFF2."
              />
              <FaqItem
                q="How do I avoid cut-off descenders like g, y, p?"
                a="Increase Padding or disable Stroke. The converter already expands bounds to include stroke width, but some viewers clip aggressively."
              />
              <FaqItem
                q="Can I export separate SVGs per line, word, or character?"
                a="Yes. Set Output to Individual SVGs and select Split by: Line, Word, or Character."
              />
              <FaqItem
                q="What settings are best for Cricut or laser cutters?"
                a="Use a TTF/OTF font, keep Stroke set to None, and export the SVG. Cutter apps handle fills as cut paths."
              />
            </div>
          </section>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </article>
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-start justify-between gap-3">
        <span>{q}</span>
        <span className="text-slate-400 group-open:rotate-180 transition-transform select-none">
          ▾
        </span>
      </summary>
      <p className="mt-2 text-sm text-slate-700 leading-relaxed">{a}</p>
    </details>
  );
}
