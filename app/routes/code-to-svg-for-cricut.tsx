import * as React from "react";
import type { Route } from "./+types/code-to-svg-for-cricut";
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
import Icons from "~/client/assets/icons/Icons";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";

const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "Code to SVG for Cricut - Convert Base64, Data URI, CSS, Markdown";
  const description =
    "Extract images and SVG code from Base64, data URI strings, CSS url(...) values, Markdown image links, HTML snippets, JSON fields, and raw SVG markup. Convert raster data to SVG and style SVG output for Cricut.";
  const canonical = "https://www.ilovesvg.com/code-to-svg-for-cricut";

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
   Server conversion
======================== */
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_MP = 30;
const MAX_SIDE = 8000;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const DARK_BG_DEFAULT = "#0b1020";

type ReleaseFn = () => void;
type Gate = {
  acquireOrQueue: () => Promise<ReleaseFn>;
  running: number;
  queued: number;
};

async function getGate(): Promise<Gate> {
  const g = globalThis as any;
  if (g.__ilovesvg_code_to_svg_gate) return g.__ilovesvg_code_to_svg_gate;

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

  g.__ilovesvg_code_to_svg_gate = new SimpleGate(MAX, QUEUE_MAX);
  return g.__ilovesvg_code_to_svg_gate;
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method.toUpperCase() !== "POST") {
      return json(
        { error: "Method not allowed." },
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
            "Image data is too large for live conversion. Resize and try again.",
        },
        { status: 413 },
      );
    }

    const uploadHandler = createMemoryUploadHandler({
      maxPartSize: MAX_UPLOAD_BYTES,
    });
    const form = await parseMultipartFormData(request, uploadHandler);

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return json({ error: "No image data found." }, { status: 400 });
    }

    const webFile = file as File;

    if (!ALLOWED_MIME.has(webFile.type)) {
      return json(
        { error: "Only PNG, JPEG, WebP, or GIF image data can be traced." },
        { status: 415 },
      );
    }

    if ((webFile.size || 0) > MAX_UPLOAD_BYTES) {
      return json(
        {
          error: `Image data too large. Max ${Math.round(
            MAX_UPLOAD_BYTES / (1024 * 1024),
          )} MB.`,
        },
        { status: 413 },
      );
    }

    const gate = await getGate();
    let release: ReleaseFn | null = null;

    try {
      release = await gate.acquireOrQueue();
    } catch (e: any) {
      const retryAfterMs = Math.max(1000, Number(e?.retryAfterMs) || 1500);

      return json(
        {
          error:
            "Server is busy converting other images. Try again in a moment.",
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
      let input: Buffer = Buffer.from(ab);

      try {
        const { createRequire } = await import("node:module");
        const req = createRequire(import.meta.url);
        const sharp = req("sharp") as typeof import("sharp");
        const meta = await sharp(input).metadata();
        const w = meta.width ?? 0;
        const h = meta.height ?? 0;

        if (!w || !h) {
          return json(
            { error: "Could not read image dimensions." },
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
        // Continue. Potrace may still handle smaller image data.
      }

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
      const invert =
        String(form.get("invert") ?? "false").toLowerCase() === "true";

      let lineColor = String(form.get("lineColor") ?? "#000000");
      let transparent =
        String(form.get("transparent") ?? "true").toLowerCase() === "true";
      let bgColor = String(form.get("bgColor") ?? "#ffffff");

      const preprocess = String(form.get("preprocess") ?? "none") as
        | "none"
        | "edge";
      const blurSigma = Number(form.get("blurSigma") ?? 0.8);
      const edgeBoost = Number(form.get("edgeBoost") ?? 1.0);

      if (invert) {
        transparent = false;
        if (
          !bgColor ||
          bgColor.toLowerCase() === "#ffffff" ||
          bgColor.toLowerCase() === "#fff"
        ) {
          bgColor = DARK_BG_DEFAULT;
        }

        if (!lineColor || lineColor.toLowerCase() === "#000000") {
          lineColor = "#ffffff";
        }
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
        color: "#000000",
        threshold,
        turdSize,
        optTolerance,
        turnPolicy,
        invert: false,
        blackOnWhite: true,
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
      const svg2 = recolorVectorSvgString(ensured.svg, lineColor);
      const svg3 = stripFullWhiteBackgroundRect(
        svg2,
        ensured.width,
        ensured.height,
      );

      const finalSvg = transparent
        ? svg3
        : injectBackgroundRectString(
            svg3,
            ensured.width,
            ensured.height,
            bgColor,
          );

      return json({
        svg: finalSvg,
        width: ensured.width,
        height: ensured.height,
        source: "raster-trace",
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
    return json(
      { error: err?.message || "Server error during conversion." },
      { status: 500 },
    );
  }
}

async function normalizeForPotrace(
  input: Buffer,
  opts: { preprocess: "none" | "edge"; blurSigma: number; edgeBoost: number },
): Promise<Buffer> {
  try {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const sharp = req("sharp") as typeof import("sharp");

    try {
      (sharp as any).concurrency?.(1);
      (sharp as any).cache?.({ files: 0, memory: 32 });
    } catch {}

    let base = sharp(input).rotate();

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
          let gx = 0;
          let gy = 0;
          let n = 0;

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

      return await sharp(out, {
        raw: { width: W, height: H, channels: 1 },
      })
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

  let min = 255;
  let max = 0;
  let sum = 0;
  let count = 0;

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

/* ========================
   UI types
======================== */
type SourceMode =
  | "auto"
  | "svg"
  | "base64"
  | "data-uri"
  | "css"
  | "markdown"
  | "html"
  | "json";

type CandidateKind =
  | "raw-svg"
  | "svg-data-uri"
  | "base64-svg"
  | "css-data-uri"
  | "markdown-data-uri"
  | "html-data-uri"
  | "json-svg"
  | "json-data-uri"
  | "raster-data-uri"
  | "base64-raster"
  | "unknown";

type Settings = {
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

type Preset = {
  id: string;
  label: string;
  help: string;
  settings: Partial<Settings>;
};

type ExtractedCandidate = {
  kind: CandidateKind;
  label: string;
  source: string;
  svg: string;
  file?: File;
  warning?: string | null;
};

type ServerResult = {
  svg?: string;
  error?: string;
  width?: number;
  height?: number;
  retryAfterMs?: number;
  code?: string;
  source?: string;
  gate?: { running: number; queued: number };
};

type HistoryItem = {
  svg: string;
  width: number;
  height: number;
  kind: CandidateKind | "raster-trace";
  stamp: number;
};

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

const PRESETS: Preset[] = [
  {
    id: "line-accurate",
    label: "Lineart - Accurate",
    help: "Best default for clean drawings, icons, handwriting, and simple craft art.",
    settings: {
      preprocess: "none",
      threshold: 224,
      turdSize: 2,
      optTolerance: 0.28,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
      bgColor: "#ffffff",
    },
  },
  {
    id: "line-bold",
    label: "Lineart - Bold",
    help: "Makes stronger, thicker SVG shapes for easier cutting and weeding.",
    settings: {
      preprocess: "none",
      threshold: 212,
      turdSize: 3,
      optTolerance: 0.38,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "line-fine",
    label: "Lineart - Fine detail",
    help: "Keeps smaller details from sketches, thin drawings, and delicate marks.",
    settings: {
      preprocess: "none",
      threshold: 236,
      turdSize: 1,
      optTolerance: 0.22,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "logo-clean",
    label: "Logo - Clean shapes",
    help: "Smoother shapes and cleaner edges for logos, decals, and simple graphics.",
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
    id: "scan-clean",
    label: "Scan - Remove speckles",
    help: "Reduces dust and scanner noise from uploaded or pasted image data.",
    settings: {
      preprocess: "none",
      threshold: 226,
      turdSize: 5,
      optTolerance: 0.32,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "photo-edge",
    label: "Photo edge - Normal",
    help: "Extracts contours from photo-like raster data before SVG tracing.",
    settings: {
      preprocess: "edge",
      blurSigma: 0.9,
      edgeBoost: 1.15,
      threshold: 220,
      turdSize: 2,
      optTolerance: 0.35,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "photo-bold",
    label: "Photo edge - Bold",
    help: "Stronger contour extraction for low-contrast photos and sticker-style edges.",
    settings: {
      preprocess: "edge",
      blurSigma: 0.6,
      edgeBoost: 1.45,
      threshold: 230,
      turdSize: 3,
      optTolerance: 0.42,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "white-on-dark",
    label: "White lines on dark",
    help: "Creates white SVG lines on a dark background for inverted designs.",
    settings: {
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
    id: "blueprint",
    label: "Blueprint style",
    help: "Blue line output on a dark background for diagram or blueprint-style SVGs.",
    settings: {
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
];

const SAMPLE_CODE = `![Cricut image](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgODAwIDQwMCI+PHBhdGggZD0iTTQwMCAzMjBDMzIwIDI1MCAyMDAgMTc1IDIwMCA5NEMyMDAgNDggMjM4IDIwIDI4MCAyMEMzMzAgMjAgMzY2IDQ4IDQwMCA5MEM0MzQgNDggNDcwIDIwIDUyMCAyMEM1NjIgMjAgNjAwIDQ4IDYwMCA5NEM2MDAgMTc1IDQ4MCAyNTAgNDAwIDMyMFoiIGZpbGw9IiMwZjE3MmEiLz48dGV4dCB4PSI0MDAiIHk9IjM2MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjQ4IiBmb250LXdlaWdodD0iODAwIiBmaWxsPSIjMGIyZGZmIj5DcmljdXQ8L3RleHQ+PC9zdmc+)`;

/* ========================
   Page
======================== */
export default function CodeToSvgForCricut({}: Route.ComponentProps) {
  const fetcher = useFetcher<ServerResult>();

  const [input, setInput] = React.useState("");
  const [filename, setFilename] = React.useState("code-to-svg-cricut");
  const [sourceMode, setSourceMode] = React.useState<SourceMode>("auto");
  const [selectedCandidate, setSelectedCandidate] = React.useState(0);
  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] =
    React.useState<string>("line-accurate");
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showTips, setShowTips] = React.useState(true);
  const [toast, setToast] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => setHydrated(true), []);

  const busy = fetcher.state !== "idle";

  const candidates = React.useMemo(() => {
    if (!hydrated || !input.trim()) return [];
    return extractCandidates(input, sourceMode);
  }, [hydrated, input, sourceMode]);

  const selected = React.useMemo(() => {
    if (!candidates.length) return null;
    return candidates[
      Math.min(Math.max(selectedCandidate, 0), candidates.length - 1)
    ];
  }, [candidates, selectedCandidate]);

  React.useEffect(() => {
    setSelectedCandidate(0);
    setErr(null);
    setInfo(null);
  }, [input, sourceMode]);

  React.useEffect(() => {
    if (!selected) return;

    if (selected.svg) {
      try {
        const styled = styleExistingSvg(selected.svg, settings);
        setHistory((prev) =>
          [
            {
              svg: styled.svg,
              width: styled.width,
              height: styled.height,
              kind: selected.kind,
              stamp: Date.now(),
            },
            ...prev,
          ].slice(0, 10),
        );
        setErr(null);
        setInfo("Existing SVG detected. Styling applied locally.");
      } catch (error: any) {
        setErr(error?.message || "Could not style this SVG.");
      }
    } else if (selected.file) {
      submitRasterCandidate(selected.file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCandidate, candidates.length, activePreset]);

  React.useEffect(() => {
    const data = fetcher.data;

    if (data?.svg) {
      const nextItem: HistoryItem = {
        svg: data.svg,
        width: data.width ?? 0,
        height: data.height ?? 0,
        kind: "raster-trace",
        stamp: Date.now(),
      };

      setHistory((prev) => [nextItem, ...prev].slice(0, 10));
      setErr(null);
      setInfo("Raster image data converted to SVG paths.");
    }

    if (data?.error) {
      setErr(data.error);
    }
  }, [fetcher.data]);

  React.useEffect(() => {
    if (!selected) return;
    if (!selected.svg) return;

    try {
      const styled = styleExistingSvg(selected.svg, settings);
      setHistory((prev) => {
        const withoutOld = prev.filter((item) => item.kind === "raster-trace");
        return [
          {
            svg: styled.svg,
            width: styled.width,
            height: styled.height,
            kind: selected.kind,
            stamp: Date.now(),
          },
          ...withoutOld,
        ].slice(0, 10);
      });
      setErr(null);
      setInfo("Existing SVG detected. Styling applied locally.");
    } catch (error: any) {
      setErr(error?.message || "Could not style this SVG.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const activePresetObject =
    PRESETS.find((preset) => preset.id === activePreset) ?? PRESETS[0];

  const buttonDisabled = isServer || !hydrated || busy || !input.trim();

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(preset: Preset) {
    setActivePreset(preset.id);
    setSettings((current) => {
      const baseline: Settings = {
        ...DEFAULTS,
        transparent: current.transparent,
        bgColor: current.bgColor,
      };

      return {
        ...baseline,
        ...preset.settings,
      } as Settings;
    });
  }

  function showToastMessage(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1500);
  }

  function loadSample() {
    setInput(SAMPLE_CODE);
    setFilename("sample-code-to-svg");
    setSourceMode("auto");
    setSelectedCandidate(0);
    setHistory([]);
    setErr(null);
    setInfo(null);
  }

  function clearInput() {
    setInput("");
    setSelectedCandidate(0);
    setHistory([]);
    setErr(null);
    setInfo(null);
  }

  function submitRasterCandidate(file: File) {
    const effective = getEffectiveSettings(settings);

    const fd = new FormData();
    fd.append("file", file);
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

    setErr(null);
    setInfo("Raster image data detected. Converting to SVG paths...");

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action: `${window.location.pathname}?index`,
    });
  }

  function convertNow() {
    if (!input.trim()) {
      setErr(
        "Paste code, Base64, data URI, CSS, Markdown, HTML, JSON, or raw SVG first.",
      );
      return;
    }

    const extracted = extractCandidates(input, sourceMode);

    if (!extracted.length) {
      setErr(
        "No extractable SVG or image data found. Paste raw SVG, Base64 SVG, SVG data URI, PNG/JPEG/WebP data URI, CSS url(...), Markdown image syntax, HTML, or JSON.",
      );
      setHistory([]);
      return;
    }

    const item =
      extracted[Math.min(Math.max(selectedCandidate, 0), extracted.length - 1)];

    if (item.svg) {
      try {
        const styled = styleExistingSvg(item.svg, settings);
        setHistory((prev) =>
          [
            {
              svg: styled.svg,
              width: styled.width,
              height: styled.height,
              kind: item.kind,
              stamp: Date.now(),
            },
            ...prev,
          ].slice(0, 10),
        );
        setErr(null);
        setInfo("Existing SVG detected. Styling applied locally.");
      } catch (error: any) {
        setErr(error?.message || "Could not process this SVG.");
      }
      return;
    }

    if (item.file) {
      submitRasterCandidate(item.file);
      return;
    }

    setErr("The selected candidate could not be converted.");
  }

  function copySvg(svg: string) {
    navigator.clipboard.writeText(svg).then(
      () => showToastMessage("SVG copied"),
      () => showToastMessage("Copy failed"),
    );
  }

  function downloadSvg(svg: string) {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = makeDownloadName(filename || "converted", "svg");

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    const rows = [
      ["Field", "Value"],
      ["Source mode", sourceMode],
      ["Candidate count", candidates.length],
      ["Selected candidate", selectedCandidate + 1],
      ["Selected kind", selected?.kind || ""],
      ["Active preset", activePresetObject.label],
      ["Preprocess", settings.preprocess],
      ["Threshold", settings.threshold],
      ["Turd size", settings.turdSize],
      ["Curve tolerance", settings.optTolerance],
      ["Turn policy", settings.turnPolicy],
      ["Line color", settings.lineColor],
      ["Invert", settings.invert ? "Yes" : "No"],
      ["Transparent", settings.transparent ? "Yes" : "No"],
      ["Background color", settings.bgColor],
      ["Blur sigma", settings.blurSigma],
      ["Edge boost", settings.edgeBoost],
      ["Latest output width", history[0]?.width || ""],
      ["Latest output height", history[0]?.height || ""],
      ["Latest output kind", history[0]?.kind || ""],
    ];

    const csv = rows
      .map((row) => row.map((cell) => csvEscape(String(cell))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "code-to-svg-for-cricut-report.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
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
                Cricut code and image-data converter
              </p>

              <h1 className="m-0 mb-3 inline-flex w-full items-center justify-center gap-2 text-center text-xl font-extrabold leading-none text-sky-950 sm:text-3xl">
                Code to SVG for Cricut
              </h1>

              <p className="mb-4 text-center text-sm leading-6 text-slate-600">
                Paste Base64, data URI, CSS, Markdown, HTML, JSON, or raw SVG.
                Raster image data is traced into SVG paths. Existing SVG code is
                cleaned and styled.
              </p>

              <PresetPicker
                presets={PRESETS}
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
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-semibold text-slate-800">
                    Code or image data input
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
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={8}
                  spellCheck={false}
                  placeholder="Paste raw SVG, Base64, data:image/... URI, CSS url(...), Markdown image syntax, HTML img tag, or JSON here"
                  className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 outline-none transition focus:border-sky-400"
                />

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <CompactField label="Source">
                    <select
                      value={sourceMode}
                      onChange={(event) =>
                        setSourceMode(event.target.value as SourceMode)
                      }
                      className="w-full cursor-pointer rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-sm text-slate-900 transition-colors hover:bg-slate-50"
                    >
                      <option value="auto">Auto</option>
                      <option value="svg">SVG</option>
                      <option value="base64">Base64</option>
                      <option value="data-uri">Data URI</option>
                      <option value="css">CSS</option>
                      <option value="markdown">Markdown</option>
                      <option value="html">HTML</option>
                      <option value="json">JSON</option>
                    </select>
                  </CompactField>

                  <CompactField label="File">
                    <input
                      type="text"
                      value={filename}
                      onChange={(event) => setFilename(event.target.value)}
                      className="w-full rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-sm text-slate-900"
                    />
                  </CompactField>
                </div>

                {candidates.length > 1 && (
                  <div className="mt-2">
                    <CompactField label="Pick">
                      <select
                        value={selectedCandidate}
                        onChange={(event) =>
                          setSelectedCandidate(Number(event.target.value))
                        }
                        className="w-full cursor-pointer rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-sm text-slate-900 transition-colors hover:bg-slate-50"
                      >
                        {candidates.map((candidate, index) => (
                          <option
                            key={`${candidate.kind}-${index}`}
                            value={index}
                          >
                            {candidate.label}
                          </option>
                        ))}
                      </select>
                    </CompactField>
                  </div>
                )}

                {selected && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-5 text-slate-700">
                    Detected: <b>{readableKind(selected.kind)}</b>
                    {selected.file
                      ? " - will be traced into SVG paths."
                      : " - will be styled as SVG."}
                  </div>
                )}
              </div>

              <div className="mt-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((value) => !value)}
                  className="mb-2 inline-flex w-full cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-sky-50 px-3 py-1.5 text-slate-900 transition-colors hover:bg-slate-50"
                  aria-expanded={showAdvanced}
                  aria-controls="advanced-settings"
                >
                  <span className="inline-flex items-center gap-2">
                    Advanced settings
                  </span>
                  <ChevronDownIcon open={showAdvanced} />
                </button>

                {showAdvanced && (
                  <div
                    id="advanced-settings"
                    className="flex min-w-0 flex-col gap-2"
                  >
                    <Field label="Preprocess">
                      <select
                        value={settings.preprocess}
                        onChange={(event) =>
                          updateSetting(
                            "preprocess",
                            event.target.value as Settings["preprocess"],
                          )
                        }
                        className="w-full cursor-pointer rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 transition-colors hover:bg-slate-50"
                      >
                        <option value="none">None (lineart/logo)</option>
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
                            onChange={(value) =>
                              updateSetting("blurSigma", value)
                            }
                          />
                        </Field>

                        <Field label={`Edge boost (${settings.edgeBoost})`}>
                          <Num
                            value={settings.edgeBoost}
                            min={0.5}
                            max={2}
                            step={0.1}
                            onChange={(value) =>
                              updateSetting("edgeBoost", value)
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
                        onChange={(event) =>
                          updateSetting("threshold", Number(event.target.value))
                        }
                        className="w-full cursor-pointer accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Turd size">
                      <Num
                        value={settings.turdSize}
                        min={0}
                        max={10}
                        step={1}
                        onChange={(value) => updateSetting("turdSize", value)}
                      />
                    </Field>

                    <Field label="Curve tolerance">
                      <Num
                        value={settings.optTolerance}
                        min={0.05}
                        max={1.2}
                        step={0.05}
                        onChange={(value) =>
                          updateSetting("optTolerance", value)
                        }
                      />
                    </Field>

                    <Field label="Turn policy">
                      <select
                        value={settings.turnPolicy}
                        onChange={(event) =>
                          updateSetting(
                            "turnPolicy",
                            event.target.value as Settings["turnPolicy"],
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

                    <Field label="Line color">
                      <input
                        type="color"
                        value={settings.lineColor}
                        onChange={(event) =>
                          updateSetting("lineColor", event.target.value)
                        }
                        className="h-7 w-14 cursor-pointer rounded-md border border-[#dbe3ef] bg-white"
                      />
                    </Field>

                    <Field label="Invert lineart">
                      <input
                        type="checkbox"
                        checked={settings.invert}
                        onChange={(event) => {
                          const on = event.target.checked;

                          if (!on) {
                            setSettings((current) => ({
                              ...current,
                              invert: false,
                            }));
                            return;
                          }

                          setSettings((current) => {
                            const bg =
                              !current.bgColor ||
                              current.bgColor.toLowerCase() === "#ffffff" ||
                              current.bgColor.toLowerCase() === "#fff"
                                ? DARK_BG_DEFAULT
                                : current.bgColor;

                            return {
                              ...current,
                              invert: true,
                              transparent: false,
                              bgColor: bg,
                              lineColor:
                                current.lineColor?.toLowerCase() === "#000000"
                                  ? "#ffffff"
                                  : current.lineColor,
                            };
                          });
                        }}
                        className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
                      />
                    </Field>

                    <Field label="Background">
                      <div className="flex min-w-0 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={settings.transparent}
                          onChange={(event) =>
                            updateSetting("transparent", event.target.checked)
                          }
                          title="Transparent background"
                          className="h-4 w-4 cursor-pointer accent-[#0b2dff]"
                        />
                        <span className="text-[13px] text-slate-700">
                          Transparent
                        </span>
                        <input
                          type="color"
                          value={settings.bgColor}
                          onChange={(event) =>
                            updateSetting("bgColor", event.target.value)
                          }
                          aria-disabled={settings.transparent}
                          className={[
                            "h-7 w-14 cursor-pointer rounded-md border border-[#dbe3ef] bg-white",
                            settings.transparent
                              ? "pointer-events-none opacity-50"
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
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={convertNow}
                  disabled={buttonDisabled}
                  suppressHydrationWarning
                  className={[
                    "flex w-full items-center justify-center rounded-lg border px-3.5 py-2 font-bold transition-colors",
                    "border-[#0a24da] bg-[#0b2dff] text-white hover:border-[#091ec0] hover:bg-[#0a24da]",
                    "disabled:cursor-not-allowed disabled:opacity-70",
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

                {err && <span className="text-sm text-red-700">{err}</span>}
                {!err && info && (
                  <span className="text-[13px] text-slate-600">{info}</span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
                >
                  Export CSV
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowTips((value) => !value)}
                className="mt-3 inline-flex w-full cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                aria-expanded={showTips}
              >
                Tips for code-to-SVG conversion
                <ChevronDownIcon open={showTips} />
              </button>

              {showTips && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      Raster image data from PNG, JPEG, WebP, or GIF is traced
                      into SVG paths using the same conversion approach as the
                      main converter.
                    </li>
                    <li>
                      Existing SVG code is not retraced. It is cleaned,
                      recolored, and given background/output styling directly.
                    </li>
                    <li>
                      Use photo edge presets for photo-like Base64 images and
                      lineart presets for drawings, logos, and scans.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="h-full max-h-[124.25em] min-w-0 overflow-auto rounded-xl border border-slate-200 bg-slate-600 p-4 shadow-sm">
              {busy && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
              )}

              {history.length > 0 ? (
                <div className="grid gap-3">
                  {history.map((item) => (
                    <div
                      key={item.stamp}
                      className="rounded-xl border border-slate-200 bg-white p-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="block text-[13px] font-semibold text-slate-800">
                            SVG output
                          </span>
                          <span className="text-[13px] text-slate-700">
                            {item.width > 0 && item.height > 0
                              ? `${item.width} × ${item.height} px`
                              : "size unknown"}
                          </span>
                        </div>

                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                          {item.kind === "raster-trace"
                            ? "Raster traced"
                            : readableKind(item.kind)}
                        </span>
                      </div>

                      <div className="my-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => downloadSvg(item.svg)}
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
                          onClick={() => copySvg(item.svg)}
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

                      <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
                        <img
                          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                            item.svg,
                          )}`}
                          alt="SVG result"
                          className="h-auto max-w-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="m-0 flex items-center justify-center font-semibold text-white">
                  {!busy && (
                    <Icons
                      name="success"
                      size={20}
                      className="mr-1 inline-block"
                    />
                  )}
                  {busy ? "Converting…" : "Converted files appear here..."}
                </p>
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
   Extraction
======================== */
function extractCandidates(
  input: string,
  mode: SourceMode,
): ExtractedCandidate[] {
  const source = input.trim();
  const candidates: ExtractedCandidate[] = [];
  const seen = new Set<string>();

  function push(candidate: ExtractedCandidate) {
    const key = `${candidate.kind}:${candidate.svg || candidate.source}`.slice(
      0,
      10000,
    );
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  }

  if (mode === "auto" || mode === "svg" || mode === "html") {
    extractRawSvgBlocks(source).forEach((svg, index) => {
      push({
        kind: "raw-svg",
        label: `Raw SVG ${index + 1}`,
        source: svg,
        svg,
      });
    });
  }

  if (mode === "auto" || mode === "json") {
    extractFromJson(source).forEach((candidate) => push(candidate));
  }

  if (
    mode === "auto" ||
    mode === "data-uri" ||
    mode === "css" ||
    mode === "markdown" ||
    mode === "html" ||
    mode === "json"
  ) {
    extractDataUris(source).forEach((dataUri, index) => {
      const parsed = parseDataUri(dataUri);
      if (parsed.kind === "svg-data-uri") {
        push({
          kind: inferDataUriKindByMode(mode),
          label: `SVG data URI ${index + 1}`,
          source: dataUri,
          svg: parsed.svg,
        });
      }

      if (parsed.kind === "raster-data-uri" && parsed.file) {
        push({
          kind: "raster-data-uri",
          label: `Image data ${index + 1}`,
          source: dataUri,
          svg: "",
          file: parsed.file,
          warning: "Raster image data will be traced to SVG paths.",
        });
      }
    });
  }

  if (mode === "auto" || mode === "base64") {
    extractPlainBase64Candidates(source).forEach((candidate) =>
      push(candidate),
    );
  }

  return candidates;
}

function extractRawSvgBlocks(input: string) {
  const matches = input.match(/<svg\b[\s\S]*?<\/svg>/gi);
  return matches || [];
}

function extractDataUris(input: string) {
  const found: string[] = [];
  const source = input.trim();

  const markdownRegex =
    /!\[[^\]]*\]\(\s*(<?data:image\/(?:svg\+xml|png|jpe?g|webp|gif)(?:;charset=[^;,)\s]+)?(?:;base64)?,[\s\S]*?)\s*\)/gi;

  const cssUrlRegex =
    /url\(\s*(['"]?)(data:image\/(?:svg\+xml|png|jpe?g|webp|gif)(?:;charset=[^;,)"'\s]+)?(?:;base64)?,[\s\S]*?)\1\s*\)/gi;

  const htmlAttrRegex =
    /\b(?:src|href|xlink:href)\s*=\s*(['"])(data:image\/(?:svg\+xml|png|jpe?g|webp|gif)(?:;charset=[^;,)"'\s]+)?(?:;base64)?,[\s\S]*?)\1/gi;

  const directRegex =
    /data:image\/(?:svg\+xml|png|jpe?g|webp|gif)(?:;charset=[^;,)"'\s]+)?(?:;base64)?,[A-Za-z0-9+/=_\-%.:;,()[\]{}!~*'"#<> \n\r\t-]+/gi;

  let match: RegExpExecArray | null;

  while ((match = markdownRegex.exec(source)) !== null) {
    const cleaned = cleanExtractedDataUri(match[1]);
    if (cleaned) found.push(cleaned);
  }

  while ((match = cssUrlRegex.exec(source)) !== null) {
    const cleaned = cleanExtractedDataUri(match[2]);
    if (cleaned) found.push(cleaned);
  }

  while ((match = htmlAttrRegex.exec(source)) !== null) {
    const cleaned = cleanExtractedDataUri(match[2]);
    if (cleaned) found.push(cleaned);
  }

  while ((match = directRegex.exec(source)) !== null) {
    const cleaned = cleanExtractedDataUri(match[0]);
    if (cleaned) found.push(cleaned);
  }

  return Array.from(new Set(found));
}

function cleanExtractedDataUri(value: string) {
  let out = value
    .trim()
    .replace(/^</, "")
    .replace(/^["'`]/, "")
    .trim();

  const rasterMatch = out.match(
    /^(data:image\/(?:png|jpe?g|webp|gif)(?:;charset=[^;,)"'\s]+)?;base64,[A-Za-z0-9+/=_-]+)/i,
  );
  if (rasterMatch) return rasterMatch[1];

  const svgBase64Match = out.match(
    /^(data:image\/svg\+xml(?:;charset=[^;,)"'\s]+)?;base64,[A-Za-z0-9+/=_-]+)/i,
  );
  if (svgBase64Match) return svgBase64Match[1];

  if (/^data:image\/svg\+xml/i.test(out)) {
    const commaIndex = out.indexOf(",");
    if (commaIndex < 0) return "";

    const meta = out.slice(0, commaIndex);
    let payload = out.slice(commaIndex + 1);

    payload = payload
      .replace(/\s*\)\s*$/g, "")
      .replace(/\s*["'`;}\]]+$/g, "")
      .trim();

    return `${meta},${payload}`;
  }

  out = out
    .replace(/\s*\)\s*$/g, "")
    .replace(/\s*["'`;}\]]+$/g, "")
    .trim();

  return out.startsWith("data:image/") ? out : "";
}

function parseDataUri(
  dataUri: string,
):
  | { kind: "svg-data-uri"; svg: string; file?: never }
  | { kind: "raster-data-uri"; svg?: never; file: File }
  | { kind: "invalid"; svg?: never; file?: never } {
  const commaIndex = dataUri.indexOf(",");
  if (commaIndex < 0) return { kind: "invalid" };

  const meta = dataUri.slice(0, commaIndex).toLowerCase();
  const payload = dataUri.slice(commaIndex + 1).trim();

  if (meta.startsWith("data:image/svg+xml")) {
    if (meta.includes(";base64")) {
      const svg = safeBase64Decode(payload).trim();
      return { kind: "svg-data-uri", svg };
    }

    return {
      kind: "svg-data-uri",
      svg: decodeUriSvgPayload(payload),
    };
  }

  if (/^data:image\/(png|jpe?g|webp|gif)/i.test(meta)) {
    const file = dataUriToFile(dataUri, `extracted-${Date.now()}`);
    if (!file) return { kind: "invalid" };
    return { kind: "raster-data-uri", file };
  }

  return { kind: "invalid" };
}

function inferDataUriKindByMode(mode: SourceMode): CandidateKind {
  if (mode === "css") return "css-data-uri";
  if (mode === "markdown") return "markdown-data-uri";
  if (mode === "html") return "html-data-uri";
  if (mode === "json") return "json-data-uri";
  return "svg-data-uri";
}

function extractFromJson(input: string): ExtractedCandidate[] {
  const candidates: ExtractedCandidate[] = [];

  try {
    const parsed = JSON.parse(input);
    const values: string[] = [];
    walkJson(parsed, values);

    values.forEach((value, index) => {
      extractRawSvgBlocks(value).forEach((svg) => {
        candidates.push({
          kind: "json-svg",
          label: `JSON SVG ${index + 1}`,
          source: value,
          svg,
        });
      });

      extractDataUris(value).forEach((dataUri) => {
        const parsedUri = parseDataUri(dataUri);

        if (parsedUri.kind === "svg-data-uri") {
          candidates.push({
            kind: "json-data-uri",
            label: `JSON SVG data URI ${index + 1}`,
            source: dataUri,
            svg: parsedUri.svg,
          });
        }

        if (parsedUri.kind === "raster-data-uri") {
          candidates.push({
            kind: "raster-data-uri",
            label: `JSON image data ${index + 1}`,
            source: dataUri,
            svg: "",
            file: parsedUri.file,
          });
        }
      });

      const compact = value.replace(/\s+/g, "");
      if (looksLikeBase64(compact)) {
        const decoded = safeBase64Decode(compact).trim();

        if (/^<svg[\s>]/i.test(decoded)) {
          candidates.push({
            kind: "base64-svg",
            label: `JSON Base64 SVG ${index + 1}`,
            source: value,
            svg: decoded,
          });
        } else if (isKnownRasterBase64(compact)) {
          const dataUri = inferRasterDataUri(compact);
          const file = dataUriToFile(dataUri, `json-raster-${index + 1}`);
          if (file) {
            candidates.push({
              kind: "base64-raster",
              label: `JSON Base64 image ${index + 1}`,
              source: dataUri,
              svg: "",
              file,
            });
          }
        }
      }
    });
  } catch {
    return candidates;
  }

  return candidates;
}

function walkJson(value: unknown, strings: string[]) {
  if (typeof value === "string") {
    strings.push(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => walkJson(item, strings));
    return;
  }

  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      walkJson(item, strings),
    );
  }
}

function extractPlainBase64Candidates(input: string): ExtractedCandidate[] {
  const candidates: ExtractedCandidate[] = [];
  const fullCompact = input.trim().replace(/\s+/g, "");
  const chunks = input
    .split(/[\s"'`<>()[\]{};,]+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 24);

  const values = [fullCompact, ...chunks];

  values.forEach((value, index) => {
    if (!looksLikeBase64(value)) return;

    const decoded = safeBase64Decode(value).trim();

    if (/^<svg[\s>]/i.test(decoded)) {
      candidates.push({
        kind: "base64-svg",
        label: `Base64 SVG ${index + 1}`,
        source: value,
        svg: decoded,
      });
      return;
    }

    if (isKnownRasterBase64(value)) {
      const dataUri = inferRasterDataUri(value);
      const file = dataUriToFile(dataUri, `base64-raster-${index + 1}`);
      if (file) {
        candidates.push({
          kind: "base64-raster",
          label: `Base64 image ${index + 1}`,
          source: dataUri,
          svg: "",
          file,
        });
      }
    }
  });

  return candidates;
}

/* ========================
   SVG styling
======================== */
function styleExistingSvg(svgText: string, settings: Settings) {
  if (!/^<svg[\s>]/i.test(svgText.trim())) {
    throw new Error("The extracted candidate is not an SVG document.");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const parserError = doc.querySelector("parsererror");

  if (parserError) {
    throw new Error("The extracted SVG is malformed and could not be parsed.");
  }

  const svg = doc.documentElement;

  if (!svg || svg.tagName.toLowerCase() !== "svg") {
    throw new Error("The extracted content is not a valid SVG document.");
  }

  doc
    .querySelectorAll("script, foreignObject")
    .forEach((node) => node.remove());
  removeEventAttributes(svg);
  doc.querySelectorAll("metadata, desc").forEach((node) => node.remove());
  removeComments(doc);

  const size = ensureSvgSizeClient(svg);

  recolorSvgDom(doc, settings.lineColor);

  if (!settings.transparent) {
    const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", String(size.width));
    rect.setAttribute("height", String(size.height));
    rect.setAttribute("fill", settings.bgColor);
    svg.insertBefore(rect, svg.firstChild);
  }

  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  let output = new XMLSerializer().serializeToString(doc);

  output = output
    .replace(/<\?xml[^>]*>/gi, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .trim();

  output = minifySvg(output);

  return {
    svg: output,
    width: size.width,
    height: size.height,
  };
}

function ensureSvgSizeClient(svg: Element) {
  const widthAttr = svg.getAttribute("width");
  const heightAttr = svg.getAttribute("height");
  const viewBoxAttr = svg.getAttribute("viewBox");

  let width = parseSvgNumber(widthAttr);
  let height = parseSvgNumber(heightAttr);

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

  if (!viewBoxAttr) {
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

function recolorSvgDom(doc: Document, color: string) {
  doc.querySelectorAll("*").forEach((node) => {
    const tag = node.tagName.toLowerCase();

    if (
      [
        "svg",
        "defs",
        "title",
        "desc",
        "style",
        "clipPath",
        "mask",
        "pattern",
        "linearGradient",
        "radialGradient",
        "stop",
        "image",
      ].includes(tag)
    ) {
      return;
    }

    if (node.getAttribute("fill") !== "none") {
      node.setAttribute("fill", color);
    }

    if (node.hasAttribute("stroke")) {
      node.setAttribute("stroke", color);
    }
  });
}

/* ========================
   Shared SVG helpers
======================== */
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

  const newSvg = svg.replace(openTag, newOpen);

  return {
    svg: newSvg,
    width,
    height,
  };
}

function recolorVectorSvgString(svg: string, color: string): string {
  let out = svg.replace(
    /<path\b([^>]*?)\sfill\s*=\s*["'][^"']*["']([^>]*?)>/gi,
    (_m, a, b) => `<path${a} fill="${color}"${b}>`,
  );

  out = out.replace(/<path\b((?:(?!>)[\s\S])*?)>/gi, (m, attrs) => {
    if (/fill\s*=/.test(attrs)) return m;
    return `<path${attrs} fill="${color}">`;
  });

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

function escapeReg(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function decodeUriSvgPayload(value: string) {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

function looksLikeBase64(value: string) {
  if (value.length < 24) return false;
  return /^[A-Za-z0-9+/=_-]+$/.test(value);
}

function isKnownRasterBase64(value: string) {
  return (
    value.startsWith("iVBORw0KGgo") ||
    value.startsWith("/9j/") ||
    value.startsWith("R0lGOD") ||
    value.startsWith("UklGR")
  );
}

function inferRasterDataUri(base64: string) {
  if (base64.startsWith("iVBORw0KGgo")) {
    return `data:image/png;base64,${base64}`;
  }

  if (base64.startsWith("/9j/")) {
    return `data:image/jpeg;base64,${base64}`;
  }

  if (base64.startsWith("R0lGOD")) {
    return `data:image/gif;base64,${base64}`;
  }

  if (base64.startsWith("UklGR")) {
    return `data:image/webp;base64,${base64}`;
  }

  return `data:image/png;base64,${base64}`;
}

function dataUriToFile(dataUri: string, basename: string) {
  try {
    const commaIndex = dataUri.indexOf(",");
    if (commaIndex < 0) return null;

    const meta = dataUri.slice(0, commaIndex);
    const payload = dataUri.slice(commaIndex + 1);
    const mimeMatch = meta.match(/^data:([^;,]+)/i);
    const mime = mimeMatch?.[1] || "image/png";

    const binary = window.atob(payload.replace(/\s+/g, ""));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const ext = mimeToExt(mime);

    return new File([bytes], `${basename}.${ext}`, { type: mime });
  } catch {
    return null;
  }
}

function mimeToExt(mime: string) {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "png";
}

function parseSvgNumber(value: string | null) {
  if (!value) return 0;
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function minifySvg(svg: string) {
  return svg
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .replace(/\n+/g, "")
    .trim();
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

function getEffectiveSettings(settings: Settings) {
  if (!settings.invert) return settings;

  const bg =
    !settings.bgColor ||
    settings.bgColor.toLowerCase() === "#ffffff" ||
    settings.bgColor.toLowerCase() === "#fff"
      ? DARK_BG_DEFAULT
      : settings.bgColor;

  return {
    ...settings,
    transparent: false,
    bgColor: bg,
    lineColor:
      settings.lineColor?.toLowerCase() === "#000000"
        ? "#ffffff"
        : settings.lineColor,
  };
}

function readableKind(kind: CandidateKind) {
  if (kind === "raw-svg") return "Raw SVG";
  if (kind === "svg-data-uri") return "SVG data URI";
  if (kind === "base64-svg") return "Base64 SVG";
  if (kind === "css-data-uri") return "CSS data URI";
  if (kind === "markdown-data-uri") return "Markdown data URI";
  if (kind === "html-data-uri") return "HTML data URI";
  if (kind === "json-svg") return "JSON SVG";
  if (kind === "json-data-uri") return "JSON data URI";
  if (kind === "raster-data-uri") return "Raster image data";
  if (kind === "base64-raster") return "Base64 image data";
  return "Unknown";
}

function makeDownloadName(name: string, extension: string) {
  const safeBase =
    name
      .toLowerCase()
      .slice(0, 80)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "converted";

  return `${safeBase}.${extension}`;
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
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
    <label className="flex min-w-0 items-center gap-2 rounded-lg border border-[#edf2fb] bg-[#fafcff] px-3 py-2">
      <span className="min-w-[180px] shrink-0 text-[13px] text-slate-700">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </label>
  );
}

function CompactField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2 rounded-lg border border-[#edf2fb] bg-[#fafcff] px-2.5 py-2">
      <span className="w-[56px] shrink-0 text-[12px] font-semibold text-slate-600">
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
  const DEFAULT_VISIBLE = 6;
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
                Convert pasted code and image data to SVG
              </p>

              <h2 className="text-2xl font-bold leading-tight text-sky-950 md:text-3xl">
                Extract and convert code-based images into Cricut SVG files
              </h2>

              <p className="text-slate-600">
                This tool is for users who have image data hidden inside code.
                It can extract SVG or raster image data from Base64 strings,
                data URIs, CSS url(...) values, Markdown image links, HTML
                snippets, JSON fields, and raw SVG markup.
              </p>

              <p className="text-slate-600">
                If the extracted content is already SVG, the tool cleans and
                styles the SVG directly. If the extracted content is PNG, JPEG,
                WebP, or GIF data, it traces the image into SVG paths so the
                output behaves like a real converted SVG rather than a simple
                image wrapper.
              </p>

              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    k: "Base64 support",
                    v: "Decode SVG and raster Base64",
                  },
                  {
                    k: "Data URI support",
                    v: "Extract from CSS, HTML, Markdown, JSON",
                  },
                  {
                    k: "Raster tracing",
                    v: "Convert image data into SVG paths",
                  },
                  {
                    k: "Style presets",
                    v: "Lineart, logo, scan, photo edge",
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
            <h3 className="text-lg font-bold text-sky-950">Supported inputs</h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Raw SVG",
                "Base64 SVG",
                "Base64 PNG/JPEG",
                "SVG data URI",
                "PNG/JPEG/WebP data URI",
                "CSS url(...)",
                "Markdown image links",
                "HTML img src",
                "JSON fields",
                "App export code",
                "Cricut SVG conversion",
                "Photo edge tracing",
              ].map((text) => (
                <span
                  key={text}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                >
                  {text}
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
              <h3 itemProp="name" className="text-lg font-bold text-sky-950">
                How to convert code to SVG for Cricut
              </h3>

              <span className="text-xs text-slate-500">
                Paste, extract, preset, convert, download
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Paste your code",
                  body: "Paste Base64, data URI, CSS, Markdown, HTML, JSON, or raw SVG into the input box.",
                },
                {
                  title: "Choose a style preset",
                  body: "Pick lineart, logo, scan cleanup, photo edge, white-on-dark, or blueprint style.",
                },
                {
                  title: "Convert to SVG",
                  body: "Existing SVG is styled directly. Raster image data is traced into SVG paths.",
                },
                {
                  title: "Adjust advanced settings",
                  body: "Tune threshold, curve tolerance, noise cleanup, edge boost, line color, and background.",
                },
                {
                  title: "Download the SVG",
                  body: "Download or copy the SVG for Cricut Design Space or other craft workflows.",
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
              Settings explained
            </h3>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                {
                  title: "Preprocess",
                  body: "Use None for clean SVG, logos, and line art. Use Edge for photo-like image data.",
                },
                {
                  title: "Threshold",
                  body: "Controls what becomes solid vector artwork. Higher values include lighter pixels.",
                },
                {
                  title: "Turd size",
                  body: "Removes tiny speckles from scans, screenshots, and noisy image data.",
                },
                {
                  title: "Curve tolerance",
                  body: "Lower values keep detail. Higher values smooth the SVG and reduce complexity.",
                },
                {
                  title: "Line color",
                  body: "Recolors traced SVG paths or existing SVG shapes for Cricut-ready output.",
                },
                {
                  title: "Background",
                  body: "Keep transparency for cut files or add a solid background for display-style SVGs.",
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
                  q: "Can this convert Base64 image data to SVG?",
                  a: "Yes. If the Base64 is PNG, JPEG, WebP, or GIF image data, the tool extracts it and traces it into SVG paths.",
                },
                {
                  q: "Can this extract SVG from CSS?",
                  a: "Yes. It can read CSS url(...) values that contain SVG or supported image data URIs.",
                },
                {
                  q: "Can this extract from Markdown?",
                  a: "Yes. Markdown image links with supported data URIs can be extracted and converted.",
                },
                {
                  q: "What happens if the input is already SVG?",
                  a: "The tool cleans and styles the existing SVG directly rather than retracing it.",
                },
                {
                  q: "What presets should I use?",
                  a: "Use lineart presets for drawings, logo presets for simple graphics, scan presets for noisy inputs, and photo edge presets for photo-like image data.",
                },
                {
                  q: "Is raster data only wrapped inside SVG?",
                  a: "No. This version traces raster data into vector SVG paths, following the same conversion idea as the main image-to-SVG converter.",
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
