import * as React from "react";
import type { Route } from "./+types/home";
import {
  json,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { useFetcher, type ActionFunctionArgs } from "react-router";

/** Stable server flag: true on SSR render, false in client bundle */
const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "i🩵SVG  -  Potrace (server, in-memory, live preview)";
  const description =
    "A free, all in one SVG editor, processor, and converter. Convert PNG/JEPG images to SVG, SVG to PNG or JPEG images. Batch processing supported.";
  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.VALUE_FROM_EXPRESS };
}

/* ========================
   Limits & types (mirrored client/server)
======================== */
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_MP = 80; // ~80 megapixels
const MAX_SIDE = 12_000; // max width or height in pixels
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

// -------- Live preview tiers (client) --------
// ≤5MB: fast,  5–10MB: medium,  >10MB: high throttle (still live)
const LIVE_FAST_MAX = 5 * 1024 * 1024;
const LIVE_MED_MAX = 10 * 1024 * 1024;
const LIVE_FAST_MS = 400;
const LIVE_MED_MS = 1400;
const LIVE_HIGH_MS = 3800;

/* ========================
   Action: Potrace (RAM-only)
   + Optional server-side "Edge" preprocessor via sharp
======================== */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // --- Guard: method ---
    if (request.method.toUpperCase() !== "POST") {
      return json(
        { error: "Method not allowed" },
        { status: 405, headers: { Allow: "POST" } }
      );
    }

    // --- Guard: content type ---
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data")) {
      return json(
        { error: "Unsupported content type. Use multipart/form-data." },
        { status: 415 }
      );
    }

    // IMPORTANT: lift the default ~3MB part limit so 500MB files are accepted.
    // (Still processed in RAM; adjust to a file-based handler if needed.)
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
        { error: "Only PNG or JPEG images are allowed." },
        { status: 415 }
      );
    }
    if ((webFile.size || 0) > MAX_UPLOAD_BYTES) {
      return json(
        { error: "File too large. Max 500 MB per image." },
        { status: 413 }
      );
    }

    // Read original bytes into Buffer
    const ab = await webFile.arrayBuffer();
    // @ts-ignore Buffer exists in Remix node runtime
    let input: Buffer = Buffer.from(ab);

    // --- Authoritative megapixel/side guard (cheap header decode via sharp) ---
    try {
      const { createRequire } = await import("node:module");
      const req = createRequire(import.meta.url);
      const sharp = req("sharp") as typeof import("sharp");
      const meta = await sharp(input).metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;

      if (!w || !h) {
        return json(
          { error: "Could not read image dimensions. Try a different file." },
          { status: 415 }
        );
      }

      const mp = (w * h) / 1_000_000;
      if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
        return json(
          {
            error: `Image too large: ${w}×${h} (~${mp.toFixed(
              1
            )} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
          },
          { status: 413 }
        );
      }
    } catch {
      // If sharp metadata fails here, continue — Potrace may still handle small files.
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
    const lineColor = String(form.get("lineColor") ?? "#000000");
    const invert =
      String(form.get("invert") ?? "false").toLowerCase() === "true";

    // Background
    const transparent =
      String(form.get("transparent") ?? "true").toLowerCase() === "true";
    const bgColor = String(form.get("bgColor") ?? "#ffffff");

    // Preprocess (for photos)
    const preprocess = String(form.get("preprocess") ?? "none") as
      | "none"
      | "edge";
    const blurSigma = Number(form.get("blurSigma") ?? 0.8);
    const edgeBoost = Number(form.get("edgeBoost") ?? 1.0);

    // Normalize for Potrace
    const prepped = await normalizeForPotrace(input, {
      preprocess,
      blurSigma,
      edgeBoost,
    });

    // Potrace (CJS API)
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
          err ? reject(err) : resolve(out)
        );
      } else if (PotraceClass) {
        const p = new PotraceClass(opts);
        p.loadImage(prepped, (err: any) => {
          if (err) return reject(err);
          p.setParameters(opts);
          p.getSVG((err2: any, out: string) =>
            err2 ? reject(err2) : resolve(out)
          );
        });
      } else {
        reject(new Error("potrace API not found"));
      }
    });

    // Post-process SVG safely (defensive)
    const safeSvg = coerceSvg(svgRaw);
    const ensured = ensureViewBoxResponsive(safeSvg);
    const svg2 = recolorPaths(ensured.svg, lineColor);
    const svg3 = stripFullWhiteBackgroundRect(
      svg2,
      ensured.width,
      ensured.height
    );
    const finalSVG = transparent
      ? svg3
      : injectBackgroundRectString(
          svg3,
          ensured.width,
          ensured.height,
          bgColor
        );

    return json({
      svg: finalSVG,
      width: ensured.width,
      height: ensured.height,
    });
  } catch (err: any) {
    return json(
      { error: err?.message || "Server error during conversion." },
      { status: 500 }
    );
  }
}

/* ---------- Image normalization for Potrace (server-side, robust) ---------- */
async function normalizeForPotrace(
  input: Buffer,
  opts: { preprocess: "none" | "edge"; blurSigma: number; edgeBoost: number }
): Promise<Buffer> {
  try {
    // Lazy CJS import so this never leaks into client bundle
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const sharp = req("sharp") as typeof import("sharp");

    // Keep cache tiny for small droplets (best-effort)
    try {
      (sharp as any).cache?.({ files: 0, memory: 50 });
      // (sharp as any).concurrency?.(2); // optional throttle for tiny boxes
    } catch {}

    // Decode + respect EXIF
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

      const src = data as Buffer; // 1 channel enforced by grayscale above
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
          out[y * W + x] = 255 - m; // edges dark, background light
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

      return await sharp(out, {
        raw: { width: W, height: H, channels: 1 },
      })
        .png()
        .toBuffer();
    }

    // Plain grayscale prep
    return await base
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .removeAlpha()
      .grayscale()
      .gamma()
      .normalize()
      .png()
      .toBuffer();
  } catch {
    // If sharp is not available or fails, just return original
    return input;
  }
}

/** Heuristic: flat if min==max OR very low variance OR mean near 0 or 255. */
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
      `<svg viewBox="0 0 ${Math.round(width)} ${Math.round(height)}"`
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
    (_m, a, b) => `<path${a} fill="${fillColor}"${b}>`
  );
  out = out.replace(
    /<path\b((?:(?!>)[\s\S])*?)>(?![\s\S]*?<\/path>)/gi,
    (m, attrs) => {
      if (/fill\s*=/.test(attrs)) return m;
      return `<path${attrs} fill="${fillColor}">`;
    }
  );
  return out;
}

function stripFullWhiteBackgroundRect(
  svg: string,
  width: number,
  height: number
): string {
  const whitePattern =
    /(#ffffff|#fff|white|rgb\(255\s*,\s*255\s*,\s*255\)|rgba\(255\s*,\s*255\s*,\s*255\s*,\s*1\))/i;

  const numeric = new RegExp(
    `<rect\\b[^>]*x\\s*=\\s*["']0["'][^>]*y\\s*=\\s*["']0["'][^>]*width\\s*=\\s*["']${escapeReg(
      String(width)
    )}["'][^>]*height\\s*=\\s*["']${escapeReg(
      String(height)
    )}["'][^>]*fill\\s*=\\s*["']${whitePattern.source}["'][^>]*>`,
    "ig"
  );

  const percent = new RegExp(
    `<rect\\b[^>]*x\\s*=\\s*["']0%?["'][^>]*y\\s*=\\s*["']0%?["'][^>]*width\\s*=\\s*["']100%["'][^>]*height\\s*=\\s*["']100%["'][^>]*fill\\s*=\\s*["']${whitePattern.source}["'][^>]*>`,
    "ig"
  );

  return svg.replace(numeric, "").replace(percent, "");
}

function injectBackgroundRectString(
  svg: string,
  width: number,
  height: number,
  color: string
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
type Settings = {
  threshold: number;
  turdSize: number;
  optTolerance: number;
  turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  lineColor: string;
  invert: boolean;

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
    id: "line-accurate",
    label: "Lineart  -  Accurate (default)",
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
    label: "Lineart  -  Bold",
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
    label: "Lineart  -  Fine detail",
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
    label: "Lineart  -  Seal gaps",
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
    label: "Logo  -  Clean shapes",
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
    label: "Logo  -  Thin details",
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
};

type ServerResult = {
  svg?: string;
  error?: string;
  width?: number;
  height?: number;
};

type HistoryItem = {
  svg: string;
  width: number;
  height: number;
  stamp: number;
};

// ---- tiering helpers (client) ----
type AutoMode = "fast" | "medium" | "high" | "off";
function getAutoMode(bytes?: number | null): AutoMode {
  if (bytes == null) return "off";
  if (bytes < LIVE_FAST_MAX) return "fast";
  if (bytes <= LIVE_MED_MAX) return "medium";
  return "high"; // >10MB: still live, but heavily throttled
}
function autoModeHint(mode: AutoMode): string {
  if (mode === "high")
    return "Live preview is heavily throttled for files over 10 MB.";
  if (mode === "medium") return "Live preview is throttled for 5–10 MB files.";
  return "";
}
function autoModeDetail(mode: AutoMode): string {
  if (mode === "high")
    return "File is large; conversions may take a little longer.";
  if (mode === "medium")
    return "File is midsize; updates run less frequently to keep things smooth.";
  return "";
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<ServerResult>();
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] =
    React.useState<string>("line-accurate");
  const busy = fetcher.state !== "idle";
  const [err, setErr] = React.useState<string | null>(null);

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
    if (fetcher.data?.error) setErr(fetcher.data.error);
    else setErr(null);
  }, [fetcher.data]);

  // When a new server SVG arrives, push to history
  React.useEffect(() => {
    if (fetcher.data?.svg) {
      const item: HistoryItem = {
        svg: fetcher.data.svg,
        width: fetcher.data.width ?? 0,
        height: fetcher.data.height ?? 0,
        stamp: Date.now(),
      };
      setHistory((prev) => [item, ...prev].slice(0, 10));
    }
  }, [fetcher.data?.svg, fetcher.data?.width, fetcher.data?.height]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function measureAndSet(file: File) {
    try {
      const { w, h } = await getImageSize(file);
      const mp = (w * h) / 1_000_000;
      setDims({ w, h, mp });
    } catch {
      setDims(null);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErr("Please choose a PNG or JPEG.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setAutoMode(getAutoMode(f.size)); // set tier
    setErr(null);
    setDims(null);
    measureAndSet(f);
    e.currentTarget.value = "";
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErr("Please choose a PNG or JPEG.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setAutoMode(getAutoMode(f.size)); // set tier
    setErr(null);
    setDims(null);
    measureAndSet(f);
  }

  async function submitConvert() {
    if (!file) {
      setErr("Choose an image first.");
      return;
    }

    // Client-side precheck
    try {
      await validateBeforeSubmit(file);
    } catch (e: any) {
      setErr(e?.message || "Image is too large.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("threshold", String(settings.threshold));
    fd.append("turdSize", String(settings.turdSize));
    fd.append("optTolerance", String(settings.optTolerance));
    fd.append("turnPolicy", settings.turnPolicy);
    fd.append("lineColor", settings.lineColor);
    fd.append("invert", String(settings.invert));
    fd.append("transparent", String(settings.transparent));
    fd.append("bgColor", settings.bgColor);
    fd.append("preprocess", settings.preprocess);
    fd.append("blurSigma", String(settings.blurSigma));
    fd.append("edgeBoost", String(settings.edgeBoost));
    setErr(null);

    // Target this route's index action
    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action: `${window.location.pathname}?index`,
    });
  }

  // ---- Tiered live preview (≤10MB active; >10MB heavily throttled) ----
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!file) return;

    const mode = autoMode;
    if (mode === "off") return; // no file yet

    const delay =
      mode === "fast"
        ? LIVE_FAST_MS
        : mode === "medium"
          ? LIVE_MED_MS
          : LIVE_HIGH_MS;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      submitConvert();
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, settings, activePreset, autoMode]);

  // Disable logic identical on SSR and first client render
  const buttonDisabled = isServer || !hydrated || busy || !file;

  // Apply preset without carrying user overrides except background choices
  function applyPreset(preset: Preset) {
    setActivePreset(preset.id);
    setSettings((s) => {
      const baseline: Settings = {
        ...DEFAULTS,
        transparent: s.transparent,
        bgColor: s.bgColor,
      };
      const lineColor =
        preset.settings.lineColor !== undefined
          ? preset.settings.lineColor
          : s.lineColor;

      return {
        ...baseline,
        lineColor,
        ...preset.settings,
      } as Settings;
    });
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

  return (
    <>
      <SiteHeader />

      <main className="min-h-[100dvh] bg-slate-50 text-slate-900">
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-12">
          <header className="text-center mb-2">
            <h1 className="inline-flex items-center gap-2 text-[34px] font-extrabold leading-none m-0">
              <span>i</span>
              <span
                role="img"
                aria-label="love"
                className="text-[34px] -translate-y-[1px]"
              >
                🩵
              </span>
              <span className="text-[#0b2dff]">SVG</span>
            </h1>
            <p className="mt-1 text-slate-600">
              Convert your png, jpeg, and other image files into crisp vector
              graphics and illustrations.
            </p>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden min-w-0">
              <h2 className="m-0 mb-3 text-lg text-slate-900">Input</h2>

              {/* Presets */}
              <div className="flex flex-wrap gap-2 mb-2 min-w-0">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={[
                      "px-3 py-1.5 rounded-md border text-slate-900 cursor-pointer transition-colors",
                      activePreset === p.id
                        ? "bg-[#e7eeff] border-[#0b2dff]"
                        : "bg-white border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Limits helper */}
              <div className="text-[13px] text-slate-600 mb-2">
                Limits: <b>500 MB</b> • <b>{MAX_MP} MP</b> • <b>{MAX_SIDE}px</b>{" "}
                max side.
              </div>

              {/* Dropzone */}
              {!file ? (
                <div
                  role="button"
                  tabIndex={0}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => document.getElementById("file-inp")?.click()}
                  className="border border-dashed border-[#c8d3ea] rounded-xl p-4 text-center cursor-pointer min-h-[10em] flex justify-center items-center bg-[#f9fbff] hover:bg-[#f2f6ff] focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <div className="text-sm text-slate-600">
                    Click, drag & drop, or paste a PNG/JPEG
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
                        setAutoMode("off");
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

              {/* Settings */}
              <div className="mt-3 flex flex-col gap-2 min-w-0">
                <Field label="Preprocess">
                  <select
                    value={settings.preprocess}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        preprocess: e.target.value as any,
                      }))
                    }
                    className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
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
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, blurSigma: v }))
                        }
                      />
                    </Field>
                    <Field label={`Edge boost (${settings.edgeBoost})`}>
                      <Num
                        value={settings.edgeBoost}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, edgeBoost: v }))
                        }
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
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        threshold: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-[#0b2dff]"
                  />
                </Field>

                <Field label="Turd size">
                  <Num
                    value={settings.turdSize}
                    min={0}
                    max={10}
                    step={1}
                    onChange={(v) =>
                      setSettings((s) => ({ ...s, turdSize: v }))
                    }
                  />
                </Field>

                <Field label="Curve tolerance">
                  <Num
                    value={settings.optTolerance}
                    min={0.05}
                    max={1.2}
                    step={0.05}
                    onChange={(v) =>
                      setSettings((s) => ({ ...s, optTolerance: v }))
                    }
                  />
                </Field>

                <Field label="Turn policy">
                  <select
                    value={settings.turnPolicy}
                    onChange={(e) =>
                      setSettings((s) => ({
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
                    value={settings.lineColor}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, lineColor: e.target.value }))
                    }
                    className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white"
                  />
                </Field>

                <Field label="Invert lineart">
                  <input
                    type="checkbox"
                    checked={settings.invert}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, invert: e.target.checked }))
                    }
                    className="h-4 w-4 accent-[#0b2dff]"
                  />
                </Field>

                <Field label="Background">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={settings.transparent}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          transparent: e.target.checked,
                        }))
                      }
                      title="Transparent background"
                      className="h-4 w-4 accent-[#0b2dff]"
                    />
                    <span className="text-[13px] text-slate-700">
                      Transparent
                    </span>
                    <input
                      type="color"
                      value={settings.bgColor}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, bgColor: e.target.value }))
                      }
                      aria-disabled={settings.transparent}
                      className={[
                        "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white",
                        settings.transparent
                          ? "opacity-50 pointer-events-none"
                          : "",
                      ].join(" ")}
                      title={
                        settings.transparent
                          ? "Uncheck to pick a background color"
                          : "Pick background color"
                      }
                    />
                  </div>
                </Field>
              </div>

              {/* Convert button + errors + tier hints */}
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
                  {busy ? "Converting…" : "Convert"}
                </button>

                {/* Live preview tier notice */}
                {file && autoMode !== "fast" && (
                  <span className="text-[13px] text-slate-600">
                    {autoModeHint(autoMode)} {autoModeDetail(autoMode)}
                  </span>
                )}

                {err && <span className="text-red-700 text-sm">{err}</span>}
              </div>

              {/* Input preview below controls */}
              {previewUrl && (
                <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <img
                    src={previewUrl}
                    alt="Input"
                    className="w-full h-auto block"
                  />
                </div>
              )}
            </div>

            {/* RESULTS */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-xl p-4 h-full max-h-[124.25em] overflow-scroll shadow-sm min-w-0">
              <h2 className="m-0 mb-3 text-lg text-slate-900 flex items-center gap-2">
                Result
                {busy && (
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
                )}
              </h2>

              {history.length > 0 ? (
                <div className="grid gap-3">
                  {history.map((item) => (
                    <div
                      key={item.stamp}
                      className="rounded-xl border border-slate-200 bg-white p-2"
                    >
                      <div className="rounded-xl border border-slate-200 bg-white min-h-[240px] flex items-center justify-center p-2">
                        <img
                          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                            item.svg
                          )}`}
                          alt="SVG result"
                          className="max-w-full h-auto"
                        />
                      </div>
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
                              const b = new Blob([item.svg], {
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
                            className="px-3 py-2 rounded-lg font-semibold border bg-sky-500 hover:bg-sky-600 text-white border-sky-600 cursor-pointer"
                          >
                            Download SVG
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopySvg(item.svg)}
                            className="px-3 py-2 rounded-lg font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                          >
                            Copy SVG
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600 m-0">
                  {busy
                    ? "Converting…"
                    : "Your converted file will appear here."}
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
      <SeoSections />

      <SiteFooter />
    </>
  );
}

/* ===== Client-side helpers (dimension precheck) ===== */
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
    throw new Error("File too large. Max 500 MB per image.");
  }
  const { w, h } = await getImageSize(file);
  if (!w || !h) throw new Error("Could not read image dimensions.");
  const mp = (w * h) / 1_000_000;
  if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
    throw new Error(
      `Image too large: ${w}×${h} (~${mp.toFixed(1)} MP). ` +
        `Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`
    );
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

/* ===== Simple site header & footer ===== */
function SiteHeader() {
  return (
    <div className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 h-12 flex items-center justify-between">
        <a href="/" className="font-extrabold tracking-tight text-slate-900">
          i<span className="text-sky-600">🩵</span>SVG
        </a>
        <nav className="text-sm text-slate-600">
          <a
            href="#"
            className="px-2 py-1 rounded hover:bg-slate-100 transition-colors"
          >
            Docs
          </a>
          <a
            href="#"
            className="px-2 py-1 rounded hover:bg-slate-100 transition-colors"
          >
            GitHub
          </a>
        </nav>
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-6 text-sm text-slate-600 flex items-center justify-between">
        <span>© {new Date().getFullYear()} i🩵SVG</span>
        <span className="space-x-3">
          <a href="#" className="hover:text-slate-900">
            Privacy
          </a>
          <a href="#" className="hover:text-slate-900">
            Terms
          </a>
        </span>
      </div>
    </footer>
  );
}

function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        {/* Overview */}
        <article className="prose prose-slate max-w-none">
          <h2 className="m-0">
            SVG Converter Overview: Precise, Fast, and Built for Creators
          </h2>
          <p className="mt-3">
            This is your all-in-one <strong>SVG everything</strong> experience:
            a high-quality raster-to-vector converter powered by Potrace, tuned
            for logos, line art, scans, whiteboards, comics, diagrams, and even
            photo-style edge extraction. Files are processed in memory and
            returned immediately as clean, scalable <strong>SVG</strong> you can
            edit, recolor, and embed in design tools or code. Elsewhere on the
            site, we also support
            <strong> batch conversion</strong> for larger workflows.
          </p>

          {/* HowTo */}
          <section
            itemScope
            itemType="https://schema.org/HowTo"
            className="mt-8"
          >
            <h3 itemProp="name" className="m-0">
              How to Convert PNG or JPEG to SVG
            </h3>
            <ol className="mt-3 list-decimal pl-5 grid gap-2" itemProp="step">
              <li itemScope itemType="https://schema.org/HowToStep">
                <span itemProp="name">
                  <strong>Upload</strong> a PNG or JPEG (drag &amp; drop or
                  click the picker).
                </span>
                <div
                  itemProp="itemListElement"
                  className="text-sm text-slate-600"
                >
                  For best results, start with a sharp image; avoid heavy
                  compression artifacts.
                </div>
              </li>
              <li itemScope itemType="https://schema.org/HowToStep">
                <span itemProp="name">
                  <strong>Choose a preset</strong> that matches your art.
                </span>
                <div
                  itemProp="itemListElement"
                  className="text-sm text-slate-600"
                >
                  “Lineart – Accurate” for clean inks; “Logo – Clean shapes” for
                  logos; “Photo Edge” for photos.
                </div>
              </li>
              <li itemScope itemType="https://schema.org/HowToStep">
                <span itemProp="name">
                  <strong>Adjust settings</strong> (threshold, curve tolerance,
                  etc.).
                </span>
                <div
                  itemProp="itemListElement"
                  className="text-sm text-slate-600"
                >
                  Use the live preview to fine-tune detail vs. smoothness.
                </div>
              </li>
              <li itemScope itemType="https://schema.org/HowToStep">
                <span itemProp="name">
                  <strong>Pick line color and background</strong>.
                </span>
                <div
                  itemProp="itemListElement"
                  className="text-sm text-slate-600"
                >
                  Transparent background is ideal for overlays; set a color if
                  you need a solid canvas.
                </div>
              </li>
              <li itemScope itemType="https://schema.org/HowToStep">
                <span itemProp="name">
                  <strong>Download or copy the SVG</strong>.
                </span>
                <div
                  itemProp="itemListElement"
                  className="text-sm text-slate-600"
                >
                  SVG scales to any size without quality loss and remains
                  editable.
                </div>
              </li>
            </ol>
          </section>

          {/* Settings explained */}
          <section className="mt-10">
            <h3 className="m-0">Settings Explained (Get the Look You Want)</h3>
            <div className="mt-3 grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="m-0">Preprocess</h4>
                <ul className="mt-2">
                  <li>
                    <strong>None</strong>: Best for logos, scans, and crisp line
                    art.
                  </li>
                  <li>
                    <strong>Edge</strong>: Runs a fast edge detector for
                    photos/paintings to capture outlines.
                  </li>
                </ul>
                <p className="text-sm text-slate-600 mt-1">
                  Edge mode respects EXIF rotation, flattens alpha, converts to
                  grayscale, and boosts contours.
                </p>
              </div>
              <div>
                <h4 className="m-0">Threshold</h4>
                <p className="mt-2">
                  Controls what counts as “ink.” Higher values include lighter
                  areas (more fill); lower values include only darker strokes
                  (less fill).
                </p>
              </div>
              <div>
                <h4 className="m-0">Curve Tolerance</h4>
                <p className="mt-2">
                  Adjusts path smoothing. Lower tolerance preserves tiny
                  wiggles; higher tolerance simplifies curves for smaller,
                  cleaner SVGs.
                </p>
              </div>
              <div>
                <h4 className="m-0">Turd Size</h4>
                <p className="mt-2">
                  Removes tiny specks. Increase this to drop dust, scanner
                  noise, or stray dots from the result.
                </p>
              </div>
              <div>
                <h4 className="m-0">Turn Policy</h4>
                <p className="mt-2">
                  Guides how ambiguous corners are traced (<em>minority</em>,{" "}
                  <em>majority</em>, <em>black</em>,<em> white</em>,{" "}
                  <em>left</em>, <em>right</em>). It can help close gaps or
                  emphasize certain edges.
                </p>
              </div>
              <div>
                <h4 className="m-0">Line Color &amp; Invert</h4>
                <p className="mt-2">
                  Choose any output color for the vector paths. Invert flips
                  light/dark, useful for “white ink on black” looks or
                  blueprint-style presets.
                </p>
              </div>
              <div>
                <h4 className="m-0">Background</h4>
                <p className="mt-2">
                  Keep <strong>Transparent</strong> for overlays and web use, or
                  inject a solid background color for exports that need a
                  visible canvas.
                </p>
              </div>
              <div>
                <h4 className="m-0">Edge Boost &amp; Blur σ</h4>
                <p className="mt-2">
                  In edge mode, a small blur reduces sensor noise; edge boost
                  amplifies contours before tracing. Tweak these together to
                  balance detail and cleanliness.
                </p>
              </div>
            </div>
          </section>

          {/* Use cases & presets */}
          <section className="mt-10">
            <h3 className="m-0">Popular Use Cases &amp; Presets</h3>
            <ul className="mt-3 grid md:grid-cols-2 gap-2">
              <li>
                <strong>Logos</strong>: “Logo – Clean shapes” or “Logo – Thin
                details.”
              </li>
              <li>
                <strong>Scanned drawings</strong>: “Scan – Clean” to remove
                speckles.
              </li>
              <li>
                <strong>Comics/inks</strong>: “Comics – Inks” for chunky
                outlines.
              </li>
              <li>
                <strong>Whiteboards</strong>: “Whiteboard – Anti-glare” to even
                out glare and smudges.
              </li>
              <li>
                <strong>Photos/paintings</strong>: “Photo Edge” presets to
                extract linework silhouettes.
              </li>
              <li>
                <strong>Blueprint/diagram look</strong>: “Diagram – Blueprint”
                (invert + colorized lines).
              </li>
            </ul>
          </section>

          {/* Performance & limits */}
          <section className="mt-10">
            <h3 className="m-0">Performance, Limits, and File Handling</h3>
            <ul className="mt-3">
              <li>
                <strong>Max file size</strong>: 500 MB per image.
              </li>
              <li>
                <strong>Resolution guard</strong>: Up to ~80 megapixels or
                12,000 px on the longest side.
              </li>
              <li>
                <strong>In-memory processing</strong>: Uploads are handled in
                RAM and returned as SVG.
              </li>
              <li>
                <strong>Batch conversion</strong>: Supported elsewhere on the
                site for larger workflows and folders.
              </li>
            </ul>
          </section>

          {/* Troubleshooting */}
          <section className="mt-10">
            <h3 className="m-0">Troubleshooting &amp; Tips</h3>
            <ul className="mt-3">
              <li>
                <strong>“Image too large”</strong>: Downscale the source or crop
                unused borders.
              </li>
              <li>
                <strong>“Could not read image dimensions”</strong>: Re-export as
                PNG or JPEG and retry.
              </li>
              <li>
                <strong>Blank or very light result</strong>: Lower{" "}
                <em>Threshold</em> or disable <em>Invert</em>.
              </li>
              <li>
                <strong>Jagged edges</strong>: Increase <em>Curve Tolerance</em>{" "}
                slightly.
              </li>
              <li>
                <strong>Too many dots</strong>: Raise <em>Turd Size</em> or try
                a “Scan – Clean” preset.
              </li>
              <li>
                <strong>Missing fine lines</strong>: Lower <em>Turd Size</em>,
                lower <em>Curve Tolerance</em>, or increase <em>Threshold</em>.
              </li>
            </ul>
          </section>

          <section
            id="why-use-svg-converter"
            className="prose prose-slate max-w-none mt-10"
          >
            <h2>Why Use an Online SVG Converter?</h2>
            <p>
              SVG (Scalable Vector Graphics) is a vector format that stays sharp
              at any size and can be styled or animated with code. Converting
              PNG or JPEG into SVG improves clarity, flexibility, and long-term
              editability for logos, icons, line art, and diagrams.
            </p>
            <ul>
              <li>
                <strong>Resolution-independent:</strong> vectors scale cleanly
                for web, print, and high-DPI screens.
              </li>
              <li>
                <strong>Editable:</strong> paths and groups can be customized in
                design tools or by hand.
              </li>
              <li>
                <strong>Performance-minded:</strong> often smaller than large
                rasters and can be inlined.
              </li>
              <li>
                <strong>Accessible &amp; scriptable:</strong> manipulable via
                CSS/JS for modern interfaces.
              </li>
            </ul>
          </section>

          {/* STEP-BY-STEP */}
          <section
            id="step-by-step"
            className="prose prose-slate max-w-none mt-10"
          >
            <h2>Step-by-Step: Convert PNG or JPEG to SVG</h2>
            <ol>
              <li>
                <strong>Upload your image:</strong> drag, drop, or pick a
                PNG/JPEG.
              </li>
              <li>
                <strong>Choose a preset:</strong> Lineart, Logo, Scan Cleanup,
                or Photo Edge.
              </li>
              <li>
                <strong>Tune quality:</strong> adjust Threshold, Turd Size, and
                Curve Tolerance.
              </li>
              <li>
                <strong>Pick line color &amp; background:</strong> keep it
                transparent or set a color fill.
              </li>
              <li>
                <strong>Preview live:</strong> the SVG updates in real time to
                reflect your settings.
              </li>
              <li>
                <strong>Download SVG:</strong> save clean vector output to use
                anywhere.
              </li>
            </ol>
            <p>
              This tool creates crisp vector paths that are easy to edit,
              export, and reuse across web, apps, and print. For large
              workloads, batch conversion is also available elsewhere on the
              site.
            </p>
          </section>

          {/* ADVANCED SETTINGS */}
          <section
            id="advanced-settings"
            className="prose prose-slate max-w-none mt-10"
          >
            <h2>Advanced Settings Explained</h2>
            <h3>Threshold</h3>
            <p>
              Controls which pixels become “ink” in the final vector. Lower
              values capture darker areas only; higher values include lighter
              details. Useful for photos, pencil drawings, and faint scans.
            </p>
            <h3>Turd Size</h3>
            <p>
              Removes tiny specks produced by noise or dust in scans. Increase
              to clean up artifacts; decrease to preserve micro-details in
              intricate drawings.
            </p>
            <h3>Curve Tolerance</h3>
            <p>
              Sets how closely the SVG curves follow the original edges. Lower
              values capture more detail and sharp corners; higher values
              simplify shapes for smoother, lighter paths.
            </p>
            <h3>Turn Policy</h3>
            <p>
              Determines how ambiguous turns are resolved when tracing edges.
              Helpful for handwriting, logos with gaps, or overlapping strokes.
            </p>
            <h3>Edge Preprocessing (Photos)</h3>
            <p>
              When enabled, the image is softened (Blur Sigma) and edge contrast
              is emphasized (Edge Boost) to extract clean contours from photos,
              paintings, and noisy captures.
            </p>
          </section>

          {/* USE CASES */}
          <section id="who-uses" className="prose prose-slate max-w-none mt-10">
            <h2>Who Uses This SVG Converter?</h2>
            <ul>
              <li>
                <strong>Designers &amp; illustrators:</strong> convert sketches,
                line art, and logos into flexible vectors.
              </li>
              <li>
                <strong>Web developers:</strong> ship responsive icons,
                diagrams, and UI graphics that scale.
              </li>
              <li>
                <strong>Teachers &amp; students:</strong> turn whiteboards and
                notes into clean, shareable SVG.
              </li>
              <li>
                <strong>Makers &amp; print shops:</strong> prep files for laser
                cutting, vinyl, embroidery, and signage.
              </li>
            </ul>
          </section>

          {/* LIMITS */}
          <section
            id="supported-files"
            className="prose prose-slate max-w-none mt-10"
          >
            <h2>Supported File Types &amp; Limits</h2>
            <ul>
              <li>
                <strong>Formats:</strong> PNG and JPEG
              </li>
              <li>
                <strong>Max size:</strong> 500&nbsp;MB per image
              </li>
              <li>
                <strong>Max dimensions:</strong> 12,000&nbsp;px per side (up to
                ~80&nbsp;MP)
              </li>
              <li>
                <strong>Output:</strong> standards-compliant SVG optimized for
                crisp lines and curves
              </li>
            </ul>
          </section>

          {/* BATCH */}
          <section
            id="batch-conversion"
            className="prose prose-slate max-w-none mt-10"
          >
            <h2>Batch SVG Conversion</h2>
            <p>
              This interface focuses on single-file conversion with instant
              preview. For larger workflows, batch tools on this site can
              convert entire folders of PNG or JPEG files into SVG using the
              same presets and quality options. It’s ideal for logo libraries,
              diagram sets, and high-volume asset pipelines.
            </p>
          </section>

          {/* TIPS */}
          <section id="pro-tips" className="prose prose-slate max-w-none mt-10">
            <h2>Pro Tips for Best Results</h2>
            <ul>
              <li>
                Start with a clear source image. High contrast produces cleaner
                vectors.
              </li>
              <li>
                Use <em>Scan Cleanup</em> or raise <em>Turd Size</em> to remove
                speckles from paper scans.
              </li>
              <li>
                Lower <em>Curve Tolerance</em> for technical drawings; raise it
                for smooth, stylized art.
              </li>
              <li>
                Try <em>Photo Edge</em> presets when converting portraits or
                paintings to illustrative line art.
              </li>
              <li>
                Keep backgrounds transparent for UI assets; add a background
                color for print previews.
              </li>
            </ul>
          </section>

          {/* FAQ schema-style markup */}
          <section
            className="mt-10"
            itemScope
            itemType="https://schema.org/FAQPage"
          >
            <h3 className="m-0">Frequently Asked Questions</h3>

            <div className="mt-3 grid gap-4">
              <article itemScope itemType="https://schema.org/Question">
                <h4 itemProp="name" className="m-0">
                  What is SVG and why convert to it?
                </h4>
                <p
                  itemScope
                  itemType="https://schema.org/Answer"
                  itemProp="acceptedAnswer"
                  className="mt-2"
                >
                  <span itemProp="text">
                    SVG is a resolution-independent vector format. It stays
                    sharp at any size, is editable in design tools and code, and
                    compresses efficiently for the web.
                  </span>
                </p>
              </article>

              <article itemScope itemType="https://schema.org/Question">
                <h4 itemProp="name" className="m-0">
                  Can this handle photos?
                </h4>
                <p
                  itemScope
                  itemType="https://schema.org/Answer"
                  itemProp="acceptedAnswer"
                  className="mt-2"
                >
                  <span itemProp="text">
                    Yes-use the Photo Edge presets. They extract major contours
                    to create stylized linework from images.
                  </span>
                </p>
              </article>

              <article itemScope itemType="https://schema.org/Question">
                <h4 itemProp="name" className="m-0">
                  Is color supported?
                </h4>
                <p
                  itemScope
                  itemType="https://schema.org/Answer"
                  itemProp="acceptedAnswer"
                  className="mt-2"
                >
                  <span itemProp="text">
                    Output paths can be any single color. For multi-color
                    posterization, convert per color region or use advanced
                    workflows elsewhere on the site.
                  </span>
                </p>
              </article>

              <article itemScope itemType="https://schema.org/Question">
                <h4 itemProp="name" className="m-0">
                  Do you support batch conversion?
                </h4>
                <p
                  itemScope
                  itemType="https://schema.org/Answer"
                  itemProp="acceptedAnswer"
                  className="mt-2"
                >
                  <span itemProp="text">
                    Yes-batch tools are available in other areas on this site
                    for converting multiple files at once.
                  </span>
                </p>
              </article>

              <article itemScope itemType="https://schema.org/Question">
                <h4 itemProp="name" className="m-0">
                  Will my SVG be editable?
                </h4>
                <p
                  itemScope
                  itemType="https://schema.org/Answer"
                  itemProp="acceptedAnswer"
                  className="mt-2"
                >
                  <span itemProp="text">
                    Absolutely. The converter outputs standard paths you can
                    edit, recolor, and optimize.
                  </span>
                </p>
              </article>
            </div>
          </section>

          {/* Glossary */}
          <section className="mt-10">
            <h3 className="m-0">Glossary</h3>
            <dl className="mt-3 grid md:grid-cols-2 gap-x-6 gap-y-2">
              <div>
                <dt className="font-semibold">Raster</dt>
                <dd className="text-slate-600">
                  Pixel-based image (PNG, JPEG). Resolution dependent.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Vector</dt>
                <dd className="text-slate-600">
                  Math-based shapes (paths). Scales cleanly to any size.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Potrace</dt>
                <dd className="text-slate-600">
                  The tracer that converts bitmap edges into vector paths.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Threshold</dt>
                <dd className="text-slate-600">
                  The cutoff for what becomes “ink” in the trace.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Turn Policy</dt>
                <dd className="text-slate-600">
                  A rule for how corners and ambiguous pixels get traced.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">viewBox</dt>
                <dd className="text-slate-600">
                  Defines the coordinate system; makes SVG scale responsively.
                </dd>
              </div>
            </dl>
          </section>
        </article>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "i🩵SVG Converter",
            description:
              "Convert PNG and JPEG images to crisp, clean vector SVG files online. Supports presets, lineart, logos, scans, comics, photo edge extraction, and batch conversion.",
            mainEntity: [
              {
                "@type": "HowTo",
                name: "How to Convert PNG or JPEG to SVG",
                description:
                  "Step-by-step instructions for using the i🩵SVG converter to create editable vector graphics.",
                step: [
                  {
                    "@type": "HowToStep",
                    text: "Upload a PNG or JPEG image up to 500 MB or 80 megapixels.",
                  },
                  {
                    "@type": "HowToStep",
                    text: "Choose a preset (Lineart, Logo, Scan Cleanup, Photo Edge, etc.).",
                  },
                  {
                    "@type": "HowToStep",
                    text: "Adjust settings like threshold, turd size, curve tolerance, and turn policy.",
                  },
                  {
                    "@type": "HowToStep",
                    text: "Set line color and choose transparent or solid background.",
                  },
                  {
                    "@type": "HowToStep",
                    text: "Preview the SVG instantly, then download or copy it for your project.",
                  },
                ],
              },
              {
                "@type": "FAQPage",
                mainEntity: [
                  {
                    "@type": "Question",
                    name: "What is SVG and why convert to it?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "SVG is a resolution-independent vector format that stays sharp at any size. It is lightweight, editable, and ideal for logos, icons, diagrams, comics, and scalable graphics.",
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Can this handle photos?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Yes. Photo Edge presets preprocess your image with blur and edge detection to extract clear contours and stylized line art from photos or paintings.",
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Is color supported?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Yes, you can pick any single line color or background color. For multi-color effects, process multiple times or use batch workflows.",
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Do you support batch conversion?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Yes. While this interface is for single images with live preview, batch conversion tools are available elsewhere on the site to process multiple files at once.",
                    },
                  },
                  {
                    "@type": "Question",
                    name: "Will my SVG be editable?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Yes, the output is standards-compliant SVG. Paths can be opened in design tools, recolored, optimized, and animated with CSS or JavaScript.",
                    },
                  },
                  {
                    "@type": "Question",
                    name: "What file limits apply?",
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: "Uploads are limited to PNG and JPEG, up to 500 MB per file, with a maximum of 12,000 pixels per side (around 80 megapixels).",
                    },
                  },
                ],
              },
            ],
          }),
        }}
      />
    </section>
  );
}
