import * as React from "react";
import type { Route } from "./+types/black-and-white-image-to-svg-converter";
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
import { ContextualAdCard } from "~/client/components/ads/ContextualAdCard";
import { PresetPicker } from "~/client/components/converter/PresetSelector";
import {
  FullscreenOutputPreview,
} from "~/client/components/converter/FullscreenOutputPreview";
import { getEditedSvg } from "~/client/components/svg/EditedSvgPreviewImage";
import {
  BespokeTraceOutputPanel,
  getBespokeTraceOutputSvg,
} from "~/client/components/converter/BespokeTraceOutputPanel";
import {
  createOutputSourceSnapshot,
  cleanupUnusedSourceSnapshots,
  type OutputSourceSnapshot,
} from "~/client/lib/converter/sourceSnapshots";
import { trimOutputHistory } from "~/client/lib/converter/outputHistory";
import type { PresetBackendIntensity } from "~/client/lib/converter/presetIntensity";
import { STROKE_TRACE_PRESET_ADDITIONS } from "~/client/lib/converter/presetAdditions";
import { useHybridTraceFetcher } from "~/client/lib/tracing/useHybridTraceFetcher";

const isServer = typeof document === "undefined";

export function meta({}: Route.MetaArgs) {
  const title = "Black and White Image to SVG Converter | iLoveSVG";
  const description =
    "Convert black and white PNG or JPEG images to SVG with threshold, noise cleanup, editable output, copy, download, and preview controls.";
  const canonical =
    "https://www.ilovesvg.com/black-and-white-image-to-svg-converter";

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

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_MP = 30;
const MAX_SIDE = 8000;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/svg+xml"]);
const RASTER_MIME = new Set(["image/png", "image/jpeg"]);

const DARK_BG_DEFAULT = "#0b1020";

const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 400;
const LIVE_MED_MS = 1500;
const COLOR_UPDATE_THROTTLE_MS = 100;

type TraceMode = "single" | "layered";
type SvgLayerKind = "fill" | "stroke";

type SvgLayerMeta = {
  id: string;
  label: string;
  color: string;
  originalColor: string;
  visible: boolean;
  pathTags?: string;
  kind?: SvgLayerKind;
};

type EditableSvgLayer = SvgLayerMeta;

type LayeredTraceResult = {
  svg: string;
  width: number;
  height: number;
  layers: EditableSvgLayer[];
};

type TurnPolicy =
  | "black"
  | "white"
  | "left"
  | "right"
  | "minority"
  | "majority";

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

    const { checkBackendConversionRateLimit } = await import(
      "~/utils/backendSecurity.server"
    );
    const rateLimit = checkBackendConversionRateLimit(
      request,
      "black-and-white-image-to-svg-converter",
      "raster-trace",
    );
    if (!rateLimit.allowed) {
      return json(
        {
          error: `Too many conversions from this connection. Please try again in ${rateLimit.retryAfterText}.`,
          retryAfterMs: rateLimit.retryAfterSeconds * 1000,
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
    const fileName = String((webFile as any).name || "").toLowerCase();
    const isSvgUpload =
      webFile.type === "image/svg+xml" || fileName.endsWith(".svg");

    if (!ALLOWED_MIME.has(webFile.type) && !isSvgUpload) {
      return json(
        { error: "Only PNG, JPEG, or SVG images are allowed." },
        { status: 415 },
      );
    }
    if ((webFile.size || 0) > MAX_UPLOAD_BYTES) {
      return json(
        {
          error: `File too large. Max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB per image.`,
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
          headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        },
      );
    }

    try {
      const ab = await webFile.arrayBuffer();
      // @ts-ignore
      const input: Buffer = Buffer.from(ab);

      const { validateFileSignature } = await import("~/utils/backendSecurity.server");
      const signatureError = validateFileSignature(input, webFile, ALLOWED_MIME);
      if (signatureError) return signatureError;

      const traceMode = String(form.get("traceMode") ?? "single") as TraceMode;
      const threshold = clampInt(Number(form.get("threshold") ?? 200), 0, 255);
      const turdSize = clampInt(Number(form.get("turdSize") ?? 2), 0, 10);
      const optTolerance = clampNum(
        Number(form.get("optTolerance") ?? 0.28),
        0.05,
        1.2,
      );
      const turnPolicy = String(
        form.get("turnPolicy") ?? "minority",
      ) as TurnPolicy;

      const binaryMode =
        String(form.get("binaryMode") ?? "true").toLowerCase() === "true";
      const binaryInvertInput =
        String(form.get("binaryInvertInput") ?? "false").toLowerCase() ===
        "true";

      let lineColor =
        normalizeHexColor(String(form.get("lineColor") ?? "#000000")) ||
        "#000000";
      let transparent =
        String(form.get("transparent") ?? "true").toLowerCase() === "true";
      let bgColor =
        normalizeHexColor(String(form.get("bgColor") ?? "#ffffff")) ||
        "#ffffff";

      if (isSvgUpload) {
        const rawSvg = input.toString("utf8");
        const { sanitizeVisibleSvgMarkup } = await import("~/utils/svgSanitize.server");
        const sanitizedSvg = sanitizeVisibleSvgMarkup(rawSvg);
        if (!sanitizedSvg.ok) {
          return json(
            { error: sanitizedSvg.message, code: sanitizedSvg.code },
            { status: 415 },
          );
        }
        const annotated = annotateSvgEditableLayers(sanitizedSvg.svg);
        const ensured = ensureViewBoxResponsive(annotated.svg);
        return json({
          svg: ensured.svg,
          width: ensured.width,
          height: ensured.height,
          layers: annotated.layers,
          engineUsed: "potrace",
          sourceKind: "svg",
          gate: { running: gate.running, queued: gate.queued },
        });
      }

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
              error: `Image too large: ${w}×${h} (~${mp.toFixed(1)} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
            },
            { status: 413 },
          );
        }
      } catch {}

      if (traceMode === "layered") {
        const layered = await traceLayeredColorSvg(input, {
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
          minRegionPercent: clampNum(
            Number(form.get("minRegionPercent") ?? 0.35),
            0,
            10,
          ),
          layerOptTolerance: clampNum(
            Number(form.get("layerOptTolerance") ?? 0.45),
            0.05,
            1.5,
          ),
          layerTurdSize: clampInt(
            Number(form.get("layerTurdSize") ?? 4),
            0,
            20,
          ),
          layerTurnPolicy: String(
            form.get("layerTurnPolicy") ?? "majority",
          ) as TurnPolicy,
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
          engineUsed: "potrace",
          sourceKind: "raster",
          gate: { running: gate.running, queued: gate.queued },
        });
      }

      const whiteOnDark =
        String(form.get("invert") ?? "false").toLowerCase() === "true";

      if (whiteOnDark) {
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

      const prepped = await normalizeForPotraceBW(input, {
        binaryMode,
        threshold,
        invertInput: binaryInvertInput,
      });

      const svgRaw = await runPotrace(prepped, {
        color: "#000000",
        threshold: 128,
        turdSize,
        optTolerance,
        turnPolicy,
        invert: false,
        blackOnWhite: true,
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
      const layer: EditableSvgLayer = {
        id: "trace-color",
        label: "Trace color",
        color: lineColor,
        originalColor: lineColor,
        visible: true,
        kind: "fill",
      };
      const editableSvg = routeAnnotateSingleTrace(finalSVG, layer);

      return json({
        svg: editableSvg,
        width: ensured.width,
        height: ensured.height,
        layers: [layer],
        engineUsed: "potrace",
        sourceKind: "raster",
        gate: { running: gate.running, queued: gate.queued },
      });
    } finally {
      try {
        release?.();
      } catch {}
    }
  } catch (err: any) {
    const {
      createInvalidUploadDecodeResponse,
      isInvalidUploadDecodeError,
      safeErrorMessage,
    } = await import("~/utils/backendSecurity.server");
    if (isInvalidUploadDecodeError(err)) {
      return createInvalidUploadDecodeResponse();
    }
    return json(
      { error: safeErrorMessage(err?.message || "Server error during conversion.", "Server error during conversion.") },
      { status: 500 },
    );
  }
}

async function normalizeForPotraceBW(
  input: Buffer,
  opts: { binaryMode: boolean; threshold: number; invertInput: boolean },
): Promise<Buffer> {
  try {
    const { getSharp } = await import("~/utils/conversionModules.server");
      const sharp = await getSharp();

    try {
      (sharp as any).concurrency?.(1);
      (sharp as any).cache?.({ files: 0, memory: 32 });
    } catch {}

    const routeNeutralizeTransparency = neutralizeTransparencyCheckerboardShared;
    const sourceInput = await routeNeutralizeTransparency(input);

    let base = sharp(sourceInput).rotate();

    try {
      const meta = await base.metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      const mp = (w * h) / 1_000_000;
      if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
        base = base.resize({ width: 4000, height: 4000, fit: "inside" });
      }
    } catch {}

    base = base
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .removeAlpha()
      .grayscale();

    if (opts.invertInput) base = base.negate();

    if (opts.binaryMode) {
      base = base.threshold(opts.threshold);
    } else {
      base = base.gamma().normalize();
    }

    return await base.png().toBuffer();
  } catch {
    return input;
  }
}

async function runPotrace(input: Buffer, opts: any): Promise<string> {
  const routePotraceTraceAdapter = runSharedPotraceSvgTraceShared;
  return await routePotraceTraceAdapter(input, opts);
}

async function traceLayeredColorSvg(
  input: Buffer,
  opts: {
    colorLayerCount: number;
    layerMaxTraceSide: number;
    minRegionPercent: number;
    layerOptTolerance: number;
    layerTurdSize: number;
    layerTurnPolicy: TurnPolicy;
    posterize: boolean;
    removeWhite: boolean;
    removeTransparent: boolean;
    transparent: boolean;
    bgColor: string;
  },
): Promise<LayeredTraceResult> {
  const { getSharp } = await import("~/utils/conversionModules.server");
      const sharp = await getSharp();

  try {
    (sharp as any).concurrency?.(1);
    (sharp as any).cache?.({ files: 0, memory: 32 });
  } catch {}

  const routeNeutralizeTransparency = neutralizeTransparencyCheckerboardShared;
  const sourceInput = await routeNeutralizeTransparency(input);

  let img = sharp(sourceInput).rotate();
  img = img.resize({
    width: opts.layerMaxTraceSide,
    height: opts.layerMaxTraceSide,
    fit: "inside",
    withoutEnlargement: true,
  });

  const raw = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = raw.info.width;
  const height = raw.info.height;
  const data = raw.data as Buffer;
  const visible: Array<{ index: number; r: number; g: number; b: number }> = [];

  for (let i = 0, px = 0; i < data.length; i += 4, px++) {
    const r = data[i] ?? 255;
    const g = data[i + 1] ?? 255;
    const b = data[i + 2] ?? 255;
    const a = data[i + 3] ?? 255;
    if (opts.removeTransparent && a < 16) continue;
    if (opts.removeWhite && r > 245 && g > 245 && b > 245) continue;

    const c = opts.posterize
      ? {
          r: posterizeChannel(r),
          g: posterizeChannel(g),
          b: posterizeChannel(b),
        }
      : { r, g, b };
    visible.push({ index: px, r: c.r, g: c.g, b: c.b });
  }

  if (!visible.length) {
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"></svg>`,
      width,
      height,
      layers: [],
    };
  }

  const palette = buildDeterministicPalette(visible, opts.colorLayerCount);
  const counts = new Array(palette.length).fill(0);
  const assignments = new Uint8Array(width * height);
  assignments.fill(255);

  for (const px of visible) {
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < palette.length; i++) {
      const d = colorDistanceSq(px, palette[i]);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    assignments[px.index] = best;
    counts[best]++;
  }

  const minPixels = Math.max(
    1,
    Math.floor((visible.length * opts.minRegionPercent) / 100),
  );

  const tracedLayers: Array<{
    id: string;
    label: string;
    color: string;
    pathMarkup: string;
  }> = [];

  for (let layerIndex = 0; layerIndex < palette.length; layerIndex++) {
    if (counts[layerIndex] < minPixels) continue;
    const mask = Buffer.alloc(width * height, 255);
    for (let i = 0; i < assignments.length; i++) {
      if (assignments[i] === layerIndex) mask[i] = 0;
    }

    const maskPng = await sharp(mask, {
      raw: { width, height, channels: 1 },
    })
      .png()
      .toBuffer();

    const layerColor = rgbToHex(palette[layerIndex]);
    const svgRaw = await runPotrace(maskPng, {
      color: "#000000",
      threshold: 128,
      turdSize: opts.layerTurdSize,
      optTolerance: opts.layerOptTolerance,
      turnPolicy: opts.layerTurnPolicy,
      invert: false,
      blackOnWhite: true,
      validateMeaningfulOutput: false,
    });
    const ensured = ensureViewBoxResponsive(coerceSvg(svgRaw));
    const noBackground = stripFullWhiteBackgroundRect(
      ensured.svg,
      ensured.width,
      ensured.height,
    );
    const inner = extractSvgInnerMarkup(noBackground)
      .replace(/\sfill\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sstroke\s*=\s*["'][^"']*["']/gi, "");
    if (!inner.trim()) continue;

    tracedLayers.push({
      id: `layer-${tracedLayers.length + 1}-${layerColor.replace("#", "")}`,
      label: `Layer ${tracedLayers.length + 1}`,
      color: layerColor,
      pathMarkup: inner,
    });
  }

  const layers: EditableSvgLayer[] = tracedLayers.map((layer) => ({
    id: layer.id,
    label: layer.label,
    color: layer.color,
    originalColor: layer.color,
    visible: true,
    pathTags: layer.pathMarkup,
    kind: "fill",
  }));

  const groups = tracedLayers
    .map(
      (layer) =>
        `<g id="${escapeHtmlAttr(layer.id)}" data-layer-id="${escapeHtmlAttr(
          layer.id,
        )}" data-layer-label="${escapeHtmlAttr(
          layer.label,
        )}" data-layer-color="${escapeHtmlAttr(layer.color)}" fill="${escapeHtmlAttr(
          layer.color,
        )}">${layer.pathMarkup}</g>`,
    )
    .join("");

  const bg = opts.transparent
    ? ""
    : `<rect x="0" y="0" width="${width}" height="${height}" fill="${escapeHtmlAttr(
        opts.bgColor,
      )}"/>`;

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${bg}${groups}</svg>`,
    width,
    height,
    layers,
  };
}

function posterizeChannel(v: number) {
  const levels = [0, 51, 102, 153, 204, 255];
  let best = levels[0];
  let bestDist = Math.abs(v - best);
  for (const level of levels) {
    const d = Math.abs(v - level);
    if (d < bestDist) {
      best = level;
      bestDist = d;
    }
  }
  return best;
}

function buildDeterministicPalette(
  pixels: Array<{ r: number; g: number; b: number }>,
  count: number,
) {
  const buckets = new Map<
    string,
    { r: number; g: number; b: number; n: number }
  >();
  for (const p of pixels) {
    const key = `${p.r},${p.g},${p.b}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += p.r;
      bucket.g += p.g;
      bucket.b += p.b;
      bucket.n++;
    } else {
      buckets.set(key, { r: p.r, g: p.g, b: p.b, n: 1 });
    }
  }

  const seeded = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((b) => ({
      r: Math.round(b.r / b.n),
      g: Math.round(b.g / b.n),
      b: Math.round(b.b / b.n),
    }));

  while (seeded.length < count && pixels[seeded.length]) {
    const p = pixels[Math.floor((pixels.length * seeded.length) / count)];
    seeded.push({ r: p.r, g: p.g, b: p.b });
  }

  if (!seeded.length) seeded.push({ r: 0, g: 0, b: 0 });

  let centroids = seeded;
  for (let iter = 0; iter < 8; iter++) {
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (const p of pixels) {
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < centroids.length; i++) {
        const d = colorDistanceSq(p, centroids[i]);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      sums[best].r += p.r;
      sums[best].g += p.g;
      sums[best].b += p.b;
      sums[best].n++;
    }
    centroids = centroids.map((c, i) => {
      const s = sums[i];
      if (!s.n) return c;
      return {
        r: Math.round(s.r / s.n),
        g: Math.round(s.g / s.n),
        b: Math.round(s.b / s.n),
      };
    });
  }

  return centroids;
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

function rgbToHex(c: { r: number; g: number; b: number }) {
  return `#${[c.r, c.g, c.b]
    .map((v) => clampInt(v, 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function extractSvgInnerMarkup(svg: string) {
  const open = svg.match(/<svg\b[^>]*>/i);
  if (!open) return svg;
  const start = svg.indexOf(open[0]) + open[0].length;
  const end = svg.lastIndexOf("</svg>");
  if (end <= start) return svg.slice(start);
  return svg.slice(start, end);
}

function routeAnnotateSingleTrace(svg: string, layer: EditableSvgLayer) {
  return svg.replace(/<path\b([^>]*?)(\/?)>/gi, (match, attrs, selfClose) => {
    if (/data-fill-layer-id\s*=/.test(attrs)) return match;
    const hasFill = /\sfill\s*=/.test(attrs);
    const fillAttr = hasFill ? "" : ` fill="${escapeHtmlAttr(layer.color)}"`;
    return `<path${attrs}${fillAttr} data-fill-layer-id="${escapeHtmlAttr(
      layer.id,
    )}" data-layer-label="${escapeHtmlAttr(layer.label)}"${selfClose || ""}>`;
  });
}

function annotateSvgEditableLayers(svgRaw: string): {
  svg: string;
  layers: EditableSvgLayer[];
} {
  let svg = coerceSvg(svgRaw);
  const styleRules = collectSimpleStyleRules(svg);
  const layers = new Map<string, EditableSvgLayer>();
  let index = 1;

  svg = svg.replace(
    /<([a-zA-Z][\w:-]*)\b([^>]*?)(\/?)>/g,
    (match, tag, attrs, close) => {
      const tagName = String(tag);
      if (NON_EDITABLE_SVG_TAGS.has(tagName.toLowerCase())) return match;

      const directFill = getPaintFromAttrs(attrs, "fill", styleRules);
      const directStroke = getPaintFromAttrs(attrs, "stroke", styleRules);
      const isGroup = tagName.toLowerCase() === "g";
      let nextAttrs = attrs;

      if (isGroup && directFill) {
        const layer = makeLayerMeta(layers, directFill, "fill", index++);
        nextAttrs = addOrReplaceAttr(nextAttrs, "data-layer-id", layer.id);
        nextAttrs = addOrReplaceAttr(
          nextAttrs,
          "data-layer-label",
          layer.label,
        );
        nextAttrs = addOrReplaceAttr(
          nextAttrs,
          "data-layer-color",
          layer.color,
        );
        return `<${tagName}${nextAttrs}${close || ""}>`;
      }

      if (isGroup && directStroke) {
        const layer = makeLayerMeta(layers, directStroke, "stroke", index++);
        nextAttrs = addOrReplaceAttr(nextAttrs, "data-layer-id", layer.id);
        nextAttrs = addOrReplaceAttr(
          nextAttrs,
          "data-layer-label",
          layer.label,
        );
        nextAttrs = addOrReplaceAttr(
          nextAttrs,
          "data-layer-color",
          layer.color,
        );
        return `<${tagName}${nextAttrs}${close || ""}>`;
      }

      if (directFill) {
        const layer = makeLayerMeta(layers, directFill, "fill", index++);
        nextAttrs = addOrReplaceAttr(nextAttrs, "data-fill-layer-id", layer.id);
        nextAttrs = addOrReplaceAttr(
          nextAttrs,
          "data-layer-label",
          layer.label,
        );
        nextAttrs = addOrReplaceAttr(
          nextAttrs,
          "data-layer-color",
          layer.color,
        );
      }

      if (directStroke) {
        const layer = makeLayerMeta(layers, directStroke, "stroke", index++);
        nextAttrs = addOrReplaceAttr(
          nextAttrs,
          "data-stroke-layer-id",
          layer.id,
        );
        nextAttrs = addOrReplaceAttr(
          nextAttrs,
          "data-layer-label",
          layer.label,
        );
        nextAttrs = addOrReplaceAttr(
          nextAttrs,
          "data-layer-color",
          layer.color,
        );
      }

      return `<${tagName}${nextAttrs}${close || ""}>`;
    },
  );

  return { svg, layers: [...layers.values()] };
}

const NON_EDITABLE_SVG_TAGS = new Set([
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

function collectSimpleStyleRules(svg: string) {
  const rules = new Map<string, Record<string, string>>();
  svg.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_m, css) => {
    String(css).replace(/([.#][\w-]+)\s*\{([^}]+)\}/g, (_r, selector, body) => {
      const props: Record<string, string> = {};
      String(body).replace(
        /(fill|stroke)\s*:\s*([^;]+);?/gi,
        (_p, key, value) => {
          props[String(key).toLowerCase()] = String(value).trim();
          return "";
        },
      );
      if (Object.keys(props).length) rules.set(String(selector), props);
      return "";
    });
    return "";
  });
  return rules;
}

function getPaintFromAttrs(
  attrs: string,
  kind: "fill" | "stroke",
  rules: Map<string, Record<string, string>>,
) {
  const attrMatch = attrs.match(
    new RegExp(`\\s${kind}\\s*=\\s*["']([^"']+)["']`, "i"),
  );
  const styleMatch = attrs.match(/\sstyle\s*=\s*["']([^"']+)["']/i);
  const idMatch = attrs.match(/\sid\s*=\s*["']([^"']+)["']/i);
  const classMatch = attrs.match(/\sclass\s*=\s*["']([^"']+)["']/i);

  const candidates: string[] = [];
  if (attrMatch) candidates.push(attrMatch[1]);
  if (styleMatch) {
    const prop = styleMatch[1].match(
      new RegExp(`${kind}\\s*:\\s*([^;]+)`, "i"),
    );
    if (prop) candidates.push(prop[1]);
  }
  if (idMatch) {
    const rule = rules.get(`#${idMatch[1]}`);
    if (rule?.[kind]) candidates.push(rule[kind]);
  }
  if (classMatch) {
    for (const cls of classMatch[1].split(/\s+/)) {
      const rule = rules.get(`.${cls}`);
      if (rule?.[kind]) candidates.push(rule[kind]);
    }
  }

  for (const c of candidates) {
    const normalized = normalizePaintColor(c);
    if (normalized) return normalized;
  }
  return null;
}

function makeLayerMeta(
  layers: Map<string, EditableSvgLayer>,
  color: string,
  kind: SvgLayerKind,
  index: number,
) {
  const key = `${kind}:${color.toLowerCase()}`;
  const existing = layers.get(key);
  if (existing) return existing;

  const id = `${kind}-${color.replace("#", "")}-${index}`;
  const layer: EditableSvgLayer = {
    id,
    label: `${kind === "fill" ? "Fill" : "Stroke"} ${index}`,
    color,
    originalColor: color,
    visible: true,
    kind,
  };
  layers.set(key, layer);
  return layer;
}

function normalizePaintColor(value: string | null | undefined) {
  if (!value) return null;
  const raw = String(value).trim();
  const lower = raw.toLowerCase();
  if (
    !raw ||
    lower === "none" ||
    lower === "transparent" ||
    lower === "currentcolor" ||
    lower === "inherit" ||
    lower === "context-fill" ||
    lower === "context-stroke" ||
    lower.startsWith("url(")
  ) {
    return null;
  }
  return normalizeHexColor(raw);
}

function normalizeHexColor(value: string | null | undefined) {
  if (!value) return null;
  const raw = String(value).trim();
  const named = NAMED_COLORS[raw.toLowerCase()];
  if (named) return named;

  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return `#${h
        .split("")
        .map((x) => x + x)
        .join("")}`.toLowerCase();
    }
    return `#${h}`.toLowerCase();
  }

  const rgb = raw.match(
    /^rgba?\(\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)/i,
  );
  if (rgb) {
    const toChannel = (v: string) =>
      v.includes("%")
        ? Math.round((Number(v.replace("%", "")) / 100) * 255)
        : Math.round(Number(v));
    return rgbToHex({
      r: toChannel(rgb[1]),
      g: toChannel(rgb[2]),
      b: toChannel(rgb[3]),
    });
  }

  return null;
}

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  aqua: "#00ffff",
  magenta: "#ff00ff",
  fuchsia: "#ff00ff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  olive: "#808000",
  purple: "#800080",
  teal: "#008080",
  navy: "#000080",
  orange: "#ffa500",
  pink: "#ffc0cb",
  brown: "#a52a2a",
};

function addOrReplaceAttr(attrs: string, name: string, value: string) {
  const re = new RegExp(`\\s${escapeReg(name)}\\s*=\\s*["'][^"']*["']`, "i");
  const attr = ` ${name}="${escapeHtmlAttr(value)}"`;
  if (re.test(attrs)) return attrs.replace(re, attr);
  return `${attrs}${attr}`;
}

function escapeHtmlAttr(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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

  return { svg: svg.replace(openTag, newOpen), width, height };
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

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

function clampNum(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

type Settings = {
  threshold: number;
  turdSize: number;
  optTolerance: number;
  turnPolicy: TurnPolicy;
  lineColor: string;
  invert: boolean;
  transparent: boolean;
  bgColor: string;
  binaryMode: boolean;
  binaryInvertInput: boolean;
  traceMode: TraceMode;
  strokeOutputMode?: "filled" | "centerline";
  centerlineMaxTraceSide?: number;
  centerlineStrokeWidth?: number;
  centerlineSimplifyTolerance?: number;
  centerlineMinPathLength?: number;
  colorLayerCount: number;
  layerMaxTraceSide: number;
  minRegionPercent: number;
  layerOptTolerance: number;
  layerTurdSize: number;
  layerTurnPolicy: TurnPolicy;
  posterize: boolean;
  removeWhite: boolean;
  removeTransparent: boolean;
};

type Preset = {
  id: string;
  label: string;
  category?: string;
  backendIntensity?: PresetBackendIntensity;
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
    id: "bw-clean",
    label: "B/W  -  Clean (default)",
    settings: {
      traceMode: "single",
      binaryMode: true,
      threshold: 200,
      turdSize: 2,
      optTolerance: 0.28,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "bw-bold",
    label: "B/W  -  Bold",
    settings: {
      traceMode: "single",
      binaryMode: true,
      threshold: 185,
      turdSize: 3,
      optTolerance: 0.35,
      turnPolicy: "majority",
    },
  },
  {
    id: "bw-fine",
    label: "B/W  -  Fine detail",
    settings: {
      traceMode: "single",
      binaryMode: true,
      threshold: 215,
      turdSize: 1,
      optTolerance: 0.22,
      turnPolicy: "minority",
    },
  },
  {
    id: "bw-speckle-kill",
    label: "B/W  -  Kill speckles",
    settings: {
      traceMode: "single",
      binaryMode: true,
      threshold: 205,
      turdSize: 6,
      optTolerance: 0.3,
      turnPolicy: "majority",
    },
  },
  {
    id: "invert-white-on-black",
    label: "Invert  -  White lines on black",
    settings: {
      traceMode: "single",
      binaryMode: true,
      threshold: 200,
      turdSize: 2,
      optTolerance: 0.28,
      turnPolicy: "minority",
      invert: true,
      lineColor: "#ffffff",
      transparent: false,
      bgColor: DARK_BG_DEFAULT,
    },
  },
  ...(STROKE_TRACE_PRESET_ADDITIONS.slice(0, 6) as unknown as Preset[]),
];

const DISPLAY_PRESETS: Preset[] = [
  ...PRESETS,
  {
    id: "bw-clean-lines",
    label: "Lineart - Clean",
    category: "lineart",
    backendIntensity: "extreme-speed",
    settings: {
      traceMode: "single",
      binaryMode: true,
      threshold: 210,
      turdSize: 3,
      optTolerance: 0.34,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "bw-thin-lines",
    label: "Lineart - Thin",
    category: "lineart",
    backendIntensity: "high-speed",
    settings: {
      traceMode: "single",
      binaryMode: true,
      threshold: 230,
      turdSize: 1,
      optTolerance: 0.22,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "bw-thick-lines",
    label: "Lineart - Thick",
    category: "lineart",
    backendIntensity: "extreme-speed",
    settings: {
      traceMode: "single",
      binaryMode: true,
      threshold: 182,
      turdSize: 4,
      optTolerance: 0.42,
      turnPolicy: "black",
    },
  },
  {
    id: "bw-scan-faded",
    label: "Scan - Faded",
    category: "scan",
    backendIntensity: "high-speed",
    settings: {
      traceMode: "single",
      binaryMode: true,
      threshold: 226,
      turdSize: 2,
      optTolerance: 0.28,
      turnPolicy: "minority",
    },
  },
  {
    id: "bw-scan-cleanup",
    label: "Scan - Ink Cleanup",
    category: "scan",
    backendIntensity: "extreme-speed",
    settings: {
      traceMode: "single",
      binaryMode: true,
      threshold: 204,
      turdSize: 7,
      optTolerance: 0.42,
      turnPolicy: "majority",
    },
  },
  {
    id: "bw-stencil-bold",
    label: "Stencil - Bold",
    category: "diagram",
    backendIntensity: "extreme-speed",
    settings: {
      traceMode: "single",
      binaryMode: true,
      threshold: 176,
      turdSize: 6,
      optTolerance: 0.55,
      turnPolicy: "black",
      lineColor: "#000000",
    },
  },
  {
    id: "bw-whiteboard-clean",
    label: "Whiteboard - Clean",
    category: "scan",
    backendIntensity: "extreme-speed",
    settings: {
      traceMode: "single",
      binaryMode: true,
      threshold: 218,
      turdSize: 5,
      optTolerance: 0.38,
      turnPolicy: "majority",
      binaryInvertInput: false,
    },
  },
  {
    id: "bw-invert-chalkboard",
    label: "Invert - Chalkboard",
    category: "diagram",
    backendIntensity: "high-speed",
    settings: {
      traceMode: "single",
      binaryMode: true,
      threshold: 202,
      turdSize: 2,
      optTolerance: 0.3,
      turnPolicy: "minority",
      invert: true,
      lineColor: "#ffffff",
      transparent: false,
      bgColor: "#111827",
    },
  },
  {
    id: "bw-layered-three",
    label: "Layered - 3 Color",
    category: "layered",
    backendIntensity: "high-speed",
    settings: {
      traceMode: "layered",
      colorLayerCount: 3,
      layerMaxTraceSide: 1200,
      minRegionPercent: 0.75,
      layerOptTolerance: 0.72,
      layerTurdSize: 8,
      layerTurnPolicy: "majority",
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      invert: false,
    },
  },
  {
    id: "bw-layered-detail",
    label: "Layered - Detail",
    category: "layered",
    backendIntensity: "slow-speed",
    settings: {
      traceMode: "layered",
      colorLayerCount: 8,
      layerMaxTraceSide: 2000,
      minRegionPercent: 0.18,
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
];
const DEFAULT_PRESET_ID = "bw-clean";
const DEFAULTS: Settings = {
  threshold: 200,
  turdSize: 2,
  optTolerance: 0.28,
  turnPolicy: "minority",
  lineColor: "#000000",
  invert: false,
  transparent: true,
  bgColor: "#ffffff",
  binaryMode: true,
  binaryInvertInput: false,
  traceMode: "single",
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
type ServerResult = {
  svg?: string;
  layers?: EditableSvgLayer[];
  error?: string;
  width?: number;
  height?: number;
  engineUsed?: "vtracer" | "potrace" | "centerline";
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
  engineUsed?: "vtracer" | "potrace" | "centerline";
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
  layers?: EditableSvgLayer[];
  settingsSnapshot: Settings;
  name?: string;
  presetLabel?: string;
  sourceFileName?: string;
  sourceMimeType?: string;
  sourceFileSize?: number;
  sourcePreviewUrl?: string;
};

const OUTPUT_HISTORY_LIMIT = 10;

function getPresetLabelById(presetId: string): string {
  return (
    DISPLAY_PRESETS.find((preset) => preset.id === presetId)?.label ||
    "Custom settings"
  );
}

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

export default function BlackAndWhiteImageToSvgConverter({
  loaderData,
}: Route.ComponentProps) {
  const fetcher = useHybridTraceFetcher<ServerResult>({ routeId: "black-and-white-image-to-svg-converter" });

  const [file, setFile] = React.useState<File | null>(null);
  const [originalFileSize, setOriginalFileSize] = React.useState<number | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] =
    React.useState<string>(DEFAULT_PRESET_ID);

  const busy = fetcher.state !== "idle";
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const [dims, setDims] = React.useState<{
    w: number;
    h: number;
    mp: number;
  } | null>(null);

  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [fullscreenPreviewIndex, setFullscreenPreviewIndex] = React.useState<
    number | null
  >(null);
  const [autoMode, setAutoMode] = React.useState<AutoMode>("off");

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressLiveRef = React.useRef(false);
  const lastSubmittedSettingsRef = React.useRef<Settings>(DEFAULTS);
  const lastSubmittedSourceSnapshotRef = React.useRef<OutputSourceSnapshot>({});
  const historyRef = React.useRef<HistoryItem[]>([]);

  React.useEffect(() => {
    historyRef.current = history;
  }, [history]);

  React.useEffect(() => {
    return () => cleanupUnusedSourceSnapshots(historyRef.current, []);
  }, []);

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
        layers: fetcher.data.layers,
        settingsSnapshot: lastSubmittedSettingsRef.current,
        name: `Output - ${getPresetLabelById(activePreset)}`,
        presetLabel: getPresetLabelById(activePreset),
        sourceFileName: lastSubmittedSourceSnapshotRef.current.sourceFileName,
        sourceMimeType: lastSubmittedSourceSnapshotRef.current.sourceMimeType,
        sourceFileSize: lastSubmittedSourceSnapshotRef.current.sourceFileSize,
        sourcePreviewUrl: lastSubmittedSourceSnapshotRef.current.sourcePreviewUrl,
      };
      setHistory((prev) =>
        trimOutputHistory([item, ...prev], prev, OUTPUT_HISTORY_LIMIT),
      );
    }
  }, [fetcher.data?.svg, fetcher.data?.width, fetcher.data?.height, activePreset]);

  React.useEffect(() => {
    const serverErr = fetcher.data?.error;
    if (serverErr) {
      setErr(serverErr);
      cleanupUnusedSourceSnapshots(
        [lastSubmittedSourceSnapshotRef.current],
        historyRef.current,
      );
    }
  }, [fetcher.data?.error]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  React.useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.kind !== "file") continue;
        const f = it.getAsFile();
        if (!f) continue;
        if (!ALLOWED_MIME.has(f.type)) continue;
        handleNewFile(f);
        break;
      }
    }
    if (!isServer) window.addEventListener("paste", onPaste);
    return () => {
      if (!isServer) window.removeEventListener("paste", onPaste);
    };
  }, []);

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
      setErr("Please choose a PNG, JPEG, or SVG.");
      return;
    }

    suppressLiveRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(null);
    setPreviewUrl(null);
    setDims(null);
    setErr(null);
    setInfo(null);
    setOriginalFileSize(f.size);

    let chosen = f;

    setAutoMode(getAutoMode(chosen.size));
    const url = URL.createObjectURL(chosen);
    setPreviewUrl(url);

    suppressLiveRef.current = false;

    setFile(chosen);
    measureAndSet(chosen);

    if (getAutoMode(chosen.size) !== "off") {
      submitConvertWith(chosen, settings, activePreset);
    }
  }

  function buildPresetSettings(preset: Preset, _current: Settings): Settings {
    return {
      ...DEFAULTS,
      ...preset.settings,
    } as Settings;
  }

  function applyPreset(preset: Preset) {
    const nextSettings = buildPresetSettings(preset, settings);
    setActivePreset(preset.id);
    setSettings(nextSettings);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (file) {
      submitConvertWith(file, nextSettings, preset.id);
    }
  }

  async function submitConvert() {
    if (!file) {
      setErr("Choose an image first.");
      return;
    }
    await submitConvertWith(file, settings);
  }

  async function submitConvertWith(
    f: File,
    targetSettings: Settings = settings,
    presetId: string = activePreset,
  ) {
    try {
      await validateBeforeSubmit(f);
    } catch (e: any) {
      setErr(e?.message || "Image is too large.");
      return;
    }

    const effective = (() => {
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
    })();

    const fd = new FormData();
    fd.append("file", f);
    fd.append("threshold", String(effective.threshold));
    fd.append("turdSize", String(effective.turdSize));
    fd.append("optTolerance", String(effective.optTolerance));
    fd.append("turnPolicy", effective.turnPolicy);
    fd.append("lineColor", effective.lineColor);
    fd.append("invert", String(effective.invert));
    fd.append("transparent", String(effective.transparent));
    fd.append("bgColor", effective.bgColor);
    fd.append("binaryMode", String(effective.binaryMode));
    fd.append("binaryInvertInput", String(effective.binaryInvertInput));
    fd.append("traceMode", effective.traceMode);
    fd.append("strokeOutputMode", String(effective.strokeOutputMode || "filled"));
    fd.append("centerlineMaxTraceSide", String(effective.centerlineMaxTraceSide || 1100));
    fd.append("centerlineStrokeWidth", String(effective.centerlineStrokeWidth || 2));
    fd.append(
      "centerlineSimplifyTolerance",
      String(effective.centerlineSimplifyTolerance || 1.1),
    );
    fd.append("centerlineMinPathLength", String(effective.centerlineMinPathLength || 5));
    fd.append("colorLayerCount", String(effective.colorLayerCount));
    fd.append("layerMaxTraceSide", String(effective.layerMaxTraceSide));
    fd.append("minRegionPercent", String(effective.minRegionPercent));
    fd.append("layerOptTolerance", String(effective.layerOptTolerance));
    fd.append("layerTurdSize", String(effective.layerTurdSize));
    fd.append("layerTurnPolicy", effective.layerTurnPolicy);
    fd.append("posterize", String(effective.posterize));
    fd.append("removeWhite", String(effective.removeWhite));
    fd.append("removeTransparent", String(effective.removeTransparent));

    fd.append("presetId", presetId);

    setErr(null);
    lastSubmittedSettingsRef.current = effective;
    lastSubmittedSourceSnapshotRef.current = createOutputSourceSnapshot(f);

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action: `${window.location.pathname}?index`,
    });
  }

  const buttonDisabled = isServer || !hydrated || busy || !file;

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
    return getEditedSvg(item.svg, item.layers);
  }

  const [showTraceSettings, setShowTraceSettings] = React.useState(false);

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

          <section className="grid grid-cols-1 gap-4 items-start sm:pt-5 md:grid-cols-2 lg:pt-0 lg:pb-8">
            <div className="order-1 min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] sm:border sm:border-slate-200">
              <h1 className="inline-flex text-sky-800 items-center gap-2 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none">
                Black & White to SVG
              </h1>

              <PresetPicker
                presets={DISPLAY_PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />

              <div className="my-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowTraceSettings((v) => !v)}
                  aria-expanded={showTraceSettings}
                  aria-controls="trace-settings-panel"
                  className={[
                    "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-[#dbe3ef] bg-sky-50 text-slate-900 cursor-pointer transition-colors",
                    "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0b2dff]",
                  ].join(" ")}
                >
                  <span className="flex items-center justify-center text-sm font-semibold">
                    <Icons
                      name="settings"
                      size={16}
                      className="inline-block mr-1"
                    />
                    Trace settings
                  </span>
                  <span
                    className={[
                      "text-slate-600 transition-transform",
                      showTraceSettings ? "rotate-180" : "",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </button>

                {showTraceSettings && (
                  <div
                    id="trace-settings-panel"
                    className="mt-3 flex flex-col gap-2 min-w-0"
                  >
                    <Field label="Trace mode">
                      <select
                        value={settings.traceMode}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            traceMode: e.target.value as TraceMode,
                          }))
                        }
                        className={[
                          "w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors",
                          "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0b2dff]",
                        ].join(" ")}
                      >
                        <option value="layered">Layered color</option>
                        <option value="single">Single color</option>
                      </select>
                    </Field>

                    {settings.traceMode === "layered" ? (
                      <>
                        <Field label="Color layers">
                          <ThrottledNumberInput
                            value={settings.colorLayerCount}
                            min={2}
                            max={12}
                            step={1}
                            onCommit={(v) =>
                              setSettings((s) => ({
                                ...s,
                                colorLayerCount: v,
                              }))
                            }
                          />
                        </Field>

                        <Field label="Max trace side">
                          <ThrottledNumberInput
                            value={settings.layerMaxTraceSide}
                            min={300}
                            max={2400}
                            step={100}
                            onCommit={(v) =>
                              setSettings((s) => ({
                                ...s,
                                layerMaxTraceSide: v,
                              }))
                            }
                          />
                        </Field>

                        <Field label="Minimum region %">
                          <ThrottledNumberInput
                            value={settings.minRegionPercent}
                            min={0}
                            max={10}
                            step={0.05}
                            onCommit={(v) =>
                              setSettings((s) => ({
                                ...s,
                                minRegionPercent: v,
                              }))
                            }
                          />
                        </Field>

                        <Field label="Layer curve tolerance">
                          <ThrottledNumberInput
                            value={settings.layerOptTolerance}
                            min={0.05}
                            max={1.5}
                            step={0.05}
                            onCommit={(v) =>
                              setSettings((s) => ({
                                ...s,
                                layerOptTolerance: v,
                              }))
                            }
                          />
                        </Field>

                        <Field label="Layer turd size">
                          <ThrottledNumberInput
                            value={settings.layerTurdSize}
                            min={0}
                            max={20}
                            step={1}
                            onCommit={(v) =>
                              setSettings((s) => ({
                                ...s,
                                layerTurdSize: v,
                              }))
                            }
                          />
                        </Field>

                        <Field label="Layer turn policy">
                          <select
                            value={settings.layerTurnPolicy}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                layerTurnPolicy: e.target.value as TurnPolicy,
                              }))
                            }
                            className={[
                              "w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors",
                              "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0b2dff]",
                            ].join(" ")}
                          >
                            <option value="black">black</option>
                            <option value="white">white</option>
                            <option value="left">left</option>
                            <option value="right">right</option>
                            <option value="minority">minority</option>
                            <option value="majority">majority</option>
                          </select>
                        </Field>

                        <Field label="Posterize colors">
                          <input
                            type="checkbox"
                            checked={settings.posterize}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                posterize: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                          />
                        </Field>

                        <Field label="Remove white">
                          <input
                            type="checkbox"
                            checked={settings.removeWhite}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                removeWhite: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                          />
                        </Field>

                        <Field label="Remove transparent">
                          <input
                            type="checkbox"
                            checked={settings.removeTransparent}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                removeTransparent: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                          />
                        </Field>
                      </>
                    ) : (
                      <>
                        <Field label="Binary mode (true B/W)">
                          <input
                            type="checkbox"
                            checked={settings.binaryMode}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                binaryMode: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                          />
                          <span className="text-[13px] text-slate-700">
                            {settings.binaryMode ? "On" : "Off"}
                          </span>
                        </Field>

                        <Field label="Invert input before tracing">
                          <input
                            type="checkbox"
                            checked={settings.binaryInvertInput}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                binaryInvertInput: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                          />
                          <span className="text-[13px] text-slate-700">
                            Swap black and white first
                          </span>
                        </Field>

                        <Field label={`Threshold (${settings.threshold})`}>
                          <ThrottledRangeInput
                            value={settings.threshold}
                            min={0}
                            max={255}
                            step={1}
                            onCommit={(v) =>
                              setSettings((s) => ({
                                ...s,
                                threshold: v,
                              }))
                            }
                          />
                        </Field>

                        <Field label="Turd size">
                          <ThrottledNumberInput
                            value={settings.turdSize}
                            min={0}
                            max={10}
                            step={1}
                            onCommit={(v) =>
                              setSettings((s) => ({ ...s, turdSize: v }))
                            }
                          />
                        </Field>

                        <Field label="Curve tolerance">
                          <ThrottledNumberInput
                            value={settings.optTolerance}
                            min={0.05}
                            max={1.2}
                            step={0.05}
                            onCommit={(v) =>
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
                                turnPolicy: e.target.value as TurnPolicy,
                              }))
                            }
                            className={[
                              "w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors",
                              "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0b2dff]",
                            ].join(" ")}
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
                          <ThrottledColorInput
                            value={settings.lineColor}
                            onCommit={(v) =>
                              setSettings((s) => ({
                                ...s,
                                lineColor: v,
                              }))
                            }
                          />
                        </Field>

                        <Field label="Invert output (white on dark)">
                          <input
                            type="checkbox"
                            checked={settings.invert}
                            onChange={(e) =>
                              setSettings((s) => {
                                const on = e.target.checked;
                                if (!on) return { ...s, invert: false };
                                const bg =
                                  !s.bgColor ||
                                  s.bgColor.toLowerCase() === "#ffffff" ||
                                  s.bgColor.toLowerCase() === "#fff"
                                    ? DARK_BG_DEFAULT
                                    : s.bgColor;
                                return {
                                  ...s,
                                  invert: true,
                                  transparent: false,
                                  bgColor: bg,
                                  lineColor:
                                    s.lineColor?.toLowerCase() === "#000000"
                                      ? "#ffffff"
                                      : s.lineColor,
                                };
                              })
                            }
                            className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                          />
                        </Field>
                      </>
                    )}

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
                          className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
                        />
                        <span className="text-[13px] text-slate-700">
                          Transparent
                        </span>
                        <ThrottledColorInput
                          value={settings.bgColor}
                          disabled={settings.transparent}
                          onCommit={(v) =>
                            setSettings((s) => ({
                              ...s,
                              bgColor: v,
                            }))
                          }
                        />
                      </div>
                    </Field>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-[#edf2fb] bg-[#fafcff] px-3 py-2">
                      <span className="text-[12px] text-slate-600">
                        Setting changes do not live preview automatically.
                        Click Update preview to apply these settings.
                      </span>
                      <button
                        type="button"
                        onClick={() => void submitConvert()}
                        disabled={buttonDisabled}
                        className={[
                          "shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors",
                          "border-[#d6e4ff] bg-white text-slate-800 hover:bg-[#eff4ff] cursor-pointer",
                          "disabled:opacity-70 disabled:cursor-not-allowed",
                        ].join(" ")}
                      >
                        Update preview
                      </button>
                    </div>
                  </div>
                )}
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

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => void submitConvert()}
                  disabled={buttonDisabled}
                  suppressHydrationWarning
                  className={[
                    "w-full px-3.5 py-2 rounded-lg font-bold border transition-colors",
                    "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0]",
                    "disabled:opacity-70 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  {busy ? "Converting…" : "Convert"}
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
                <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <img
                    src={previewUrl}
                    alt="Input"
                    className="relative w-full h-auto block transparent-checkerboard"
                  />
                </div>
              )}
            </div>

            <BespokeTraceOutputPanel
              history={history}
              busy={busy}
              file={file}
              downloadLabel="Download SVG"
              downloadFileName="converted.svg"
              emptyTitle="Converted files appear here..."
              emptyBusyTitle="Converting..."
              resultKindLabel="SVG result"
              fullscreenPreviewIndex={fullscreenPreviewIndex}
              setFullscreenPreviewIndex={setFullscreenPreviewIndex}
              getSvg={getHistoryItemSvg}
              onCopySvg={handleCopySvg}
              onOpenEditor={(item) => setSettings(item.settingsSnapshot)}
              renderSettings={({ item, appearanceControls }) => (
                <div className="grid gap-3">
                  {appearanceControls}
                  {item.layers?.length ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <h3 className="m-0 mb-2 text-base font-bold text-sky-950">
                        Layer colors
                      </h3>
                      <LayerPaletteEditor
                        layers={item.layers}
                        onColorChange={(layerId, color) =>
                          setHistoryLayer(item.stamp, layerId, { color })
                        }
                        onVisibilityChange={(layerId, visible) =>
                          setHistoryLayer(item.stamp, layerId, { visible })
                        }
                        onResetLayer={(layerId) =>
                          resetHistoryLayer(item.stamp, layerId)
                        }
                        onResetAll={() => resetAllHistoryLayers(item.stamp)}
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-[13px] text-slate-600">
                      This output has no editable layer palette.
                    </div>
                  )}
                </div>
              )}
            />
          </section>
        </div>

        <FullscreenOutputPreview
          items={history}
          activeIndex={fullscreenPreviewIndex}
          setActiveIndex={setFullscreenPreviewIndex}
          getPreviewImage={(item, index) => ({
            id: String(item.stamp),
            label: `Output ${index + 1}`,
            svg: getBespokeTraceOutputSvg(item, getHistoryItemSvg),
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

      <ContextualAdCard />
      <SeoSections />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

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
  const isSvg =
    file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
  if (!ALLOWED_MIME.has(file.type) && !isSvg)
    throw new Error("Only PNG, JPEG, or SVG images are allowed.");
  if (file.size > MAX_UPLOAD_BYTES)
    throw new Error("File too large. Max 30 MB per image.");
  if (isSvg) return;
  const { w, h } = await getImageSize(file);
  if (!w || !h) throw new Error("Could not read image dimensions.");
  const mp = (w * h) / 1_000_000;
  if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
    throw new Error(
      `Image too large: ${w}×${h} (~${mp.toFixed(1)} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
    );
  }
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

function ThrottledColorInput({
  value,
  onCommit,
  disabled,
}: {
  value: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
}) {
  const [localColor, setLocalColor] = React.useState(value);
  const latestColorRef = React.useRef(value);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setLocalColor((current) => (current === value ? current : value));
    latestColorRef.current = value;
  }, [value]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function commitNow() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    onCommit(latestColorRef.current);
  }

  function schedule(next: string) {
    if (timeoutRef.current) return;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onCommit(latestColorRef.current);
    }, COLOR_UPDATE_THROTTLE_MS);
  }

  return (
    <input
      type="color"
      value={localColor}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value;
        setLocalColor((current) => (current === next ? current : next));
        latestColorRef.current = next;
        schedule(next);
      }}
      onPointerUp={commitNow}
      onMouseUp={commitNow}
      onTouchEnd={commitNow}
      onBlur={commitNow}
      className={[
        "w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer transition-opacity",
        "hover:ring-2 hover:ring-sky-200",
        disabled ? "opacity-50 pointer-events-none" : "",
      ].join(" ")}
      title={disabled ? "Uncheck to pick a background color" : "Pick color"}
    />
  );
}

function ThrottledRangeInput({
  value,
  min,
  max,
  step,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (v: number) => void;
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

  function commitNow() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    onCommit(clampNum(latestValueRef.current, min, max));
  }

  function schedule() {
    if (timeoutRef.current) return;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onCommit(clampNum(latestValueRef.current, min, max));
    }, COLOR_UPDATE_THROTTLE_MS);
  }

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={localValue}
      onChange={(e) => {
        const next = Number(e.target.value);
        setLocalValue(next);
        latestValueRef.current = next;
        schedule();
      }}
      onPointerUp={commitNow}
      onMouseUp={commitNow}
      onTouchEnd={commitNow}
      onBlur={commitNow}
      className="w-full accent-[#0b2dff] cursor-pointer"
    />
  );
}

function ThrottledNumberInput({
  value,
  min,
  max,
  step,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (v: number) => void;
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
    const next =
      step >= 1 ? clampInt(parsed, min, max) : clampNum(parsed, min, max);
    setLocalValue(String(next));
    onCommit(next);
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

function LayerPaletteEditor({
  layers,
  onColorChange,
  onVisibilityChange,
  onResetLayer,
  onResetAll,
}: {
  layers: EditableSvgLayer[];
  onColorChange: (layerId: string, color: string) => void;
  onVisibilityChange: (layerId: string, visible: boolean) => void;
  onResetLayer: (layerId: string) => void;
  onResetAll: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-slate-700">
          Editable layers
        </span>
        <button
          type="button"
          onClick={onResetAll}
          className="px-2 py-1 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
        >
          Reset all
        </button>
      </div>
      <div className="grid gap-1.5">
        {layers.map((layer) => (
          <LayerPaletteRow
            key={layer.id}
            layer={layer}
            onColorChange={onColorChange}
            onVisibilityChange={onVisibilityChange}
            onResetLayer={onResetLayer}
          />
        ))}
      </div>
    </div>
  );
}

function LayerPaletteRow({
  layer,
  onColorChange,
  onVisibilityChange,
  onResetLayer,
}: {
  layer: EditableSvgLayer;
  onColorChange: (layerId: string, color: string) => void;
  onVisibilityChange: (layerId: string, visible: boolean) => void;
  onResetLayer: (layerId: string) => void;
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

  function scheduleCommit() {
    if (timeoutRef.current) return;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onColorChange(layer.id, latestColorRef.current);
    }, COLOR_UPDATE_THROTTLE_MS);
  }

  function commitNow() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    onColorChange(layer.id, latestColorRef.current);
  }

  return (
    <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
      <input
        type="checkbox"
        checked={layer.visible}
        onChange={(e) => onVisibilityChange(layer.id, e.target.checked)}
        className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
        title={layer.visible ? "Hide layer" : "Show layer"}
      />
      <input
        type="color"
        value={localColor}
        onChange={(e) => {
          const nextColor = e.target.value;
          setLocalColor((current) => (current === nextColor ? current : nextColor));
          latestColorRef.current = nextColor;
          scheduleCommit();
        }}
        onPointerUp={commitNow}
        onMouseUp={commitNow}
        onTouchEnd={commitNow}
        onBlur={commitNow}
        className="w-9 h-7 rounded-md border border-slate-200 bg-white cursor-pointer hover:ring-2 hover:ring-sky-200"
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
        onClick={() => onResetLayer(layer.id)}
        className="px-2 py-1 text-xs rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
      >
        Reset
      </button>
    </div>
  );
}


function applyEditorDisplay(node: Element, visible: boolean) {
  if (!visible) {
    node.setAttribute("display", "none");
    node.setAttribute("data-editor-hidden", "true");
    return;
  }
  if (node.getAttribute("data-editor-hidden") === "true") {
    node.removeAttribute("display");
    node.removeAttribute("data-editor-hidden");
  }
}

function applyLayerEditByString(svg: string, layer: EditableSvgLayer) {
  let out = svg;
  const groupRe = new RegExp(
    `<g\\b([^>]*data-layer-id=["']${escapeReg(layer.id)}["'][^>]*)>([\\s\\S]*?)<\\/g>`,
    "gi",
  );
  out = out.replace(groupRe, (_m, attrs, inner) => {
    let nextAttrs =
      layer.kind === "stroke"
        ? setSvgAttr(attrs, "stroke", layer.color)
        : setSvgAttr(attrs, "fill", layer.color);
    nextAttrs = setSvgAttr(nextAttrs, "data-layer-color", layer.color);
    nextAttrs = setEditorVisibilityAttrs(nextAttrs, layer.visible);
    const nextInner = inner
      .replace(/\sfill\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sstroke\s*=\s*["'][^"']*["']/gi, "");
    return `<g${nextAttrs}>${nextInner}</g>`;
  });

  out = updateTaggedElements(out, "data-fill-layer-id", layer, "fill");
  out = updateTaggedElements(out, "data-stroke-layer-id", layer, "stroke");
  return out;
}

function updateTaggedElements(
  svg: string,
  marker: string,
  layer: EditableSvgLayer,
  paintAttr: "fill" | "stroke",
) {
  const re = new RegExp(
    `<([a-zA-Z][\\w:-]*)\\b([^>]*${escapeReg(marker)}=["']${escapeReg(
      layer.id,
    )}["'][^>]*)(\\/?)>`,
    "gi",
  );
  return svg.replace(re, (_m, tag, attrs, close) => {
    let nextAttrs = setSvgAttr(attrs, paintAttr, layer.color);
    nextAttrs = setSvgAttr(nextAttrs, "data-layer-color", layer.color);
    nextAttrs = setEditorVisibilityAttrs(nextAttrs, layer.visible);
    return `<${tag}${nextAttrs}${close || ""}>`;
  });
}

function setSvgAttr(attrs: string, name: string, value: string) {
  const re = new RegExp(`\\s${escapeReg(name)}\\s*=\\s*["'][^"']*["']`, "i");
  const attr = ` ${name}="${escapeHtmlAttr(value)}"`;
  if (re.test(attrs)) return attrs.replace(re, attr);
  return `${attrs}${attr}`;
}

function setEditorVisibilityAttrs(attrs: string, visible: boolean) {
  let next = attrs;
  if (!visible) {
    next = setSvgAttr(next, "display", "none");
    next = setSvgAttr(next, "data-editor-hidden", "true");
    return next;
  }
  if (/data-editor-hidden\s*=\s*["']true["']/i.test(next)) {
    next = next.replace(/\sdisplay\s*=\s*["']none["']/i, "");
    next = next.replace(/\sdata-editor-hidden\s*=\s*["']true["']/i, "");
  }
  return next;
}

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/"/g, '\\"');
}

function prettyBytes(bytes: number) {
  const u = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
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
                Black and white raster to SVG
              </p>
              <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                Black and White Image to SVG Converter
              </h2>
              <p className="text-slate-600 ">
                Turn high-contrast art and scans into editable SVG paths. Binary
                mode produces a true black/white input before tracing for
                predictable results.
              </p>
              <p className="mt-1 text-slate-600">
                Convert black and white PNG, JPEG, JPG, and WEBP images into
                crisp vector SVG with live preview.
              </p>
              <p className="mt-1 text-slate-600">
                This PNG to SVG conversion page only rate limits backend raster
                tracing and server-side conversion work. Preview rendering,
                copy, local download generation, and browser-only setting
                changes are not rate limited because they do not use server
                conversion compute. Backend conversion actions allow up to 120
                conversions per minute, 400 conversions every 5 minutes, 1500
                conversions per hour, and 3000 conversions per day for the same
                connection and browser profile.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { k: "Binary mode", v: "True 2-color thresholding" },
                  { k: "Speckle cleanup", v: "Turd size removes tiny noise" },
                  { k: "Fast preview", v: "≤10 MB live updates" },
                  { k: "Private by default", v: "Processed in memory" },
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
            <h3 className="text-lg font-bold">Tips for cleaner output</h3>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {[
                [
                  "Start with high contrast",
                  "If your source is gray, increase contrast before uploading.",
                ],
                [
                  "Adjust threshold first",
                  "Threshold decides what becomes black. Small changes can fix missing lines.",
                ],
                [
                  "Remove speckles",
                  "Increase turd size when scans contain dust or tiny dots.",
                ],
                [
                  "Smooth curves",
                  "Raise curve tolerance to reduce node count and smooth jagged edges.",
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
            <h3 className="text-lg font-bold">Frequently asked questions</h3>
            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "What images work best?",
                  a: "High-contrast black and white images, scans, and simple 2-color designs work best.",
                },
                {
                  q: "What does Binary mode do?",
                  a: "It thresholds the image into true black and white before tracing, which makes results more predictable for 2-color artwork.",
                },
                {
                  q: "Why does my SVG have lots of tiny dots?",
                  a: "Increase Turd size to remove small specks and scanner dust.",
                },
                {
                  q: "Why are lines missing?",
                  a: "Adjust threshold. If thin strokes are disappearing, try a lower threshold or invert input before tracing.",
                },
                {
                  q: "Does this tool have usage limits?",
                  a: "Only backend conversion work is rate limited. Preview rendering, copy, download, layer color changes, and local setting changes are not rate limited because they run in your browser. Backend raster tracing allows up to 120 conversions per minute, 400 conversions every 5 minutes, 1500 conversions per hour, and 3000 conversions per day for the same connection and browser profile.",
                },
                {
                  q: "Can I export with a background?",
                  a: "Yes. Keep transparency on or disable it to inject a solid background color into the SVG.",
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
