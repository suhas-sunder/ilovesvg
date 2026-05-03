// app/routes/free-color-picker.tsx
import * as React from "react";
import type { Route } from "./+types/free-color-picker";
import { Link } from "react-router";
import { CurrentRouteGuide, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import Icons from "~/client/assets/icons/Icons";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";

/* ========================
   Limits
======================== */
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_MP = 30;
const MAX_SIDE = 8000;

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    `Free Color Picker - Pick HEX, RGB, HSL and SVG Palettes | iLoveSVG`;
  const description =
    `Pick colors and extract palettes from SVG, PNG, JPG, JPEG, and WebP in your browser. Preview fills and strokes, copy HEX, RGB, or HSL values, and build clean design palettes.`;
  const canonical = "https://www.ilovesvg.com/free-color-picker";

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

/* ========================
   FAQ JSON-LD
======================== */
function faqJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What formats can I copy?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You can copy HEX, RGB, and HSL values. Alpha is supported using RGBA and HSLA.",
        },
      },
      {
        "@type": "Question",
        name: "Can I extract a color palette from an SVG or image?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Upload an SVG or an image (PNG/JPG/WebP) to extract a palette, then click a swatch to preview and copy it.",
        },
      },
      {
        "@type": "Question",
        name: "Does this tool upload anything?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. The picker and palette extraction run entirely in your browser and do not upload your files.",
        },
      },
      {
        "@type": "Question",
        name: "How is this useful for SVG?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Use it to choose fill and stroke colors quickly, preview them on shapes, and copy values directly into your SVG or CSS.",
        },
      },
    ],
  };

  return JSON.stringify(data);
}

/* ========================
   Color helpers
======================== */
function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function isHexColor(s: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s.trim());
}

function normalizeHex(hex: string) {
  let h = hex.trim().toLowerCase();
  if (!h.startsWith("#")) h = `#${h}`;

  if (!isHexColor(h)) return null;

  if (h.length === 4) {
    const r = h[1];
    const g = h[2];
    const b = h[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return h;
}

function hexToRgba(
  hex: string,
): { r: number; g: number; b: number; a: number } | null {
  const h = normalizeHex(hex);
  if (!h) return null;
  const raw = h.replace("#", "");

  if (raw.length === 6) {
    const n = Number.parseInt(raw, 16);
    if (Number.isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }

  if (raw.length === 8) {
    const n = Number.parseInt(raw, 16);
    if (Number.isNaN(n)) return null;

    const r = (n >> 24) & 255;
    const g = (n >> 16) & 255;
    const b = (n >> 8) & 255;
    const a = (n & 255) / 255;

    return { r, g, b, a };
  }

  return null;
}

function rgbToHex(r: number, g: number, b: number) {
  const to2 = (x: number) =>
    clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`.toLowerCase();
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;

  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }

    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function rgbaToCss(r: number, g: number, b: number, a: number) {
  const aa = clamp(a, 0, 1);
  return `rgba(${r}, ${g}, ${b}, ${aa.toFixed(2)})`;
}

function distSq(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
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

  return `${
    value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)
  } ${units[unitIndex]}`;
}

/* ========================
   React helpers
======================== */
function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

/* ========================
   Export helpers
======================== */
function safeFileBaseName(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "color-output"
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadTextFile(text: string, filename: string, type: string) {
  downloadBlob(new Blob([text], { type }), filename);
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.decoding = "async";

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load preview image."));
    img.src = src;
  });
}

function blobUrlToDataUrl(url: string): Promise<string> {
  return fetch(url)
    .then((response) => response.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () =>
            reject(new Error("Could not read output image."));
          reader.readAsDataURL(blob);
        }),
    );
}

function drawCanvasCheckerboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  size = 16,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = "#e5e7eb";
  for (let yy = y; yy < y + h; yy += size) {
    for (let xx = x; xx < x + w; xx += size) {
      const cx = Math.floor((xx - x) / size);
      const cy = Math.floor((yy - y) / size);
      if ((cx + cy) % 2 === 0) {
        ctx.fillRect(xx, yy, size, size);
      }
    }
  }

  ctx.restore();
}

/* ========================
   Palette extraction
======================== */
type PaletteSwatch = {
  hex: string;
  weight: number;
  inputAlpha: number;
};

async function extractPaletteFromImageFile(
  file: File,
  k = 8,
): Promise<PaletteSwatch[]> {
  const url = URL.createObjectURL(file);

  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();

    const MAX_W = 520;
    const scale = Math.min(1, MAX_W / Math.max(img.naturalWidth || 1, 1));
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const data = ctx.getImageData(0, 0, w, h).data;
    const buckets = new Map<
      string,
      {
        count: number;
        r: number;
        g: number;
        b: number;
        a: number;
        exact: Map<string, number>;
      }
    >();

    let visibleSamples = 0;
    const pixelStep = Math.max(1, Math.floor((w * h) / 50000));

    for (let px = 0; px < w * h; px += pixelStep) {
      const i = px * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 20) continue;

      visibleSamples += 1;

      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const exactHex = rgbToHex(r, g, b);
      const bucket = buckets.get(key) || {
        count: 0,
        r: 0,
        g: 0,
        b: 0,
        a: 0,
        exact: new Map<string, number>(),
      };

      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.a += a / 255;
      bucket.exact.set(exactHex, (bucket.exact.get(exactHex) || 0) + 1);
      buckets.set(key, bucket);
    }

    if (visibleSamples === 0) return [];

    const minimumUsefulWeight = Math.max(
      3,
      Math.floor(visibleSamples * 0.0025),
    );

    const bucketSwatches: PaletteSwatch[] = Array.from(buckets.values())
      .filter((bucket) => bucket.count >= minimumUsefulWeight)
      .map((bucket) => {
        let bestExact = "";
        let bestExactCount = -1;

        for (const [exactHex, count] of bucket.exact.entries()) {
          if (count > bestExactCount) {
            bestExact = exactHex;
            bestExactCount = count;
          }
        }

        const averageHex = rgbToHex(
          bucket.r / bucket.count,
          bucket.g / bucket.count,
          bucket.b / bucket.count,
        );

        return {
          hex: bestExact || averageHex,
          weight: bucket.count,
          inputAlpha: clamp(bucket.a / bucket.count, 0, 1),
        };
      })
      .sort((a, b) => b.weight - a.weight);

    const deduped: PaletteSwatch[] = [];

    for (const swatch of bucketSwatches) {
      const rgba = hexToRgba(swatch.hex);
      if (!rgba) continue;

      const duplicate = deduped.some((existing) => {
        const existingRgba = hexToRgba(existing.hex);
        if (!existingRgba) return false;
        return distSq(rgba, existingRgba) < 22 * 22;
      });

      if (!duplicate) deduped.push(swatch);
      if (deduped.length >= k) break;
    }

    return deduped;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function extractHexColorsFromSvgText(svgText: string): string[] {
  const out = new Set<string>();

  const hexMatches = svgText.match(
    /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
  );

  if (hexMatches) {
    for (const h of hexMatches) {
      const n = normalizeHex(h);
      if (!n) continue;

      const rgba = hexToRgba(n);
      if (rgba) out.add(rgbToHex(rgba.r, rgba.g, rgba.b));
    }
  }

  const rgbMatches = svgText.match(
    /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+\s*)?\)/g,
  );

  if (rgbMatches) {
    for (const token of rgbMatches) {
      const m = token.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (!m) continue;

      const r = clamp(Number(m[1]), 0, 255);
      const g = clamp(Number(m[2]), 0, 255);
      const b = clamp(Number(m[3]), 0, 255);

      out.add(rgbToHex(r, g, b));
    }
  }

  const commonNamed: Record<string, string> = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    yellow: "#ffff00",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    gray: "#808080",
    grey: "#808080",
    orange: "#ffa500",
    purple: "#800080",
    pink: "#ffc0cb",
    brown: "#a52a2a",
  };

  const namedMatches = svgText.match(
    /\b(black|white|red|green|blue|yellow|cyan|magenta|gray|grey|orange|purple|pink|brown)\b/gi,
  );

  if (namedMatches) {
    for (const n of namedMatches) {
      const key = n.toLowerCase();
      if (commonNamed[key]) out.add(commonNamed[key]);
    }
  }

  return Array.from(out);
}

/* ========================
   SVG safety and output processing
======================== */
function sanitizeInlineSvg(svgText: string) {
  let s = String(svgText || "");

  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  s = s.replace(/\son[a-z]+\s*=\s*["'][^"']*["']/gi, "");
  s = s.replace(/xlink:href\s*=\s*["']\s*javascript:[^"']*["']/gi, "");
  s = s.replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, "");

  return s;
}

function buildPaletteMappings(
  sourcePalette: PaletteSwatch[],
  outputPalette: string[],
  outputAlphas: number[],
) {
  return sourcePalette
    .map((source, idx) => {
      const sourceHex = normalizeHex(source.hex);
      const outputHex = normalizeHex(outputPalette[idx] || source.hex);
      const outputRgba = outputHex ? hexToRgba(outputHex) : null;
      const outputAlpha = clamp(outputAlphas[idx] ?? 1, 0, 1);

      if (!sourceHex || !outputHex || !outputRgba) return null;

      return {
        sourceHex,
        outputHex,
        outputAlpha,
        outputCss:
          outputAlpha < 1
            ? rgbaToCss(outputRgba.r, outputRgba.g, outputRgba.b, outputAlpha)
            : outputHex,
        outputRgb: {
          r: outputRgba.r,
          g: outputRgba.g,
          b: outputRgba.b,
        },
      };
    })
    .filter(Boolean) as Array<{
    sourceHex: string;
    outputHex: string;
    outputAlpha: number;
    outputCss: string;
    outputRgb: { r: number; g: number; b: number };
  }>;
}

function recolorSvgText(
  svgText: string,
  sourcePalette: PaletteSwatch[],
  outputPalette: string[],
  outputAlphas: number[],
) {
  const mappings = buildPaletteMappings(
    sourcePalette,
    outputPalette,
    outputAlphas,
  );

  if (mappings.length === 0) {
    return sanitizeInlineSvg(svgText);
  }

  const bySourceHex = new Map<string, string>();

  for (const mapping of mappings) {
    const parsed = hexToRgba(mapping.sourceHex);
    if (!parsed) continue;
    bySourceHex.set(rgbToHex(parsed.r, parsed.g, parsed.b), mapping.outputCss);
  }

  let out = String(svgText || "");

  out = out.replace(
    /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
    (match) => {
      const normalized = normalizeHex(match);
      if (!normalized) return match;
      const parsed = hexToRgba(normalized);
      if (!parsed) return match;
      const matchHex = rgbToHex(parsed.r, parsed.g, parsed.b);
      return bySourceHex.get(matchHex) || match;
    },
  );

  out = out.replace(
    /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+\s*)?\)/gi,
    (match) => {
      const m = match.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (!m) return match;
      const r = clamp(Number(m[1]), 0, 255);
      const g = clamp(Number(m[2]), 0, 255);
      const b = clamp(Number(m[3]), 0, 255);
      const matchHex = rgbToHex(r, g, b);
      return bySourceHex.get(matchHex) || match;
    },
  );

  const commonNamed: Record<string, string> = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    yellow: "#ffff00",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    gray: "#808080",
    grey: "#808080",
    orange: "#ffa500",
    purple: "#800080",
    pink: "#ffc0cb",
    brown: "#a52a2a",
  };

  out = out.replace(
    /\b(black|white|red|green|blue|yellow|cyan|magenta|gray|grey|orange|purple|pink|brown)\b/gi,
    (match) => {
      const namedHex = commonNamed[match.toLowerCase()];
      return bySourceHex.get(namedHex) || match;
    },
  );

  return sanitizeInlineSvg(out);
}

/* ========================
   File helpers
======================== */
type ImageDims = {
  w: number;
  h: number;
  mp: number;
};

function getImageDimensions(file: File): Promise<ImageDims | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(null);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      URL.revokeObjectURL(url);

      if (!w || !h) {
        resolve(null);
        return;
      }

      resolve({
        w,
        h,
        mp: (w * h) / 1_000_000,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

/* ========================
   Page
======================== */
type UploadedPreview =
  | { kind: "none" }
  | { kind: "image"; url: string; name: string; size: number }
  | { kind: "svg"; text: string; name: string; size: number };

export default function FreeColorPicker() {
  const [hex, setHex] = React.useState("#0b2dff");
  const [alpha, setAlpha] = React.useState(1);
  const [toast, setToast] = React.useState<string | null>(null);

  const [palette, setPalette] = React.useState<PaletteSwatch[]>([]);
  const [outputPalette, setOutputPalette] = React.useState<string[]>([]);
  const [outputAlphas, setOutputAlphas] = React.useState<number[]>([]);
  const [selectedPaletteIndex, setSelectedPaletteIndex] = React.useState<
    number | null
  >(null);

  const [extracting, setExtracting] = React.useState(false);
  const [extractErr, setExtractErr] = React.useState<string | null>(null);

  const [preview, setPreview] = React.useState<UploadedPreview>({
    kind: "none",
  });

  const [outputImageUrl, setOutputImageUrl] = React.useState<string | null>(
    null,
  );

  const [transparentBackgroundMode, setTransparentBackgroundMode] =
    React.useState<"preserve" | "replace">("preserve");
  const [backgroundHex, setBackgroundHex] = React.useState("#ffffff");
  const [backgroundAlpha, setBackgroundAlpha] = React.useState(1);

  const [dims, setDims] = React.useState<ImageDims | null>(null);
  const outputImageUrlRef = React.useRef<string | null>(null);
  const colorCommitTimeoutRef = React.useRef<number | null>(null);
  const alphaCommitTimeoutRef = React.useRef<number | null>(null);
  const colorPickerDraftRef = React.useRef("#0b2dff");
  const backgroundPickerDraftRef = React.useRef("#ffffff");
  const pendingColorCommitRef = React.useRef<{
    index: number;
    hex: string;
  } | null>(null);
  const pendingAlphaCommitRef = React.useRef<{
    index: number;
    alpha: number;
  } | null>(null);

  const rgba = React.useMemo(
    () => hexToRgba(hex) ?? { r: 11, g: 45, b: 255, a: 1 },
    [hex],
  );

  const rgb = React.useMemo(
    () => ({ r: rgba.r, g: rgba.g, b: rgba.b }),
    [rgba.r, rgba.g, rgba.b],
  );

  const hsl = React.useMemo(() => rgbToHsl(rgb.r, rgb.g, rgb.b), [rgb]);

  const hexOut = rgbToHex(rgb.r, rgb.g, rgb.b);
  const rgbOut = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const rgbaOut = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha.toFixed(2)})`;
  const hslOut = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  const hslaOut = `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${alpha.toFixed(2)})`;
  const previewFill = rgbaToCss(rgb.r, rgb.g, rgb.b, alpha);

  const selectedSourceHex =
    selectedPaletteIndex !== null ? palette[selectedPaletteIndex]?.hex : null;
  const selectedOutputHex =
    selectedPaletteIndex !== null ? outputPalette[selectedPaletteIndex] : null;
  const selectedOutputAlpha =
    selectedPaletteIndex !== null
      ? (outputAlphas[selectedPaletteIndex] ?? 1)
      : alpha;

  const debouncedOutputPalette = useDebouncedValue(outputPalette, 260);
  const debouncedOutputAlphas = useDebouncedValue(outputAlphas, 260);
  const debouncedPalette = useDebouncedValue(palette, 260);
  const debouncedBackgroundMode = useDebouncedValue(
    transparentBackgroundMode,
    260,
  );
  const debouncedBackgroundHex = useDebouncedValue(backgroundHex, 260);
  const debouncedBackgroundAlpha = useDebouncedValue(backgroundAlpha, 260);

  const outputSvgMarkup = React.useMemo(() => {
    if (preview.kind !== "svg") return "";
    return recolorSvgText(
      preview.text,
      debouncedPalette,
      debouncedOutputPalette,
      debouncedOutputAlphas,
    );
  }, [
    preview,
    debouncedPalette,
    debouncedOutputPalette,
    debouncedOutputAlphas,
    debouncedBackgroundMode,
    debouncedBackgroundHex,
    debouncedBackgroundAlpha,
  ]);

  const checkerStyle = React.useMemo<React.CSSProperties>(
    () => ({
      backgroundColor: "#ffffff",
      backgroundImage:
        "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
      backgroundSize: "20px 20px",
      backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
    }),
    [],
  );

  React.useEffect(() => {
    return () => {
      if (preview.kind === "image") URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  React.useEffect(() => {
    return () => {
      if (outputImageUrlRef.current) {
        URL.revokeObjectURL(outputImageUrlRef.current);
        outputImageUrlRef.current = null;
      }

      if (colorCommitTimeoutRef.current) {
        window.clearTimeout(colorCommitTimeoutRef.current);
        colorCommitTimeoutRef.current = null;
      }

      if (alphaCommitTimeoutRef.current) {
        window.clearTimeout(alphaCommitTimeoutRef.current);
        alphaCommitTimeoutRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    if (preview.kind !== "image") {
      return () => {
        cancelled = true;
      };
    }

    const mappings = buildPaletteMappings(
      debouncedPalette,
      debouncedOutputPalette,
      debouncedOutputAlphas,
    );

    const img = new Image();
    img.decoding = "async";

    img.onload = () => {
      if (cancelled) return;

      const maxSide = 900;
      const rawW = img.naturalWidth || img.width || 1;
      const rawH = img.naturalHeight || img.height || 1;
      const scale = Math.min(1, maxSide / Math.max(rawW, rawH));
      const w = Math.max(1, Math.round(rawW * scale));
      const h = Math.max(1, Math.round(rawH * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      const threshold = 42 * 42;
      const replacementBackground =
        debouncedBackgroundMode === "replace"
          ? hexToRgba(debouncedBackgroundHex)
          : null;
      const replacementBackgroundAlpha = clamp(debouncedBackgroundAlpha, 0, 1);

      const sourceRgbMappings = mappings
        .map((mapping) => {
          const source = hexToRgba(mapping.sourceHex);
          if (!source) return null;

          return {
            source: { r: source.r, g: source.g, b: source.b },
            output: mapping.outputRgb,
            outputAlpha: mapping.outputAlpha,
          };
        })
        .filter(Boolean) as Array<{
        source: { r: number; g: number; b: number };
        output: { r: number; g: number; b: number };
        outputAlpha: number;
      }>;

      for (let i = 0; i < data.length; i += 4) {
        const originalAlpha = data[i + 3];

        if (originalAlpha <= 0) {
          if (replacementBackground) {
            data[i] = replacementBackground.r;
            data[i + 1] = replacementBackground.g;
            data[i + 2] = replacementBackground.b;
            data[i + 3] = Math.round(255 * replacementBackgroundAlpha);
          }
          continue;
        }

        let bestMapping: {
          source: { r: number; g: number; b: number };
          output: { r: number; g: number; b: number };
          outputAlpha: number;
        } | null = null;
        let bestDistance = Infinity;

        for (const mapping of sourceRgbMappings) {
          const distance = distSq(
            { r: data[i], g: data[i + 1], b: data[i + 2] },
            mapping.source,
          );

          if (distance < bestDistance) {
            bestDistance = distance;
            bestMapping = mapping;
          }
        }

        if (!bestMapping || bestDistance > threshold) continue;

        data[i] = bestMapping.output.r;
        data[i + 1] = bestMapping.output.g;
        data[i + 2] = bestMapping.output.b;
        data[i + 3] = Math.round(
          originalAlpha * clamp(bestMapping.outputAlpha, 0, 1),
        );
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        if (cancelled || !blob) return;

        const nextOutputUrl = URL.createObjectURL(blob);
        const previousOutputUrl = outputImageUrlRef.current;

        outputImageUrlRef.current = nextOutputUrl;
        setOutputImageUrl(nextOutputUrl);

        if (previousOutputUrl) {
          window.setTimeout(() => URL.revokeObjectURL(previousOutputUrl), 0);
        }
      }, "image/png");
    };

    img.src = preview.url;

    return () => {
      cancelled = true;
    };
  }, [
    preview,
    debouncedPalette,
    debouncedOutputPalette,
    debouncedOutputAlphas,
    debouncedBackgroundMode,
    debouncedBackgroundHex,
    debouncedBackgroundAlpha,
  ]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  }

  async function copy(text: string, msg: string) {
    await navigator.clipboard.writeText(text);
    showToast(msg);
  }

  function flushPendingColorCommit() {
    if (colorCommitTimeoutRef.current) {
      window.clearTimeout(colorCommitTimeoutRef.current);
      colorCommitTimeoutRef.current = null;
    }

    const pending = pendingColorCommitRef.current;
    pendingColorCommitRef.current = null;

    if (!pending) return;

    setOutputPalette((prev) => {
      const next = [...prev];
      next[pending.index] = pending.hex;
      return next;
    });
  }

  function flushPendingAlphaCommit() {
    if (alphaCommitTimeoutRef.current) {
      window.clearTimeout(alphaCommitTimeoutRef.current);
      alphaCommitTimeoutRef.current = null;
    }

    const pending = pendingAlphaCommitRef.current;
    pendingAlphaCommitRef.current = null;

    if (!pending) return;

    setOutputAlphas((prev) => {
      const next = [...prev];
      next[pending.index] = pending.alpha;
      return next;
    });
  }

  function queueOutputColorCommit(index: number, nextHex: string) {
    pendingColorCommitRef.current = { index, hex: nextHex };

    if (colorCommitTimeoutRef.current) return;

    colorCommitTimeoutRef.current = window.setTimeout(() => {
      colorCommitTimeoutRef.current = null;
      flushPendingColorCommit();
    }, 48);
  }

  function queueOutputAlphaCommit(index: number, nextAlpha: number) {
    pendingAlphaCommitRef.current = { index, alpha: clamp(nextAlpha, 0, 1) };

    if (alphaCommitTimeoutRef.current) return;

    alphaCommitTimeoutRef.current = window.setTimeout(() => {
      alphaCommitTimeoutRef.current = null;
      flushPendingAlphaCommit();
    }, 48);
  }

  function updateOutputColor(nextHex: string) {
    colorPickerDraftRef.current = nextHex;
    setHex(nextHex);

    const normalized = normalizeHex(nextHex);
    const parsed = normalized ? hexToRgba(normalized) : null;

    if (selectedPaletteIndex === null || !parsed) return;

    const cleanHex = rgbToHex(parsed.r, parsed.g, parsed.b);
    queueOutputColorCommit(selectedPaletteIndex, cleanHex);
  }

  function updateSelectedAlpha(nextAlpha: number) {
    const cleanAlpha = clamp(nextAlpha, 0, 1);
    setAlpha(cleanAlpha);

    if (selectedPaletteIndex === null) return;

    queueOutputAlphaCommit(selectedPaletteIndex, cleanAlpha);
  }

  function onHexInput(v: string) {
    const cleaned = v.trim();
    const nextValue = cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
    updateOutputColor(nextValue);
  }

  function commitCurrentColorAndAlpha() {
    updateOutputColor(hex);
    updateSelectedAlpha(alpha);
    flushPendingColorCommit();
    flushPendingAlphaCommit();
  }

  function selectPaletteSwatch(index: number) {
    const sourceSwatch = palette[index];
    if (!sourceSwatch) return;

    flushPendingColorCommit();
    flushPendingAlphaCommit();

    const outputHex = outputPalette[index] || sourceSwatch.hex;
    const parsed = hexToRgba(outputHex);
    const nextAlpha = outputAlphas[index] ?? 1;

    setSelectedPaletteIndex(index);
    setAlpha(nextAlpha);

    if (parsed) {
      const nextHex = rgbToHex(parsed.r, parsed.g, parsed.b);
      colorPickerDraftRef.current = nextHex;
      setHex(nextHex);
    }
  }

  function resetOutputPaletteToInput() {
    if (palette.length === 0) {
      showToast("Upload a file first");
      return;
    }

    if (colorCommitTimeoutRef.current) {
      window.clearTimeout(colorCommitTimeoutRef.current);
      colorCommitTimeoutRef.current = null;
    }

    if (alphaCommitTimeoutRef.current) {
      window.clearTimeout(alphaCommitTimeoutRef.current);
      alphaCommitTimeoutRef.current = null;
    }

    pendingColorCommitRef.current = null;
    pendingAlphaCommitRef.current = null;

    const resetPalette = palette.map((p) => p.hex);
    const resetAlphas = palette.map(() => 1);

    setOutputPalette(resetPalette);
    setOutputAlphas(resetAlphas);
    setAlpha(1);

    if (selectedPaletteIndex !== null && resetPalette[selectedPaletteIndex]) {
      colorPickerDraftRef.current = resetPalette[selectedPaletteIndex];
      setHex(resetPalette[selectedPaletteIndex]);
    } else {
      setSelectedPaletteIndex(0);
      colorPickerDraftRef.current = resetPalette[0];
      setHex(resetPalette[0]);
    }

    showToast("Output palette reset");
  }

  async function handlePickedFile(f: File | null) {
    if (!f) return;

    setExtractErr(null);
    setExtracting(true);
    pendingColorCommitRef.current = null;
    pendingAlphaCommitRef.current = null;

    if (colorCommitTimeoutRef.current) {
      window.clearTimeout(colorCommitTimeoutRef.current);
      colorCommitTimeoutRef.current = null;
    }

    if (alphaCommitTimeoutRef.current) {
      window.clearTimeout(alphaCommitTimeoutRef.current);
      alphaCommitTimeoutRef.current = null;
    }

    setPalette([]);
    setOutputPalette([]);
    setOutputAlphas([]);
    setSelectedPaletteIndex(null);
    setDims(null);
    setTransparentBackgroundMode("preserve");
    setBackgroundHex("#ffffff");
    setBackgroundAlpha(1);
    backgroundPickerDraftRef.current = "#ffffff";

    if (outputImageUrlRef.current) {
      URL.revokeObjectURL(outputImageUrlRef.current);
      outputImageUrlRef.current = null;
    }

    setOutputImageUrl(null);

    if (preview.kind === "image") URL.revokeObjectURL(preview.url);
    setPreview({ kind: "none" });

    try {
      if (f.size > MAX_UPLOAD_BYTES) {
        throw new Error(
          `File is too large. Maximum size is ${prettyBytes(MAX_UPLOAD_BYTES)}.`,
        );
      }

      const detectedDims = await getImageDimensions(f);

      if (detectedDims) {
        if (detectedDims.mp > MAX_MP) {
          throw new Error(`Image is too large. Maximum size is ${MAX_MP} MP.`);
        }

        if (Math.max(detectedDims.w, detectedDims.h) > MAX_SIDE) {
          throw new Error(
            `Image is too large. Longest side must be ${MAX_SIDE}px or less.`,
          );
        }

        setDims(detectedDims);
      }

      const name = f.name || "upload";
      const lower = name.toLowerCase();

      const isSvg =
        f.type === "image/svg+xml" ||
        lower.endsWith(".svg") ||
        lower.endsWith(".svgz");

      if (isSvg && !lower.endsWith(".svgz")) {
        const text = await f.text();

        setPreview({ kind: "svg", text, name, size: f.size });

        const colors = extractHexColorsFromSvgText(text);
        const swatches: PaletteSwatch[] = colors.map((c, i) => ({
          hex: c,
          weight: colors.length - i,
          inputAlpha: 1,
        }));

        const trimmed = swatches.slice(0, 12);

        setPalette(trimmed);
        setOutputPalette(trimmed.map((swatch) => swatch.hex));
        setOutputAlphas(trimmed.map(() => 1));

        if (trimmed.length > 0) {
          setSelectedPaletteIndex(0);
          colorPickerDraftRef.current = trimmed[0].hex;
          setHex(trimmed[0].hex);
          setAlpha(1);
        }

        return;
      }

      if (!f.type.startsWith("image/")) {
        throw new Error("Please upload an SVG or an image file.");
      }

      const url = URL.createObjectURL(f);
      setPreview({ kind: "image", url, name, size: f.size });

      const sw = await extractPaletteFromImageFile(f, 8);

      if (!sw.length) {
        throw new Error("Could not extract colors from this file.");
      }

      setPalette(sw);
      setOutputPalette(sw.map((swatch) => swatch.hex));
      setOutputAlphas(sw.map(() => 1));

      setSelectedPaletteIndex(0);
      colorPickerDraftRef.current = sw[0].hex;
      setHex(sw[0].hex);
      setAlpha(1);
    } catch (err: any) {
      setExtractErr(err?.message || "Failed to extract palette.");
    } finally {
      setExtracting(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.currentTarget.value = "";
    void handlePickedFile(f);
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();

    const f = e.dataTransfer.files?.[0] ?? null;
    void handlePickedFile(f);
  }

  function clearUpload() {
    pendingColorCommitRef.current = null;
    pendingAlphaCommitRef.current = null;

    if (colorCommitTimeoutRef.current) {
      window.clearTimeout(colorCommitTimeoutRef.current);
      colorCommitTimeoutRef.current = null;
    }

    if (alphaCommitTimeoutRef.current) {
      window.clearTimeout(alphaCommitTimeoutRef.current);
      alphaCommitTimeoutRef.current = null;
    }

    setPalette([]);
    setOutputPalette([]);
    setOutputAlphas([]);
    setSelectedPaletteIndex(null);
    setExtractErr(null);
    setExtracting(false);
    setDims(null);

    if (outputImageUrlRef.current) {
      URL.revokeObjectURL(outputImageUrlRef.current);
      outputImageUrlRef.current = null;
    }

    setOutputImageUrl(null);

    if (preview.kind === "image") URL.revokeObjectURL(preview.url);

    setPreview({ kind: "none" });
  }

  function getExportBaseName() {
    if (preview.kind === "none") return "color-output";
    return safeFileBaseName(preview.name);
  }

  function getEffectiveOutputPalette() {
    const next = [...outputPalette];
    const pending = pendingColorCommitRef.current;

    if (pending) next[pending.index] = pending.hex;

    return next;
  }

  function getEffectiveOutputAlphas() {
    const next = [...outputAlphas];
    const pending = pendingAlphaCommitRef.current;

    if (pending) next[pending.index] = pending.alpha;

    return next;
  }

  function getInputPreviewSrc() {
    if (preview.kind === "none") return "";
    if (preview.kind === "svg")
      return svgToDataUrl(sanitizeInlineSvg(preview.text));
    return preview.url;
  }

  function getOutputPreviewSrc() {
    if (preview.kind === "none") return "";
    if (preview.kind === "svg") {
      return svgToDataUrl(
        recolorSvgText(
          preview.text,
          palette,
          getEffectiveOutputPalette(),
          getEffectiveOutputAlphas(),
        ),
      );
    }

    return outputImageUrl || preview.url;
  }

  async function getOutputSvgCode() {
    if (preview.kind === "none") return null;

    if (preview.kind === "svg") {
      return recolorSvgText(
        preview.text,
        palette,
        getEffectiveOutputPalette(),
        getEffectiveOutputAlphas(),
      );
    }

    const src = outputImageUrl || preview.url;
    if (!src) return null;

    const dataUrl = await blobUrlToDataUrl(src);
    const width = Math.max(1, dims?.w || 1000);
    const height = Math.max(1, dims?.h || 1000);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Recolored output from iLoveSVG"><image href="${escapeHtml(dataUrl)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" /></svg>`;
  }

  async function copyOutputSvgCode() {
    flushPendingColorCommit();
    flushPendingAlphaCommit();

    const svg = await getOutputSvgCode();

    if (!svg) {
      showToast("No SVG output to copy");
      return;
    }

    await navigator.clipboard.writeText(svg);
    showToast("SVG copied");
  }

  async function downloadOutputSvg() {
    flushPendingColorCommit();
    flushPendingAlphaCommit();

    const svg = await getOutputSvgCode();

    if (!svg) {
      showToast("No SVG output to download");
      return;
    }

    downloadTextFile(
      svg,
      `${getExportBaseName()}-recolored.svg`,
      "image/svg+xml;charset=utf-8",
    );

    showToast("SVG downloaded");
  }

  function downloadOutputPng() {
    if (preview.kind !== "image") {
      showToast("No PNG output available");
      return;
    }

    flushPendingColorCommit();
    flushPendingAlphaCommit();

    const a = document.createElement("a");
    a.href = outputImageUrl || preview.url;
    a.download = `${getExportBaseName()}-recolored.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    showToast("PNG downloaded");
  }

  function getPaletteRows() {
    const effectiveOutputPalette = getEffectiveOutputPalette();
    const effectiveOutputAlphas = getEffectiveOutputAlphas();

    return palette.map((source, index) => ({
      sourceHex: source.hex,
      sourceAlpha: clamp(source.inputAlpha ?? 1, 0, 1),
      outputHex: effectiveOutputPalette[index] || source.hex,
      outputAlpha: clamp(effectiveOutputAlphas[index] ?? 1, 0, 1),
    }));
  }

  async function createReportPngBlob() {
    commitCurrentColorAndAlpha();

    const rows = getPaletteRows();
    const reportWidth = 1400;
    const padding = 48;
    const previewBoxW = 610;
    const previewBoxH = 390;
    const inputX = padding;
    const outputX = reportWidth - padding - previewBoxW;
    const previewY = 142;
    const rowHeight = 48;
    const tableY = previewY + previewBoxH + 94;
    const reportHeight = Math.max(
      960,
      tableY + 86 + rows.length * rowHeight + 96,
    );

    const canvas = document.createElement("canvas");
    canvas.width = reportWidth;
    canvas.height = reportHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create report.");

    const reportCtx = ctx;

    reportCtx.fillStyle = "#ffffff";
    reportCtx.fillRect(0, 0, reportWidth, reportHeight);

    reportCtx.fillStyle = "#0f172a";
    reportCtx.font = "700 38px Arial, sans-serif";
    reportCtx.fillText("Color export report", padding, 60);

    reportCtx.fillStyle = "#64748b";
    reportCtx.font = "16px Arial, sans-serif";
    reportCtx.fillText(
      "Input preview, output preview, palette mapping, and separate alpha values",
      padding,
      90,
    );

    reportCtx.fillStyle = "#e2e8f0";
    reportCtx.fillRect(padding, 112, reportWidth - padding * 2, 1);

    function roundedBox(x: number, y: number, w: number, h: number, r: number) {
      reportCtx.beginPath();
      reportCtx.roundRect(x, y, w, h, r);
      reportCtx.fill();
      reportCtx.stroke();
    }

    async function drawPreviewBox(label: string, src: string, x: number) {
      reportCtx.fillStyle = "#0f172a";
      reportCtx.font = "700 20px Arial, sans-serif";
      reportCtx.fillText(label, x, previewY - 20);

      reportCtx.save();
      reportCtx.beginPath();
      reportCtx.roundRect(x, previewY, previewBoxW, previewBoxH, 22);
      reportCtx.clip();
      drawCanvasCheckerboard(
        reportCtx,
        x,
        previewY,
        previewBoxW,
        previewBoxH,
        18,
      );
      reportCtx.restore();

      reportCtx.strokeStyle = "#dbe3ef";
      reportCtx.lineWidth = 2;
      reportCtx.beginPath();
      reportCtx.roundRect(x, previewY, previewBoxW, previewBoxH, 22);
      reportCtx.stroke();

      const innerPad = 24;
      const innerX = x + innerPad;
      const innerY = previewY + innerPad;
      const innerW = previewBoxW - innerPad * 2;
      const innerH = previewBoxH - innerPad * 2;

      if (!src) {
        reportCtx.fillStyle = "#64748b";
        reportCtx.font = "16px Arial, sans-serif";
        reportCtx.fillText("Preview unavailable", innerX + 24, innerY + 48);
        return;
      }

      try {
        const img = await loadCanvasImage(src);
        const ratio = Math.min(innerW / img.width, innerH / img.height, 1);
        const drawW = img.width * ratio;
        const drawH = img.height * ratio;
        const drawX = innerX + (innerW - drawW) / 2;
        const drawY = innerY + (innerH - drawH) / 2;
        reportCtx.drawImage(img, drawX, drawY, drawW, drawH);
      } catch {
        reportCtx.fillStyle = "#64748b";
        reportCtx.font = "16px Arial, sans-serif";
        reportCtx.fillText("Preview unavailable", innerX + 24, innerY + 48);
      }
    }

    await drawPreviewBox("Input preview", getInputPreviewSrc(), inputX);
    await drawPreviewBox("Output preview", getOutputPreviewSrc(), outputX);

    const bgModeText =
      transparentBackgroundMode === "preserve"
        ? "Transparent background: preserved"
        : `Transparent background: replaced with ${backgroundHex} at ${backgroundAlpha.toFixed(2)} alpha`;

    reportCtx.fillStyle = "#64748b";
    reportCtx.font = "14px Arial, sans-serif";
    reportCtx.fillText(bgModeText, outputX, previewY + previewBoxH + 34);

    reportCtx.fillStyle = "#0f172a";
    reportCtx.font = "700 24px Arial, sans-serif";
    reportCtx.fillText("Palette mapping", padding, tableY - 30);

    reportCtx.fillStyle = "#64748b";
    reportCtx.font = "700 13px Arial, sans-serif";
    reportCtx.fillText("INPUT", padding, tableY);
    reportCtx.fillText("INPUT ALPHA", padding + 300, tableY);
    reportCtx.fillText("OUTPUT", padding + 520, tableY);
    reportCtx.fillText("OUTPUT ALPHA", padding + 850, tableY);

    let y = tableY + 22;

    for (const row of rows) {
      const outputRgba = hexToRgba(row.outputHex);
      const sourceRgba = hexToRgba(row.sourceHex);
      const outputCss = outputRgba
        ? rgbaToCss(outputRgba.r, outputRgba.g, outputRgba.b, row.outputAlpha)
        : row.outputHex;
      const sourceCss = sourceRgba
        ? rgbaToCss(sourceRgba.r, sourceRgba.g, sourceRgba.b, row.sourceAlpha)
        : row.sourceHex;

      reportCtx.fillStyle = "#e2e8f0";
      reportCtx.fillRect(padding, y + 40, reportWidth - padding * 2, 1);

      drawCanvasCheckerboard(reportCtx, padding, y, 38, 34, 8);
      reportCtx.fillStyle = sourceCss;
      reportCtx.strokeStyle = "#cbd5e1";
      reportCtx.lineWidth = 1;
      reportCtx.beginPath();
      reportCtx.roundRect(padding, y, 38, 34, 8);
      reportCtx.fill();
      reportCtx.stroke();

      reportCtx.fillStyle = "#0f172a";
      reportCtx.font = "16px Arial, sans-serif";
      reportCtx.fillText(row.sourceHex, padding + 52, y + 23);
      reportCtx.fillText(row.sourceAlpha.toFixed(2), padding + 300, y + 23);

      drawCanvasCheckerboard(reportCtx, padding + 520, y, 38, 34, 8);
      reportCtx.fillStyle = outputCss;
      reportCtx.strokeStyle = "#cbd5e1";
      reportCtx.beginPath();
      reportCtx.roundRect(padding + 520, y, 38, 34, 8);
      reportCtx.fill();
      reportCtx.stroke();

      reportCtx.fillStyle = "#0f172a";
      reportCtx.font = "16px Arial, sans-serif";
      reportCtx.fillText(row.outputHex, padding + 572, y + 23);
      reportCtx.fillText(row.outputAlpha.toFixed(2), padding + 850, y + 23);

      y += rowHeight;
    }

    reportCtx.fillStyle = "#64748b";
    reportCtx.font = "700 15px Arial, sans-serif";
    reportCtx.fillText("www.ilovesvg.com", padding, reportHeight - 36);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Could not create report image."));
          return;
        }

        resolve(blob);
      }, "image/png");
    });
  }

  async function downloadReportPng() {
    try {
      const blob = await createReportPngBlob();
      downloadBlob(blob, `${getExportBaseName()}-color-report.png`);
      showToast("Report image downloaded");
    } catch (err: any) {
      showToast(err?.message || "Could not create report image");
    }
  }

  async function printReportPdf() {
    flushPendingColorCommit();
    flushPendingAlphaCommit();

    const inputSrc = getInputPreviewSrc();
    const outputSrc = getOutputPreviewSrc();
    const rows = getPaletteRows();

    const reportWindow = window.open("", "_blank");

    if (!reportWindow) {
      showToast("Popup blocked. Allow popups to save PDF.");
      return;
    }

    reportWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Color export report</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; font-family: Arial, sans-serif; color: #0f172a; background: #ffffff; }
    h1 { margin: 0 0 6px; font-size: 30px; line-height: 1.2; }
    .muted { color: #64748b; font-size: 14px; }
    .layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; align-items: start; }
    .panel-title { font-weight: 700; margin: 0 0 10px; font-size: 16px; }
    .preview { border: 1px solid #dbe3ef; border-radius: 16px; min-height: 320px; padding: 18px; display: grid; place-items: center; background-color: #ffffff; background-image: linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px; }
    .preview img { max-width: 100%; max-height: 280px; display: block; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 28px; }
    th { color: #64748b; text-align: left; padding: 8px 6px; border-bottom: 1px solid #cbd5e1; font-size: 12px; letter-spacing: .04em; }
    td { border-bottom: 1px solid #e2e8f0; padding: 9px 6px; vertical-align: middle; }
    .chip { display: inline-block; width: 24px; height: 24px; border-radius: 7px; border: 1px solid #cbd5e1; vertical-align: middle; margin-right: 8px; }
    .footer { margin-top: 28px; color: #64748b; font-size: 12px; font-weight: 700; }
    @media print { body { padding: 18mm; } }
  </style>
</head>
<body>
  <h1>Color export report</h1>
  <div class="muted">Input and output previews with full palette mapping and per-color alpha values.</div>

  <div class="layout">
    <div>
      <div class="panel-title">Input preview</div>
      <div class="preview">
        ${inputSrc ? `<img src="${escapeHtml(inputSrc)}" alt="Input preview" />` : `<div class="muted">Preview unavailable</div>`}
      </div>
    </div>

    <div>
      <div class="panel-title">Output preview</div>
      <div class="preview">
        ${outputSrc ? `<img src="${escapeHtml(outputSrc)}" alt="Output preview" />` : `<div class="muted">Preview unavailable</div>`}
      </div>
    </div>
  </div>

  <div class="muted" style="margin-top: 14px;">
    ${
      transparentBackgroundMode === "preserve"
        ? "Transparent background: preserved"
        : `Transparent background: replaced with ${escapeHtml(backgroundHex)} at ${escapeHtml(backgroundAlpha.toFixed(2))} alpha`
    }
  </div>

  <table>
    <thead>
      <tr>
        <th>Input color</th>
        <th>Input alpha</th>
        <th>Output color</th>
        <th>Output alpha</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map((row) => {
          const outputRgba = hexToRgba(row.outputHex);
          const outputCss = outputRgba
            ? rgbaToCss(
                outputRgba.r,
                outputRgba.g,
                outputRgba.b,
                row.outputAlpha,
              )
            : row.outputHex;

          const sourceRgba = hexToRgba(row.sourceHex);
          const sourceCss = sourceRgba
            ? rgbaToCss(
                sourceRgba.r,
                sourceRgba.g,
                sourceRgba.b,
                row.sourceAlpha,
              )
            : row.sourceHex;

          return `<tr><td><span class="chip" style="background:${escapeHtml(sourceCss)}"></span>${escapeHtml(row.sourceHex)}</td><td>${escapeHtml(row.sourceAlpha.toFixed(2))}</td><td><span class="chip" style="background:${escapeHtml(outputCss)}"></span>${escapeHtml(row.outputHex)}</td><td>${escapeHtml(row.outputAlpha.toFixed(2))}</td></tr>`;
        })
        .join("")}
    </tbody>
  </table>

  <div class="footer">www.ilovesvg.com</div>

  <script>
    window.addEventListener("load", () => {
      window.setTimeout(() => window.print(), 300);
    });
  </script>
</body>
</html>`);

    reportWindow.document.close();
  }

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
              <h1 className="text-2xl text-sky-800 md:text-3xl font-extrabold leading-tight mb-2">
                Free Color Picker{" "}
                <span className="text-slate-500 text-base font-semibold">
                  + Palette Extractor (SVG & Images)
                </span>
              </h1>

              <div className="rounded-xl border border-slate-200 bg-white p-3 mb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-semibold">
                    Extract palette from file
                  </div>

                  <div className="flex items-center gap-2">
                    {palette.length > 0 && (
                      <button
                        type="button"
                        onClick={resetOutputPaletteToInput}
                        className="px-3 py-2 rounded-lg font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 cursor-pointer"
                      >
                        Reset
                      </button>
                    )}

                    {preview.kind !== "none" && (
                      <button
                        type="button"
                        onClick={clearUpload}
                        className="flex items-center justify-center px-3 py-2 rounded-lg font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                      >
                        <Icons name="trash" className="w-4 h-4 mr-1" />
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  Upload an <b>SVG</b> or an <b>image</b> to generate a palette.
                  The extracted palette below shows the current output colors.
                  Use Reset to restore the original input colors.
                </div>

                <div className="mt-3">
                  {preview.kind === "none" ? (
                    <DragArea
                      onPick={onPick}
                      onDrop={onDrop}
                      MAX_UPLOAD_BYTES={MAX_UPLOAD_BYTES}
                      MAX_MP={MAX_MP}
                      MAX_SIDE={MAX_SIDE}
                      extracting={extracting}
                    />
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#f7faff] border border-[#dae6ff] text-slate-900 mt-0">
                        <div className="flex items-center min-w-0 gap-2">
                          {preview.kind === "image" && (
                            <img
                              src={preview.url}
                              alt=""
                              className="w-[22px] h-[22px] rounded-md object-cover mr-1"
                            />
                          )}

                          <span
                            title={preview.name || ""}
                            className="truncate text-sm"
                          >
                            {preview.name} • {prettyBytes(preview.size)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={clearUpload}
                          className="px-2 py-1 rounded-md border border-[#d6e4ff] bg-[#eff4ff] cursor-pointer hover:bg-[#e5eeff]"
                          aria-label="Clear uploaded file"
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

                  {extractErr && (
                    <div className="mt-2 text-sm text-red-700">
                      {extractErr}
                    </div>
                  )}
                </div>

                {palette.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[13px] text-slate-600 mb-2">
                      Extracted palette. These swatches show the current output
                      colors. Click a swatch, then choose a new output color
                      below.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {palette.map((p, index) => {
                        const outputHex = outputPalette[index] || p.hex;
                        const isSelected = selectedPaletteIndex === index;

                        return (
                          <button
                            key={`${p.hex}-${index}`}
                            type="button"
                            onClick={() => selectPaletteSwatch(index)}
                            title={`Source ${p.hex} → Output ${outputHex}`}
                            className={[
                              "h-9 w-9 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-200",
                              isSelected ? "ring-2 ring-blue-400" : "",
                            ].join(" ")}
                            style={{ background: outputHex }}
                          />
                        );
                      })}
                    </div>

                    <div className="mt-2 text-[13px] text-slate-600">
                      Selected mapping:{" "}
                      <span className="font-semibold text-slate-900">
                        {selectedSourceHex || "None"}
                      </span>{" "}
                      →{" "}
                      <span className="font-semibold text-slate-900">
                        {selectedOutputHex || "None"}
                      </span>{" "}
                      <span className="text-slate-500">
                        · alpha {selectedOutputAlpha.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 bg-[#fafcff] border border-[#edf2fb] rounded-lg px-3 py-2 min-w-0">
                  <span className="min-w-[180px] text-[13px] text-slate-700 shrink-0">
                    Choose output color
                  </span>

                  <input
                    type="color"
                    value={hexOut}
                    onChange={(e) => updateOutputColor(e.currentTarget.value)}
                    onBlur={flushPendingColorCommit}
                    onMouseUp={flushPendingColorCommit}
                    onPointerUp={flushPendingColorCommit}
                    onTouchEnd={flushPendingColorCommit}
                    className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer"
                    aria-label="Output color picker"
                  />

                  <input
                    value={hex}
                    onChange={(e) => onHexInput(e.target.value)}
                    onBlur={(e) => updateOutputColor(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        updateOutputColor(e.currentTarget.value);
                    }}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    spellCheck={false}
                    inputMode="text"
                    aria-label="Hex output color"
                  />
                </label>

                <label className="flex items-center gap-3 bg-[#fafcff] border border-[#edf2fb] rounded-lg px-3 py-2 min-w-0">
                  <span className="min-w-[180px] text-[13px] text-slate-700 shrink-0">
                    Alpha ({alpha.toFixed(2)})
                  </span>

                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={alpha}
                    onChange={(e) =>
                      updateSelectedAlpha(Number(e.target.value))
                    }
                    onBlur={flushPendingAlphaCommit}
                    onMouseUp={flushPendingAlphaCommit}
                    onPointerUp={flushPendingAlphaCommit}
                    onTouchEnd={flushPendingAlphaCommit}
                    className="w-full accent-[#0b2dff] cursor-pointer"
                    aria-label="Alpha"
                  />
                </label>

                {preview.kind === "image" && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-sm font-semibold">
                          Transparent background
                        </div>
                        <div className="mt-1 text-[13px] text-slate-600">
                          Preserve transparent pixels by default, or replace the
                          transparent background with a selected color.
                        </div>
                      </div>

                      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            setTransparentBackgroundMode("preserve")
                          }
                          className={[
                            "px-3 py-2 text-[13px] font-semibold cursor-pointer",
                            transparentBackgroundMode === "preserve"
                              ? "bg-[#0b2dff] text-white"
                              : "bg-white text-slate-900 hover:bg-slate-50",
                          ].join(" ")}
                        >
                          Preserve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setTransparentBackgroundMode("replace")
                          }
                          className={[
                            "px-3 py-2 text-[13px] font-semibold cursor-pointer border-l border-slate-200",
                            transparentBackgroundMode === "replace"
                              ? "bg-[#0b2dff] text-white"
                              : "bg-white text-slate-900 hover:bg-slate-50",
                          ].join(" ")}
                        >
                          Replace
                        </button>
                      </div>
                    </div>

                    {transparentBackgroundMode === "replace" && (
                      <div className="mt-3 grid md:grid-cols-[1fr_1fr] gap-3">
                        <label className="flex items-center gap-3 bg-[#fafcff] border border-[#edf2fb] rounded-lg px-3 py-2 min-w-0">
                          <span className="min-w-[150px] text-[13px] text-slate-700 shrink-0">
                            Background color
                          </span>

                          <input
                            type="color"
                            value={normalizeHex(backgroundHex) || "#ffffff"}
                            onChange={(e) => {
                              backgroundPickerDraftRef.current =
                                e.currentTarget.value;
                              setBackgroundHex(e.currentTarget.value);
                            }}
                            className="w-14 h-7 rounded-md border border-[#dbe3ef] bg-white cursor-pointer"
                            aria-label="Replacement background color"
                          />

                          <input
                            value={backgroundHex}
                            onChange={(e) => {
                              const cleaned = e.currentTarget.value.trim();
                              const next = cleaned.startsWith("#")
                                ? cleaned
                                : `#${cleaned}`;
                              setBackgroundHex(next);
                              backgroundPickerDraftRef.current = next;
                            }}
                            onBlur={(e) => {
                              const normalized = normalizeHex(
                                e.currentTarget.value,
                              );
                              if (normalized) {
                                setBackgroundHex(normalized);
                                backgroundPickerDraftRef.current = normalized;
                              }
                            }}
                            className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                            spellCheck={false}
                            inputMode="text"
                            aria-label="Replacement background hex color"
                          />
                        </label>

                        <label className="flex items-center gap-3 bg-[#fafcff] border border-[#edf2fb] rounded-lg px-3 py-2 min-w-0">
                          <span className="min-w-[150px] text-[13px] text-slate-700 shrink-0">
                            Background alpha ({backgroundAlpha.toFixed(2)})
                          </span>

                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={backgroundAlpha}
                            onChange={(e) =>
                              setBackgroundAlpha(
                                clamp(Number(e.currentTarget.value), 0, 1),
                              )
                            }
                            className="w-full accent-[#0b2dff] cursor-pointer"
                            aria-label="Replacement background alpha"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-semibold">Copy values</div>

                  <div className="mt-3 grid gap-2">
                    <CopyRow
                      label="HEX"
                      value={hexOut}
                      onCopy={() => copy(hexOut, "HEX copied")}
                    />
                    <CopyRow
                      label="RGB"
                      value={rgbOut}
                      onCopy={() => copy(rgbOut, "RGB copied")}
                    />
                    <CopyRow
                      label="RGBA"
                      value={rgbaOut}
                      onCopy={() => copy(rgbaOut, "RGBA copied")}
                    />
                    <CopyRow
                      label="HSL"
                      value={hslOut}
                      onCopy={() => copy(hslOut, "HSL copied")}
                    />
                    <CopyRow
                      label="HSLA"
                      value={hslaOut}
                      onCopy={() => copy(hslaOut, "HSLA copied")}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 mt-4">
                <div className="text-sm font-semibold">Uploaded file</div>

                <div className="mt-2 text-sm text-slate-600">
                  This is the original input preview. It does not change when
                  you edit the output colors.
                </div>

                {preview.kind === "none" ? (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Upload an SVG or image to preview the input file here.
                  </div>
                ) : preview.kind === "image" ? (
                  <div
                    className="mt-3 rounded-xl border border-slate-200 p-3 overflow-hidden"
                    style={checkerStyle}
                  >
                    <img
                      src={preview.url}
                      alt="Uploaded input preview"
                      className="max-w-full h-auto block rounded-lg mx-auto transparent-checkerboard"
                    />
                  </div>
                ) : (
                  <div
                    className="mt-3 rounded-xl border border-slate-200 p-3 overflow-hidden"
                    style={checkerStyle}
                  >
                    <div
                      className="bg-white transparent-checkerboard rounded-lg border border-slate-200 p-3 overflow-auto"
                      aria-label="Uploaded SVG input preview"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeInlineSvg(preview.text),
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="order-2 min-w-0 overflow-auto rounded-2xl border border-slate-300/40 bg-[#43546b] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:sticky md:top-4 md:row-span-3 md:max-h-[calc(100vh-2rem)] md:self-start">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-semibold">
                      Output image preview
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      This preview updates from the output palette and alpha
                      settings on the left.
                    </div>
                  </div>

                  <div
                    className="h-10 w-10 rounded-lg border border-slate-200 shadow-sm shrink-0"
                    style={{ background: previewFill }}
                    aria-label="Current output color"
                    title={rgbaOut}
                  />
                </div>

                {preview.kind === "none" ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 min-h-[280px] p-8 text-center text-sm text-slate-500 grid place-items-center">
                    Upload an SVG or image to generate the output preview here.
                  </div>
                ) : preview.kind === "image" ? (
                  <div
                    className="rounded-xl border border-slate-200 p-4 overflow-hidden min-h-[280px] grid place-items-center"
                    style={checkerStyle}
                  >
                    <img
                      src={outputImageUrl || preview.url}
                      alt="Output preview"
                      className="max-w-full h-auto block rounded-lg mx-auto transparent-checkerboard"
                    />
                  </div>
                ) : (
                  <div
                    className="rounded-xl border border-slate-200 p-4 overflow-hidden min-h-[280px] grid place-items-center"
                    style={checkerStyle}
                  >
                    <div
                      className="bg-white transparent-checkerboard rounded-lg border border-slate-200 p-3 overflow-auto w-full"
                      aria-label="Output SVG preview"
                      dangerouslySetInnerHTML={{
                        __html: outputSvgMarkup,
                      }}
                    />
                  </div>
                )}

                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      RGB
                    </div>

                    <div className="mt-1 font-semibold">
                      {rgb.r}, {rgb.g}, {rgb.b}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      HSL
                    </div>

                    <div className="mt-1 font-semibold">
                      {hsl.h}°, {hsl.s}%, {hsl.l}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 mt-4">
                <div className="text-sm font-semibold">Export output</div>

                <p className="mt-1 text-sm text-slate-600">
                  Download the recolored result or save a compact report with
                  the preview and color values.
                </p>

                <div className="mt-3 grid sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void copyOutputSvgCode()}
                    disabled={preview.kind === "none"}
                    className="px-3 py-2 rounded-lg font-semibold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 cursor-pointer"
                  >
                    Copy SVG code
                  </button>

                  <button
                    type="button"
                    onClick={() => void downloadOutputSvg()}
                    disabled={preview.kind === "none"}
                    className="px-3 py-2 rounded-lg font-semibold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 cursor-pointer"
                  >
                    Download SVG
                  </button>

                  <button
                    type="button"
                    onClick={downloadOutputPng}
                    disabled={preview.kind !== "image"}
                    className="px-3 py-2 rounded-lg font-semibold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 cursor-pointer"
                  >
                    Download PNG preview
                  </button>

                  <button
                    type="button"
                    onClick={downloadReportPng}
                    disabled={preview.kind === "none"}
                    className="px-3 py-2 rounded-lg font-semibold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 cursor-pointer"
                  >
                    Download report image
                  </button>

                  <button
                    type="button"
                    onClick={() => void printReportPdf()}
                    disabled={preview.kind === "none"}
                    className="sm:col-span-2 px-3 py-2 rounded-lg font-semibold border border-[#0a24da] bg-[#0b2dff] hover:bg-[#0a24da] text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Print / save PDF report
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 mt-4">
                <div className="text-sm text-slate-600 mb-3">
                  Preview fill and stroke on simple SVG shapes.
                </div>

                <div
                  className="rounded-xl border border-slate-200 p-4 overflow-hidden"
                  style={checkerStyle}
                >
                  <svg
                    viewBox="0 0 600 240"
                    width="100%"
                    height="auto"
                    role="img"
                    aria-label="Fill and stroke preview"
                  >
                    <rect
                      x="40"
                      y="40"
                      width="160"
                      height="160"
                      rx="18"
                      fill={previewFill}
                      stroke="#0f172a"
                      strokeOpacity="0.08"
                    />

                    <circle
                      cx="360"
                      cy="120"
                      r="72"
                      fill="transparent"
                      stroke={previewFill}
                      strokeWidth="16"
                    />

                    <path
                      d="M 470 160 C 520 40, 580 60, 560 150"
                      fill="none"
                      stroke={previewFill}
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mt-4">
                <div className="text-sm font-semibold">Quick SVG snippet</div>

                <p className="mt-1 text-sm text-slate-600">
                  Use these directly as <code>fill</code> or <code>stroke</code>
                  .
                </p>

                <pre className="mt-2 text-[12px] bg-white border border-slate-200 rounded-lg p-3 overflow-auto">
                  {`<rect width="120" height="120" fill="${hexOut}" />
<path d="..." stroke="${hexOut}" stroke-width="2" fill="none" />`}
                </pre>
              </div>
            </div>
          </section>
        </div>

        <SeoSections />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: faqJsonLd() }}
        />
      </main>

      {toast && (
        <div className="fixed right-4 bottom-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[1000]">
          {toast}
        </div>
      )}

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
      <OtherToolsLinks />

      <nav
        aria-label="Breadcrumb"
        className="text-sm text-slate-600 mb-1 max-w-[1180px] mx-auto px-4"
      >
        <ol className="flex items-center gap-2">
          <li>
            <Link
              to="/"
              className="hover:text-slate-900 hover:underline underline-offset-4"
            >
              Home
            </Link>
          </li>

          <li className="text-slate-300" aria-hidden>
            /
          </li>

          <li className="text-slate-900 font-semibold">Free Color Picker</li>
        </ol>
      </nav>

      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ========================
   UI helpers
======================== */
function DragArea({
  onPick,
  onDrop,
  MAX_UPLOAD_BYTES,
  MAX_MP,
  MAX_SIDE,
  extracting,
}: {
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent<HTMLLabelElement>) => void;
  MAX_UPLOAD_BYTES: number;
  MAX_MP: number;
  MAX_SIDE: number;
  extracting: boolean;
}) {
  return (
    <label
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="block rounded-2xl border border-dashed border-blue-200 bg-[#f8fbff] hover:bg-[#f1f6ff] transition-colors cursor-pointer p-5 text-center"
    >
      <input
        type="file"
        accept="image/svg+xml,image/png,image/jpeg,image/webp"
        onChange={onPick}
        className="hidden"
      />

      <div className="text-[13px] text-slate-700 mb-3">
        Limits:{" "}
        <b>
          {prettyBytes(MAX_UPLOAD_BYTES)} • {MAX_MP} MP • {MAX_SIDE}px longest
          side
        </b>{" "}
        each max.
      </div>

      <div className="flex items-center justify-center gap-3 text-xl font-semibold text-slate-700">
        <Icons name="upload" className="w-8 h-8 text-sky-700" />
        <span>{extracting ? "Extracting…" : "Click/drag & drop file"}</span>
      </div>

      <p className="mt-4 text-sm text-sky-700">
        Live preview runs in your browser. SVG, PNG, JPG, and WebP are
        supported. No files are stored after conversion.
      </p>
    </label>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void | Promise<void>;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[64px] text-[12px] font-semibold text-slate-500">
        {label}
      </div>

      <input
        value={value}
        readOnly
        className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-slate-900 text-[13px]"
      />

      <button
        type="button"
        onClick={onCopy}
        className="flex items-center justify-center px-3 py-2 rounded-lg font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 cursor-pointer"
      >
        <Icons name="copy" size={16} className="inline-block mr-1" />
        Copy
      </button>
    </div>
  );
}

/* ========================
   SEO sections
======================== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-8 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-8">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Color picker + palette extractor
            </p>

            <h2 className="text-2xl md:text-3xl font-bold leading-tight text-sky-800">
              Pick colors fast, extract palettes from SVG and images
            </h2>

            <p className="text-slate-600 mt-2">
              Use this free tool to choose a color, preview it as SVG
              fill/stroke, and copy HEX/RGB/HSL. You can also upload an SVG or
              image to extract a palette and click swatches to apply them
              instantly.
            </p>

            <p className="mt-2 text-slate-600 max-w-[80ch]">
              Pick a color, preview fills and strokes, copy HEX/RGB/HSL, and
              extract palettes from SVG or images. Runs in your browser.
            </p>

            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { k: "Copy instantly", v: "HEX, RGB, HSL (+ alpha variants)" },
                { k: "Palette extraction", v: "From SVG or PNG/JPG/WebP" },
                { k: "Preview included", v: "Fill + stroke on shapes" },
                { k: "Private", v: "Runs in your browser" },
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
            <h3 className="text-lg font-bold text-sky-800">How to use</h3>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Pick a color or upload a file",
                  body: "Use the color input or upload an SVG/image to extract a palette.",
                },
                {
                  title: "Click a swatch",
                  body: "When a palette appears, click any output swatch to choose which color you want to edit.",
                },
                {
                  title: "Adjust the output color",
                  body: "Use the color picker and alpha slider to update the selected output color while the input preview stays unchanged.",
                },
                {
                  title: "Copy values",
                  body: "Copy HEX/RGB/HSL (and alpha variants) for your SVG, CSS, or design work.",
                },
              ].map((s, i) => (
                <li
                  key={s.title}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex gap-3">
                    <div className="shrink-0 h-8 w-8 rounded-full bg-slate-900 text-white text-sm font-bold grid place-items-center">
                      {i + 1}
                    </div>

                    <div>
                      <div className="font-semibold">{s.title}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {s.body}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <CurrentRouteGuide />

          <section className="mt-12">
            <h3 className="text-lg font-bold text-sky-800">
              Frequently asked questions
            </h3>

            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "What formats can I copy?",
                  a: "HEX, RGB, and HSL are available. Alpha is supported with RGBA and HSLA.",
                },
                {
                  q: "Can I extract a palette from an SVG or image?",
                  a: "Yes. Upload an SVG (reads fill/stroke/style colors) or an image (PNG/JPG/WebP) to generate swatches.",
                },
                {
                  q: "Does this upload my file?",
                  a: "No. Palette extraction runs locally in your browser.",
                },
                {
                  q: "Why do SVG colors sometimes look incomplete?",
                  a: "If an SVG uses external CSS, injected filters, or unusual color expressions, extraction may miss some. For most normal SVGs, it works well.",
                },
              ].map((x) => (
                <article
                  key={x.q}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h4 className="m-0 font-semibold text-sky-800">{x.q}</h4>
                  <p className="mt-2 text-sm text-slate-600">{x.a}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold text-sky-800">Tips</h3>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {[
                [
                  "SVG fill vs stroke",
                  "Use the same value for both, or keep stroke darker for readability.",
                ],
                [
                  "Alpha in SVG",
                  "SVG supports opacity. If you want transparency, use opacity or RGBA in CSS.",
                ],
                [
                  "Palettes from images",
                  "Image palette replacement works best on icons, logos, and graphics with clean color blocks.",
                ],
                [
                  "Copying into CSS",
                  "HEX is common, but HSL makes it easier to create consistent tints/shades.",
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
        </article>
      </div>
    </section>
  );
}
