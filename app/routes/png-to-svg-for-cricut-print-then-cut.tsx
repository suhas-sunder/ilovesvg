import * as React from "react";
import type { Route } from "./+types/png-to-svg-for-cricut-print-then-cut";
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
import { Link, type ActionFunctionArgs } from "react-router";
import { CurrentRouteGuide, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";
import { ChevronDownIcon, PresetPicker } from "~/client/components/converter/PresetSelector";
import {
  FullscreenOutputPreview,
  FullscreenPreviewButton,
} from "~/client/components/converter/FullscreenOutputPreview";
import { EditedSvgPreviewImage } from "~/client/components/svg/EditedSvgPreviewImage";
import type { PresetBackendIntensity } from "~/client/lib/converter/presetIntensity";
import { useHybridTraceFetcher } from "~/client/lib/tracing/useHybridTraceFetcher";

const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "PNG to SVG for Cricut Print Then Cut | Free Print Then Cut SVG Maker";
  const description =
    "Prepare PNG or JPG artwork for Cricut Print Then Cut workflows with printable color preservation, SVG cut outline output, preview, and download controls.";
  const canonical =
    "https://www.ilovesvg.com/png-to-svg-for-cricut-print-then-cut";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },

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
   Limits & types
======================== */
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_MP = 30;
const MAX_SIDE = 8000;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 400;
const LIVE_MED_MS = 1500;

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

type OutlineSource = "auto" | "transparency" | "light" | "dark" | "edge";

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

    const {
      HEAVY_BACKEND_RATE_LIMITS,
      checkBackendConversionRateLimit,
      createRateLimitedResponse,
      validateSameOrigin,
      validateMultipartFileCount,
      validateUploadedFileBasics,
      validateFileSignature,
    } = await import("~/utils/backendSecurity.server");

    const originError = validateSameOrigin(request);
    if (originError) return originError;

    const rateLimit = checkBackendConversionRateLimit(
      request,
      "png-to-svg-for-cricut-print-then-cut",
      "raster-trace",
      HEAVY_BACKEND_RATE_LIMITS
    );
    if (!rateLimit.allowed) return createRateLimitedResponse(rateLimit);

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

    const uploadHandler = createMemoryUploadHandler({
      maxPartSize: MAX_UPLOAD_BYTES,
    });

    const form = await parseMultipartFormData(request, uploadHandler);

    const fileCountError = validateMultipartFileCount(form);
    if (fileCountError) return fileCountError;
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return json({ error: "No file uploaded." }, { status: 400 });
    }

    const webFile = file as File;
    const uploadError = validateUploadedFileBasics(webFile, {
      allowedMimeTypes: ALLOWED_MIME,
      maxBytes: MAX_UPLOAD_BYTES,
      label: "supported image",
    });
    if (uploadError) return uploadError;

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
      const ab = await webFile.arrayBuffer();
      const input = Buffer.from(ab);

      const { getSharp } = await import("~/utils/conversionModules.server");
      const sharp = await getSharp();

      try {
        (sharp as any).concurrency?.(1);
        (sharp as any).cache?.({ files: 0, memory: 48 });
      } catch {}

      const routeNeutralizeTransparency = neutralizeTransparencyCheckerboardShared;
      const sourceInput = await routeNeutralizeTransparency(input);

      const meta = await sharp(sourceInput).rotate().metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;

      if (!width || !height) {
        return json(
          { error: "Could not read image dimensions. Try a different file." },
          { status: 415 },
        );
      }
      if (width < 2 || height < 2) {
        return json(
          {
            error:
              "Image is too small to trace safely. Please upload an image at least 2x2 pixels.",
          },
          { status: 415 },
        );
      }

      const mp = (width * height) / 1_000_000;

      if (width > MAX_SIDE || height > MAX_SIDE || mp > MAX_MP) {
        return json(
          {
            error: `Image too large: ${width}×${height} (~${mp.toFixed(
              1,
            )} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
          },
          { status: 413 },
        );
      }

      const outlineSource = clampOutlineSource(
        String(form.get("outlineSource") ?? "auto"),
      );

      const cutOffset = clampNumber(Number(form.get("cutOffset") ?? 18), 0, 96);
      const backgroundTolerance = clampNumber(
        Number(form.get("backgroundTolerance") ?? 28),
        0,
        120,
      );
      const darkThreshold = clampNumber(
        Number(form.get("darkThreshold") ?? 220),
        0,
        255,
      );
      const edgeThreshold = clampNumber(
        Number(form.get("edgeThreshold") ?? 42),
        1,
        255,
      );
      const speckCleanup = clampNumber(
        Number(form.get("speckCleanup") ?? 5),
        0,
        40,
      );
      const curveSmoothness = clampNumber(
        Number(form.get("curveSmoothness") ?? 0.7),
        0.05,
        2.5,
      );
      const cutLineColor = sanitizeHexColor(
        String(form.get("cutLineColor") ?? "#ff00ff"),
        "#ff00ff",
      );
      const cutLineWidth = clampNumber(
        Number(form.get("cutLineWidth") ?? 1),
        0.25,
        12,
      );
      const includePrintableBorder =
        String(form.get("includePrintableBorder") ?? "true").toLowerCase() ===
        "true";
      const printableBorderColor = sanitizeHexColor(
        String(form.get("printableBorderColor") ?? "#ffffff"),
        "#ffffff",
      );
      const addWhitePage =
        String(form.get("addWhitePage") ?? "false").toLowerCase() === "true";

      const printablePng = await sharp(input)
        .rotate()
        .ensureAlpha()
        .png()
        .toBuffer();

      const mask = await createCutMask(input, {
        outlineSource,
        backgroundTolerance,
        darkThreshold,
        edgeThreshold,
        cutOffset,
        speckCleanup,
      });

      const routePotraceTrace = runSharedPotraceSvgTraceShared;
      const opts: any = {
        color: "#000000",
        threshold: 128,
        turdSize: Math.max(0, Math.round(speckCleanup)),
        optTolerance: curveSmoothness,
        turnPolicy: "majority",
        invert: false,
        blackOnWhite: true,
      };

      const tracedRaw: string = await routePotraceTrace(mask, opts);

      let cutPathD = extractPathData(tracedRaw);
      const warnings: string[] = [];
      if (!cutPathD) {
        const maskForegroundCoverage = await getMaskForegroundCoverage(mask);
        if (maskForegroundCoverage >= 0.85) {
          cutPathD = buildCanvasOutlinePath(width, height);
          warnings.push(
            "Used the image bounds as the cut outline because the traced mask filled the canvas.",
          );
        }
      }

      if (!cutPathD) {
        return json(
          {
            error:
              "Could not generate a usable cut outline. Try a transparent PNG or adjust the outline source.",
          },
          { status: 422 },
        );
      }

      const printableDataUri = `data:image/png;base64,${printablePng.toString(
        "base64",
      )}`;

      const finalSVG = buildPrintThenCutSvg({
        width,
        height,
        printableDataUri,
        cutPathD,
        cutLineColor,
        cutLineWidth,
        includePrintableBorder,
        printableBorderColor,
        addWhitePage,
      });

      return json({
        svg: finalSVG,
        width,
        height,
        engineUsed: "potrace",
        sourceKind: "raster",
        warnings,
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

/* ========================
   Server image processing
======================== */
async function createCutMask(
  input: Buffer,
  opts: {
    outlineSource: OutlineSource;
    backgroundTolerance: number;
    darkThreshold: number;
    edgeThreshold: number;
    cutOffset: number;
    speckCleanup: number;
  },
): Promise<Buffer> {
  const { getSharp } = await import("~/utils/conversionModules.server");
      const sharp = await getSharp();

  const meta = await sharp(input).rotate().metadata();

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (!width || !height) {
    throw new Error("Could not read image dimensions.");
  }
  if (width < 2 || height < 2) {
    throw new Error(
      "Image is too small to trace safely. Please use an image at least 2x2 pixels.",
    );
  }

  const hasAlpha = Boolean(meta.hasAlpha);
  const normalized = sharp(input).rotate().ensureAlpha();
  const requestedSource = opts.outlineSource;

  let maskRaw: Buffer;

  if (requestedSource === "edge") {
    maskRaw = await createEdgeMask(input, {
      edgeThreshold: opts.edgeThreshold,
    });
  } else {
    const { data, info } = await normalized
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgba = data as Buffer;
    const W = info.width | 0;
    const H = info.height | 0;
    const source =
      requestedSource === "auto"
        ? hasAlpha && hasTransparentPixels(rgba)
          ? "transparency"
          : "light"
        : requestedSource;

    maskRaw = Buffer.alloc(W * H, 255);

    for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
      const r = rgba[i] ?? 255;
      const g = rgba[i + 1] ?? 255;
      const b = rgba[i + 2] ?? 255;
      const a = rgba[i + 3] ?? 255;

      let foreground = false;

      if (source === "transparency") {
        foreground = a > 12;
      } else if (source === "light") {
        const nearWhite =
          r >= 255 - opts.backgroundTolerance &&
          g >= 255 - opts.backgroundTolerance &&
          b >= 255 - opts.backgroundTolerance;
        foreground = a > 12 && !nearWhite;
      } else if (source === "dark") {
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        foreground = a > 12 && lum <= opts.darkThreshold;
      }

      maskRaw[p] = foreground ? 0 : 255;
    }
  }

  let pipeline = sharp(maskRaw, {
    raw: {
      width,
      height,
      channels: 1,
    },
  });

  const cleanup = Math.max(0, Math.round(opts.speckCleanup));
  if (cleanup > 0) {
    pipeline = pipeline.median(Math.min(9, Math.max(1, cleanup)));
  }

  const offset = Math.max(0, Math.round(opts.cutOffset));
  if (offset > 0) {
    pipeline = pipeline.negate();

    const chunks = Math.ceil(offset / 32);
    for (let i = 0; i < chunks; i++) {
      const amount = i === chunks - 1 ? offset - 32 * i : 32;
      if (amount > 0) {
        pipeline = pipeline.dilate(amount);
      }
    }

    pipeline = pipeline.negate();
  }

  return await pipeline.png().toBuffer();
}

function hasTransparentPixels(rgba: Buffer): boolean {
  for (let i = 3; i < rgba.length; i += 4) {
    if ((rgba[i] ?? 255) <= 12) return true;
  }

  return false;
}

async function createEdgeMask(
  input: Buffer,
  opts: {
    edgeThreshold: number;
  },
): Promise<Buffer> {
  const { getSharp } = await import("~/utils/conversionModules.server");
      const sharp = await getSharp();

  const routeNeutralizeTransparency = neutralizeTransparencyCheckerboardShared;
  const sourceInput = await routeNeutralizeTransparency(input);

  const { data, info } = await sharp(sourceInput)
    .rotate()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .removeAlpha()
    .grayscale()
    .blur(0.7)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const src = data as Buffer;
  const W = info.width | 0;
  const H = info.height | 0;
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

      const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      out[y * W + x] = mag >= opts.edgeThreshold ? 0 : 255;
    }
  }

  return out;
}

async function getMaskForegroundCoverage(maskPng: Buffer): Promise<number> {
  const { getSharp } = await import("~/utils/conversionModules.server");
  const sharp = await getSharp();
  const { data, info } = await sharp(maskPng)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = Math.max(1, info.channels | 0);
  const totalPixels = Math.max(1, (info.width | 0) * (info.height | 0));
  let foregroundPixels = 0;

  for (let i = 0; i < data.length; i += channels) {
    if ((data[i] ?? 255) < 128) foregroundPixels++;
  }

  return foregroundPixels / totalPixels;
}

function extractPathData(svg: string): string {
  const paths: string[] = [];
  const re = /<path\b[^>]*\sd\s*=\s*["']([^"']+)["'][^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = re.exec(svg))) {
    const d = match[1]?.trim();
    if (d) paths.push(d);
  }

  return paths.join(" ");
}

function buildCanvasOutlinePath(width: number, height: number): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  return `M0 0H${w}V${h}H0Z`;
}

function buildPrintThenCutSvg(opts: {
  width: number;
  height: number;
  printableDataUri: string;
  cutPathD: string;
  cutLineColor: string;
  cutLineWidth: number;
  includePrintableBorder: boolean;
  printableBorderColor: string;
  addWhitePage: boolean;
}): string {
  const w = Math.round(opts.width);
  const h = Math.round(opts.height);

  const whitePage = opts.addWhitePage
    ? `  <rect id="preview-white-page" x="0" y="0" width="${w}" height="${h}" fill="#ffffff"/>\n`
    : "";

  const printableBorder = opts.includePrintableBorder
    ? `    <path id="printable-border-fill" d="${escapeXmlAttr(
        opts.cutPathD,
      )}" fill="${opts.printableBorderColor}"/>\n`
    : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Cricut Print Then Cut SVG with printable artwork and cut outline">`,
    `  <title>PNG to SVG for Cricut Print Then Cut</title>`,
    `  <desc>Printable raster artwork is embedded as an image. The cut outline is a separate vector path for Cricut-style Print Then Cut workflows.</desc>`,
    whitePage.trimEnd(),
    `  <g id="printable-artwork">`,
    printableBorder.trimEnd(),
    `    <image id="embedded-print-image" href="${opts.printableDataUri}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"/>`,
    `  </g>`,
    `  <g id="cut-outline" fill="none" stroke="${opts.cutLineColor}" stroke-width="${opts.cutLineWidth}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke">`,
    `    <path id="cut-path" d="${escapeXmlAttr(opts.cutPathD)}"/>`,
    `  </g>`,
    `</svg>`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function clampOutlineSource(value: string): OutlineSource {
  if (
    value === "auto" ||
    value === "transparency" ||
    value === "light" ||
    value === "dark" ||
    value === "edge"
  ) {
    return value;
  }

  return "auto";
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function sanitizeHexColor(value: string, fallback: string): string {
  const v = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return fallback;
}

function escapeXmlAttr(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ========================
   UI types
======================== */
type Settings = {
  outlineSource: OutlineSource;
  cutOffset: number;
  backgroundTolerance: number;
  darkThreshold: number;
  edgeThreshold: number;
  speckCleanup: number;
  curveSmoothness: number;
  cutLineColor: string;
  cutLineWidth: number;
  includePrintableBorder: boolean;
  printableBorderColor: string;
  addWhitePage: boolean;
};

type Preset = {
  id: string;
  label: string;
  category?: string;
  backendIntensity?: PresetBackendIntensity;
  settings: Partial<Settings>;
};

const DEFAULTS: Settings = {
  outlineSource: "auto",
  cutOffset: 18,
  backgroundTolerance: 28,
  darkThreshold: 220,
  edgeThreshold: 42,
  speckCleanup: 5,
  curveSmoothness: 0.7,
  cutLineColor: "#ff00ff",
  cutLineWidth: 1,
  includePrintableBorder: true,
  printableBorderColor: "#ffffff",
  addWhitePage: false,
};

const PRESETS: Preset[] = [
  {
    id: "sticker-clean-offset",
    label: "Sticker - Clean Offset (default)",
    settings: {
      outlineSource: "auto",
      cutOffset: 18,
      backgroundTolerance: 28,
      darkThreshold: 220,
      edgeThreshold: 42,
      speckCleanup: 5,
      curveSmoothness: 0.7,
      includePrintableBorder: true,
      printableBorderColor: "#ffffff",
      addWhitePage: false,
    },
  },
  {
    id: "transparent-best-edge",
    label: "Transparent PNG - Best Cut Edge",
    settings: {
      outlineSource: "transparency",
      cutOffset: 12,
      backgroundTolerance: 20,
      speckCleanup: 4,
      curveSmoothness: 0.55,
      includePrintableBorder: false,
      addWhitePage: false,
    },
  },
  {
    id: "white-background-remove",
    label: "White Background - Remove Edge",
    settings: {
      outlineSource: "light",
      cutOffset: 18,
      backgroundTolerance: 40,
      speckCleanup: 6,
      curveSmoothness: 0.75,
      includePrintableBorder: true,
      printableBorderColor: "#ffffff",
      addWhitePage: false,
    },
  },
  {
    id: "sticker-larger-border",
    label: "Sticker - Larger Border",
    settings: {
      outlineSource: "auto",
      cutOffset: 34,
      backgroundTolerance: 32,
      speckCleanup: 6,
      curveSmoothness: 0.9,
      includePrintableBorder: true,
      printableBorderColor: "#ffffff",
      addWhitePage: false,
    },
  },
  {
    id: "tight-edge",
    label: "Print Then Cut - Tight Edge",
    settings: {
      outlineSource: "auto",
      cutOffset: 4,
      backgroundTolerance: 25,
      speckCleanup: 3,
      curveSmoothness: 0.45,
      includePrintableBorder: false,
      addWhitePage: false,
    },
  },
  {
    id: "dark-artwork",
    label: "Dark Artwork - Threshold Cut",
    settings: {
      outlineSource: "dark",
      cutOffset: 14,
      darkThreshold: 210,
      speckCleanup: 4,
      curveSmoothness: 0.65,
      includePrintableBorder: true,
      printableBorderColor: "#ffffff",
      addWhitePage: false,
    },
  },
  {
    id: "photo-art-edge",
    label: "Photo / Art - Edge Outline",
    settings: {
      outlineSource: "edge",
      cutOffset: 22,
      edgeThreshold: 36,
      speckCleanup: 7,
      curveSmoothness: 1,
      includePrintableBorder: true,
      printableBorderColor: "#ffffff",
      addWhitePage: false,
    },
  },
  {
    id: "white-page-preview",
    label: "White Page Preview",
    settings: {
      outlineSource: "auto",
      cutOffset: 18,
      backgroundTolerance: 28,
      speckCleanup: 5,
      curveSmoothness: 0.7,
      includePrintableBorder: true,
      printableBorderColor: "#ffffff",
      addWhitePage: true,
    },
  },
];

const DISPLAY_PRESETS: Preset[] = [
  ...PRESETS,
  {
    id: "ptc-clean-cut",
    label: "Cricut - Clean Cut",
    category: "diagram",
    backendIntensity: "high-speed",
    settings: {
      outlineSource: "auto",
      cutOffset: 18,
      backgroundTolerance: 24,
      darkThreshold: 220,
      edgeThreshold: 42,
      speckCleanup: 6,
      curveSmoothness: 0.75,
      includePrintableBorder: true,
      printableBorderColor: "#ffffff",
      addWhitePage: false,
    },
  },
  {
    id: "ptc-tight-cut",
    label: "Cricut - Fine Detail",
    category: "diagram",
    backendIntensity: "low-speed",
    settings: {
      outlineSource: "auto",
      cutOffset: 8,
      backgroundTolerance: 20,
      darkThreshold: 226,
      edgeThreshold: 38,
      speckCleanup: 3,
      curveSmoothness: 0.48,
      includePrintableBorder: false,
      addWhitePage: false,
    },
  },
  {
    id: "ptc-bold-cut",
    label: "Cricut - Bold Cut",
    category: "diagram",
    backendIntensity: "high-speed",
    settings: {
      outlineSource: "auto",
      cutOffset: 30,
      backgroundTolerance: 32,
      darkThreshold: 210,
      edgeThreshold: 46,
      speckCleanup: 7,
      curveSmoothness: 0.92,
      includePrintableBorder: true,
      printableBorderColor: "#ffffff",
      addWhitePage: false,
    },
  },
  {
    id: "ptc-transparent-clean",
    label: "Transparent - Clean",
    category: "diagram",
    backendIntensity: "extreme-speed",
    settings: {
      outlineSource: "transparency",
      cutOffset: 14,
      backgroundTolerance: 18,
      speckCleanup: 4,
      curveSmoothness: 0.58,
      includePrintableBorder: false,
      addWhitePage: false,
    },
  },
  {
    id: "ptc-sticker-outline",
    label: "Sticker - Thick Outline",
    category: "diagram",
    backendIntensity: "high-speed",
    settings: {
      outlineSource: "auto",
      cutOffset: 28,
      backgroundTolerance: 28,
      edgeThreshold: 40,
      speckCleanup: 6,
      curveSmoothness: 0.86,
      includePrintableBorder: true,
      printableBorderColor: "#ffffff",
      addWhitePage: false,
    },
  },
  {
    id: "ptc-low-light",
    label: "Photo Edge - Low Light",
    category: "photo-edge",
    backendIntensity: "low-speed",
    settings: {
      outlineSource: "edge",
      cutOffset: 22,
      backgroundTolerance: 34,
      darkThreshold: 196,
      edgeThreshold: 28,
      speckCleanup: 8,
      curveSmoothness: 1,
      includePrintableBorder: true,
      printableBorderColor: "#ffffff",
      addWhitePage: false,
    },
  },
  {
    id: "ptc-white-remove-soft",
    label: "White Remove - Soft",
    category: "scan",
    backendIntensity: "high-speed",
    settings: {
      outlineSource: "light",
      cutOffset: 16,
      backgroundTolerance: 30,
      speckCleanup: 5,
      curveSmoothness: 0.68,
      includePrintableBorder: true,
      printableBorderColor: "#ffffff",
      addWhitePage: false,
    },
  },
  {
    id: "ptc-white-remove-strong",
    label: "White Remove - Strong",
    category: "scan",
    backendIntensity: "high-speed",
    settings: {
      outlineSource: "light",
      cutOffset: 20,
      backgroundTolerance: 52,
      speckCleanup: 8,
      curveSmoothness: 0.82,
      includePrintableBorder: true,
      printableBorderColor: "#ffffff",
      addWhitePage: false,
    },
  },
  {
    id: "ptc-preview-white",
    label: "White Page - Preview",
    category: "diagram",
    backendIntensity: "extreme-speed",
    settings: {
      addWhitePage: true,
      includePrintableBorder: true,
      printableBorderColor: "#ffffff",
    },
  },
];

type ServerResult = {
  svg?: string;
  error?: string;
  width?: number;
  height?: number;
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
  retryAfterMs?: number;
  code?: string;
  gate?: { running: number; queued: number };
};

type HistoryItem = {
  svg: string;
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
  stamp: number;
  settingsSnapshot: Settings;
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
  if (mode === "medium") {
    return "Large file; updates run less frequently to keep things smooth.";
  }

  return "";
}

/* ========================
   Component
======================== */
export default function PngToSvgForCricutPrintThenCut({
  loaderData,
}: Route.ComponentProps) {
  const fetcher = useHybridTraceFetcher<ServerResult>({ routeId: "png-to-svg-for-cricut-print-then-cut" });

  const [file, setFile] = React.useState<File | null>(null);
  const [originalFileSize, setOriginalFileSize] = React.useState<number | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] = React.useState<string>(
    "sticker-clean-offset",
  );
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [dims, setDims] = React.useState<{
    w: number;
    h: number;
    mp: number;
  } | null>(null);
  const [hydrated, setHydrated] = React.useState(false);
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [fullscreenPreviewIndex, setFullscreenPreviewIndex] = React.useState<
    number | null
  >(null);
  const [autoMode, setAutoMode] = React.useState<AutoMode>("off");
  const [toast, setToast] = React.useState<string | null>(null);
  const [openSettingsStamp, setOpenSettingsStamp] = React.useState<
    number | null
  >(null);

  const busy = fetcher.state !== "idle";
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressLiveRef = React.useRef(false);
  const lastSubmittedSettingsRef = React.useRef<Settings>(DEFAULTS);
  const pendingReplaceStampRef = React.useRef<number | null>(null);

  React.useEffect(() => setHydrated(true), []);

  React.useEffect(() => {
    if (suppressLiveRef.current) return;
    if (!file) return;

    const mode = autoMode;
    if (mode === "off") return;

    const delay = mode === "fast" ? LIVE_FAST_MS : LIVE_MED_MS;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      void submitConvert(file, settings);
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, autoMode]);

  React.useEffect(() => {
    if (fetcher.data?.svg) {
      const item: HistoryItem = {
        svg: fetcher.data.svg,
        width: fetcher.data.width ?? 0,
        height: fetcher.data.height ?? 0,
        engineUsed: fetcher.data.engineUsed,
        sourceKind: fetcher.data.sourceKind,
        warnings: fetcher.data.warnings,
        timings: fetcher.data.timings,
        layerBuildMode: fetcher.data.layerBuildMode,
        requestedPaletteCount: fetcher.data.requestedPaletteCount,
        actualPaletteCount: fetcher.data.actualPaletteCount,
        outputDetectedColors: fetcher.data.outputDetectedColors,
        pathCount: fetcher.data.pathCount,
        svgBytes: fetcher.data.svgBytes,
        stamp: Date.now(),
        settingsSnapshot: lastSubmittedSettingsRef.current,
      };

      const replaceStamp = pendingReplaceStampRef.current;
      pendingReplaceStampRef.current = null;
      if (replaceStamp) {
        setHistory((prev) => {
          let replaced = false;
          const next = prev.map((candidate) => {
            if (candidate.stamp !== replaceStamp) return candidate;
            replaced = true;
            return { ...item, stamp: candidate.stamp };
          });
          return replaced ? next : [item, ...prev].slice(0, 10);
        });
        setOpenSettingsStamp(replaceStamp);
      } else {
        setHistory((prev) => [item, ...prev].slice(0, 10));
      }
    }
  }, [fetcher.data?.svg, fetcher.data?.width, fetcher.data?.height]);

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
    try {
      const { w, h } = await getImageSize(f);
      const mp = (w * h) / 1_000_000;
      setDims({ w, h, mp });
    } catch {
      setDims(null);
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
    if (!ALLOWED_MIME.has(f.type)) {
      setErr("Please choose a PNG or JPEG.");
      return;
    }

    suppressLiveRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    setFile(null);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);

    setSettings(DEFAULTS);
    setActivePreset("sticker-clean-offset");
    setHistory([]);
    setOpenSettingsStamp(null);
    setErr(null);
    setInfo(null);
    setDims(null);
    setOriginalFileSize(f.size);

    let chosen = f;

    try {
      await validateBeforeSubmit(f);
    } catch (e: any) {
      if (f.size > LIVE_MED_MAX && f.size <= MAX_UPLOAD_BYTES) {
        try {
          setInfo("Large image detected. Compressing locally for preview.");
          chosen = await compressToTarget25MB(f);
          await validateBeforeSubmit(chosen);
          setInfo(
            `Compressed locally from ${prettyBytes(f.size)} to ${prettyBytes(
              chosen.size,
            )}.`,
          );
        } catch (compressErr: any) {
          setErr(
            compressErr?.message ||
              "Image is too large. Resize it before uploading.",
          );
          suppressLiveRef.current = false;
          return;
        }
      } else {
        setErr(e?.message || "Image is too large.");
        suppressLiveRef.current = false;
        return;
      }
    }

    setFile(chosen);
    setAutoMode(getAutoMode(chosen.size));

    const url = URL.createObjectURL(chosen);
    setPreviewUrl(url);

    await measureAndSet(chosen);

    suppressLiveRef.current = false;
    void submitConvert(chosen, DEFAULTS);
  }

  async function submitConvert(
    targetFile?: File | null,
    settingsOverride?: Settings,
    replaceStamp?: number | null,
  ) {
    const currentFile = targetFile || file;
    const currentSettings = settingsOverride ?? settings;

    if (!currentFile) {
      setErr("Choose an image first.");
      return;
    }

    try {
      await validateBeforeSubmit(currentFile);
    } catch (e: any) {
      setErr(e?.message || "Image is too large.");
      return;
    }

    const fd = new FormData();
    fd.append("file", currentFile);
    fd.append("outlineSource", currentSettings.outlineSource);
    fd.append("cutOffset", String(currentSettings.cutOffset));
    fd.append("backgroundTolerance", String(currentSettings.backgroundTolerance));
    fd.append("darkThreshold", String(currentSettings.darkThreshold));
    fd.append("edgeThreshold", String(currentSettings.edgeThreshold));
    fd.append("speckCleanup", String(currentSettings.speckCleanup));
    fd.append("curveSmoothness", String(currentSettings.curveSmoothness));
    fd.append("cutLineColor", currentSettings.cutLineColor);
    fd.append("cutLineWidth", String(currentSettings.cutLineWidth));
    fd.append(
      "includePrintableBorder",
      String(currentSettings.includePrintableBorder),
    );
    fd.append("printableBorderColor", currentSettings.printableBorderColor);
    fd.append("addWhitePage", String(currentSettings.addWhitePage));

    setErr(null);
    lastSubmittedSettingsRef.current = currentSettings;
    pendingReplaceStampRef.current = replaceStamp ?? null;

    fd.append("presetId", activePreset);


    


    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action: `${window.location.pathname}?index`,
    });
  }

  function applyPreset(preset: Preset) {
    const nextSettings = {
      ...DEFAULTS,
      ...preset.settings,
    } as Settings;
    setActivePreset(preset.id);
    setSettings(nextSettings);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (file && autoMode !== "off") {
      void submitConvert(file, nextSettings);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  function handleCopySvg(svg: string) {
    navigator.clipboard.writeText(svg).then(() => {
      showToast("SVG copied");
    });
  }

  const buttonDisabled = isServer || !hydrated || busy || !file;

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
            <div className="order-1 min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] sm:border sm:border-slate-200">
              <h1 className="inline-flex text-center w-full justify-center mb-3 text-sky-950 items-center gap-2 text-xl sm:text-3xl font-extrabold leading-none m-0">
                PNG to SVG for Cricut Print Then Cut
              </h1>

              <p className="mb-3 text-sm text-slate-600 text-center">
                Preserve the printable image colors and add a traced SVG cut
                outline for Cricut Print Then Cut style projects.
              </p>

              <PresetPicker
                presets={DISPLAY_PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />

              <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-[13px] text-slate-700 mt-3">
                <b>What this creates:</b> one SVG with the original artwork
                embedded as a printable image and a separate vector cut outline.
                It is not a layered vinyl converter.
              </div>

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
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#f7faff] border border-[#dae6ff] text-slate-900 mt-3">
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
                        setHistory([]);
                        setOpenSettingsStamp(null);
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

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => submitConvert(file)}
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
                  {busy ? "Creating SVG…" : "Create Print Then Cut SVG"}
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

              {previewUrl && (
                <div className="hidden md:flex flex-col mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <p className="text-slate-700 ml-2 mt-1">
                    Original image preview:
                  </p>
                  <img
                    src={previewUrl}
                    alt="Input"
                    className="relative w-full h-auto block transparent-checkerboard"
                  />
                </div>
              )}
            </div>

            <div className="order-2 min-w-0 overflow-auto rounded-2xl border border-slate-300/40 bg-[#43546b] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:sticky md:top-4 md:row-span-3 md:max-h-[calc(100vh-2rem)] md:self-start">
              {busy && (
                <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
              )}

              {history.length > 0 ? (
                <div className="grid gap-3">
                  {history.map((item, index) => (
                    <div
                      key={item.stamp}
                      data-engine-used={item.engineUsed || "potrace"}
                      data-source-kind={item.sourceKind || "raster"}
                      data-engine-warnings={(item.warnings || []).join(" | ")}
                      className="rounded-xl border border-slate-200 bg-white p-2"
                    >
                      <div className="flex gap-3 items-center flex-wrap justify-between">
                        <span className="text-[13px] text-slate-700">
                          {item.width > 0 && item.height > 0
                            ? `${item.width} × ${item.height} px`
                            : "size unknown"}
                        </span>
                        <span className="text-[12px] text-slate-500">
                          Includes embedded image + vector cut outline
                        </span>
                      </div>

                      <div className="flex gap-2 flex-wrap my-2">
                        <button
                          type="button"
                          onClick={() => {
                            const b = new Blob([item.svg], {
                              type: "image/svg+xml;charset=utf-8",
                            });
                            const u = URL.createObjectURL(b);
                            const a = document.createElement("a");
                            a.href = u;
                            a.download = "print-then-cut.svg";
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
                          Download SVG
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopySvg(item.svg)}
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
                          onClick={() => {
                            setSettings(item.settingsSnapshot);
                            setOpenSettingsStamp((current) =>
                              current === item.stamp ? null : item.stamp,
                            );
                          }}
                          aria-expanded={openSettingsStamp === item.stamp}
                          aria-controls={`output-settings-${item.stamp}`}
                          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-950 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                        >
                          <Icons
                            name="settings"
                            size={16}
                            className="mr-1 inline-block"
                          />
                          Settings
                        </button>
                      </div>

                      {openSettingsStamp === item.stamp && (
                        <div
                          id={`output-settings-${item.stamp}`}
                          className="mb-2 rounded-xl border border-sky-200 bg-sky-50/70 p-3"
                        >
                          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="m-0 text-base font-bold text-sky-950">
                                Settings
                              </h3>
                              <p className="m-0 mt-1 text-[13px] text-slate-600">
                                These settings regenerate this output card only.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                void submitConvert(file, settings, item.stamp)
                              }
                              disabled={buttonDisabled}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 cursor-pointer transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Update preview
                            </button>
                          </div>
                          <PrintThenCutSettingsFields
                            settings={settings}
                            setSettings={setSettings}
                          />
                        </div>
                      )}

                      <div className="relative rounded-xl border border-slate-200 bg-white transparent-checkerboard min-h-[240px] flex items-center justify-center p-2">
                        <FullscreenPreviewButton onOpen={() => setFullscreenPreviewIndex(index)} />
                        <EditedSvgPreviewImage
                          svg={item.svg}
                          alt="Print Then Cut SVG result"
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
                  {busy
                    ? "Creating Print Then Cut SVG…"
                    : "Print Then Cut SVG previews appear here..."}
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
            svg: item.svg,
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

      <AffiliateCta />
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

async function validateBeforeSubmit(file: File) {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Only PNG or JPEG images are allowed.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File too large. Max 30 MB per image.");
  }

  const { w, h } = await getImageSize(file);

  if (!w || !h) {
    throw new Error("Could not read image dimensions.");
  }

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

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", {
    alpha: false,
    willReadFrequently: false,
  });

  if (!ctx) {
    throw new Error("Could not prepare image compression.");
  }

  const qualitySteps = [0.92, 0.86, 0.8, 0.74, 0.68, 0.62];

  for (let scale = 1; scale >= 0.35; scale -= 0.1) {
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img as any, 0, 0, canvas.width, canvas.height);

    for (const q of qualitySteps) {
      const blob = await canvasToBlob(canvas, "image/jpeg", q);

      if (blob.size <= TARGET) {
        const name = file.name.replace(/\.(png|jpg|jpeg)$/i, "") + ".jpg";
        return new File([blob], name, { type: "image/jpeg" });
      }
    }
  }

  throw new Error(
    "Could not compress this image enough for live preview. Resize it and try again.",
  );
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image."));
    };

    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not compress image."));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });
}

function prettyBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let size = n;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }

  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/* ========================
   Page sections
======================== */
function AffiliateCta() {
  return (
    <section className="bg-white border-y border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
            Print then cut next step
          </p>
          <h2 className="mt-1 text-xl md:text-2xl font-extrabold text-sky-950">
            Turning this design into printed stickers or labels?
          </h2>
          <p className="mt-2 text-sm text-slate-700 max-w-[78ch]">
            After creating your Cricut-ready file, check that the artwork stays
            clear at the final print size and that the cut border has enough
            breathing room before ordering stickers, labels, or decals.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href="https://www.stickermule.com/unlock?ref_id=3327990701&utm_source=invite"
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white border border-sky-600 cursor-pointer transition-colors hover:bg-sky-600"
            >
              Get $10 Sticker Mule credit
            </a>
            <span className="text-xs text-slate-500">
              Affiliate link. iLoveSVG may earn a commission at no extra cost to
              you.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SeoSections() {
  return (
    <section className="bg-slate-50 text-[#0f2537]">
      <div className="max-w-[1180px] mx-auto px-4 py-10">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 md:p-8 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
            Cricut Print Then Cut SVG maker
          </p>

          <h2 className="mt-2 text-2xl md:text-3xl font-extrabold text-sky-950">
            Create printable SVG artwork with a separate cut outline
          </h2>

          <p className="mt-3 text-slate-700 max-w-[85ch]">
            This page is for Cricut-style Print Then Cut prep: keep the original
            PNG or JPG artwork as the printable image, then generate a vector
            outline around it. That is different from a single-color cut file
            and different from a layered vinyl SVG.
          </p>

          <p className="mt-3 text-slate-700 max-w-[85ch]">
            Use it for sticker sheets, planner stickers, labels, small business
            packaging, classroom cutouts, party printables, and craft artwork
            where the colors should remain printable.
          </p>

          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ["Preserve colors", "Embeds the printable image"],
              ["Cut outline", "Adds a traced SVG path"],
              ["Offset control", "Tight edge or sticker border"],
              ["Cricut-focused", "Built for craft prep"],
            ].map(([title, body]) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <h3 className="font-bold text-sky-950">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{body}</p>
              </div>
            ))}
          </div>
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

          <section className="mt-10">
            <h3 className="text-xl font-bold text-sky-950">
              Best for Print Then Cut and sticker-style projects
            </h3>
            <p className="mt-2 text-sm text-slate-700 max-w-[85ch]">
              This converter is best when you want the artwork to stay
              full-color but still need a vector cut path around the design. For
              plain vinyl decals, use a single-color Cricut SVG converter. For
              separate vinyl colors, use a layered SVG converter.
            </p>

            <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                "Sticker artwork",
                "Planner stickers",
                "Product labels",
                "Party printables",
                "Classroom cutouts",
                "Small business packaging",
                "White-border stickers",
                "Transparent PNG designs",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700"
                >
                  {item}
                </div>
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
                How to make a Print Then Cut SVG
              </h3>
              <span className="text-xs text-slate-500">
                Upload → choose outline source → set offset → export SVG
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload a PNG or JPG",
                  body: "Transparent PNGs usually produce the cleanest cut outline. JPG files with white backgrounds can work with the light background setting.",
                },
                {
                  title: "Choose the right preset",
                  body: "Start with Clean Offset for stickers, Transparent PNG for artwork that already has transparency, or White Background for images on a white page.",
                },
                {
                  title: "Adjust the cut offset",
                  body: "Use a small offset for tight cuts and a larger offset for a white sticker-style border.",
                },
                {
                  title: "Tune cleanup and smoothing",
                  body: "Increase speck cleanup if the outline has dust or small islands. Increase curve smoothness if the cut path is too jagged.",
                },
                {
                  title: "Download and inspect in Design Space",
                  body: "The SVG contains a printable image and a cut outline group. Always verify the final operation and layer behavior before printing expensive sticker paper.",
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
              Settings explained
            </h3>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Cut outline source",
                  body: "Auto uses transparency when available. Use light background for artwork on white, dark artwork for silhouette-like images, and edge outline for photos or drawings.",
                },
                {
                  title: "Cut offset",
                  body: "Expands the detected printable area before tracing. Higher values create a larger sticker border.",
                },
                {
                  title: "Background tolerance",
                  body: "Controls how aggressively near-white pixels are treated as background for JPGs or flattened artwork.",
                },
                {
                  title: "Dark threshold",
                  body: "Controls which pixels count as artwork when tracing dark designs or edge-based images.",
                },
                {
                  title: "Speck cleanup",
                  body: "Removes tiny cut islands that can make sticker outlines messy or hard to manage.",
                },
                {
                  title: "Curve smoothness",
                  body: "Higher values simplify the outline. Lower values preserve more detail but can create more nodes.",
                },
              ].map((s) => (
                <div
                  key={s.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h4 className="font-bold text-sky-950">{s.title}</h4>
                  <p className="mt-1 text-sm text-slate-600">{s.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="text-lg font-bold text-sky-950">
              Important limitations
            </h3>
            <p className="mt-2 text-sm text-slate-700">
              This tool creates a practical SVG package for Print Then Cut style
              prep. It embeds a raster PNG inside the SVG to preserve color,
              then adds a vector outline. It does not magically turn a complex
              photo into fully editable vector color artwork.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Cricut Design Space may still require you to confirm operations,
              flatten or attach layers, or adjust sizing after import. Always
              test the SVG before using premium vinyl, printable sticker paper,
              or commercial packaging materials.
            </p>
          </section>

          <CurrentRouteGuide />

          <section
            className="mt-12"
            itemScope
            itemType="https://schema.org/FAQPage"
          >
            <h3 className="text-lg font-bold text-sky-950">FAQ</h3>

            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "Does this preserve the original colors?",
                  a: "Yes. The printable artwork is embedded as a PNG inside the SVG, so the visual colors are preserved for printing. The cut line is a separate vector path.",
                },
                {
                  q: "Is this the same as a layered SVG?",
                  a: "No. This is for Print Then Cut style files. A layered SVG separates colors into vector layers for vinyl or HTV.",
                },
                {
                  q: "Why does my cut outline include the background?",
                  a: "Use Transparent PNG when your image has transparency. For JPGs or flattened PNGs, use Light Background and increase or decrease background tolerance until the white area is ignored.",
                },
                {
                  q: "Should I use a transparent PNG?",
                  a: "Yes, when possible. Transparent PNGs usually create cleaner sticker and Print Then Cut outlines than JPGs on white backgrounds.",
                },
                {
                  q: "Is this affiliated with Cricut?",
                  a: "No. iLoveSVG is an independent SVG utility site and is not affiliated with Cricut.",
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

function PrintThenCutSettingsFields({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}) {
  return (
    <div className="grid gap-2 min-w-0">
      <Field label="Cut outline source">
        <select
          value={settings.outlineSource}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              outlineSource: e.target.value as OutlineSource,
            }))
          }
          className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
        >
          <option value="auto">Auto - transparency first, then background</option>
          <option value="transparency">Transparent PNG</option>
          <option value="light">Light / white background removal</option>
          <option value="dark">Dark artwork threshold</option>
          <option value="edge">Photo / art edge outline</option>
        </select>
      </Field>

      <Field label={`Cut offset (${settings.cutOffset}px)`}>
        <input
          type="range"
          min={0}
          max={96}
          step={1}
          value={settings.cutOffset}
          onChange={(e) =>
            setSettings((s) => ({ ...s, cutOffset: Number(e.target.value) }))
          }
          className="w-full accent-[#2563eb]"
        />
      </Field>

      <Field label={`Background tolerance (${settings.backgroundTolerance})`}>
        <Num
          value={settings.backgroundTolerance}
          min={0}
          max={120}
          step={1}
          onChange={(v) =>
            setSettings((s) => ({ ...s, backgroundTolerance: v }))
          }
        />
      </Field>

      <Field label={`Dark threshold (${settings.darkThreshold})`}>
        <Num
          value={settings.darkThreshold}
          min={0}
          max={255}
          step={1}
          onChange={(v) => setSettings((s) => ({ ...s, darkThreshold: v }))}
        />
      </Field>

      <Field label={`Edge threshold (${settings.edgeThreshold})`}>
        <Num
          value={settings.edgeThreshold}
          min={1}
          max={255}
          step={1}
          onChange={(v) => setSettings((s) => ({ ...s, edgeThreshold: v }))}
        />
      </Field>

      <Field label={`Speck cleanup (${settings.speckCleanup})`}>
        <Num
          value={settings.speckCleanup}
          min={0}
          max={40}
          step={1}
          onChange={(v) => setSettings((s) => ({ ...s, speckCleanup: v }))}
        />
      </Field>

      <Field label={`Curve smoothness (${settings.curveSmoothness})`}>
        <Num
          value={settings.curveSmoothness}
          min={0.05}
          max={2.5}
          step={0.05}
          onChange={(v) => setSettings((s) => ({ ...s, curveSmoothness: v }))}
        />
      </Field>

      <Field label="Cut line color">
        <input
          type="color"
          value={settings.cutLineColor}
          onChange={(e) =>
            setSettings((s) => ({ ...s, cutLineColor: e.target.value }))
          }
          className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer"
        />
      </Field>

      <Field label={`Cut line width (${settings.cutLineWidth})`}>
        <Num
          value={settings.cutLineWidth}
          min={0.25}
          max={12}
          step={0.25}
          onChange={(v) => setSettings((s) => ({ ...s, cutLineWidth: v }))}
        />
      </Field>

      <Field label="Printable border">
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="checkbox"
            checked={settings.includePrintableBorder}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                includePrintableBorder: e.target.checked,
              }))
            }
            className="h-4 w-4 accent-[#2563eb] cursor-pointer"
          />
          <span className="text-[13px] text-slate-700">
            Add printable border behind artwork
          </span>
          <input
            type="color"
            value={settings.printableBorderColor}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                printableBorderColor: e.target.value,
              }))
            }
            aria-disabled={!settings.includePrintableBorder}
            className={[
              "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer",
              !settings.includePrintableBorder
                ? "opacity-50 pointer-events-none"
                : "",
            ].join(" ")}
          />
        </div>
      </Field>

      <Field label="Preview page">
        <label className="inline-flex items-center gap-2 text-[13px] text-slate-700">
          <input
            type="checkbox"
            checked={settings.addWhitePage}
            onChange={(e) =>
              setSettings((s) => ({ ...s, addWhitePage: e.target.checked }))
            }
            className="h-4 w-4 accent-[#2563eb] cursor-pointer"
          />
          Add white page rectangle behind the preview
        </label>
      </Field>
    </div>
  );
}

/* ========================
   Small UI components
======================== */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 items-center rounded-lg border border-slate-200 bg-white px-3 py-2">
      <span className="text-[13px] font-semibold text-slate-700">{label}</span>
      <div className="min-w-0">{children}</div>
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
      className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
    />
  );
}
