import {
  MAX_OUTPUT_SVG_BYTES,
  MAX_SVG_BYTES,
  MAX_SVG_ELEMENTS,
  MAX_SVG_PATH_COMMANDS,
} from "./backendSecurity.server";
import { validateMeaningfulSvgOutput } from "~/shared/tracing/meaningfulOutput";

export type SvgSanitizeResult =
  | { ok: true; svg: string; elementCount: number; pathCommandCount: number }
  | { ok: false; code: "SVG_UNSAFE"; message: string };

type SvgSanitizeOptions = {
  maxBytes?: number;
  maxOutputBytes?: number;
  maxPathCommands?: number;
};

const SAFE_ELEMENTS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "textpath",
  "image",
  "style",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "mask",
  "title",
  "desc",
]);

const SAFE_ATTRS = new Set([
  "xmlns",
  "xmlns:xlink",
  "viewbox",
  "width",
  "height",
  "x",
  "y",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x1",
  "y1",
  "x2",
  "y2",
  "d",
  "points",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "transform",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "baseline-shift",
  "letter-spacing",
  "word-spacing",
  "dx",
  "dy",
  "rotate",
  "textlength",
  "lengthadjust",
  "preserveaspectratio",
  "xml:space",
  "id",
  "class",
  "offset",
  "stop-color",
  "stop-opacity",
  "clip-path",
  "mask",
  "fill-rule",
  "clip-rule",
  "data-layer-id",
  "data-fill-layer-id",
  "data-stroke-layer-id",
  "data-layer-label",
  "data-layer-color",
]);

const URL_ATTRS = new Set(["href", "xlink:href", "src"]);
const MAX_SAFE_ATTR_VALUE_LENGTH = 20000;
const LONG_DRAWABLE_ATTRS = new Set(["d", "points"]);
const EXCLUDED_BLOCKS =
  /<\s*(script|foreignObject|iframe|object|embed|audio|video|canvas|animate|animateTransform|animateMotion|set)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;

export function sanitizeSvgMarkup(
  svg: string,
  optionsOrMaxBytes: number | SvgSanitizeOptions = MAX_SVG_BYTES,
): SvgSanitizeResult {
  const options =
    typeof optionsOrMaxBytes === "number"
      ? { maxBytes: optionsOrMaxBytes }
      : optionsOrMaxBytes;
  const maxBytes = options.maxBytes ?? MAX_SVG_BYTES;
  const maxOutputBytes = options.maxOutputBytes ?? MAX_OUTPUT_SVG_BYTES;
  const maxPathCommands = options.maxPathCommands ?? MAX_SVG_PATH_COMMANDS;
  let next = String(svg || "");
  if (!next.trim()) {
    return { ok: false, code: "SVG_UNSAFE", message: "SVG file is empty." };
  }
  if (Buffer.byteLength(next, "utf8") > maxBytes) {
    return { ok: false, code: "SVG_UNSAFE", message: "SVG file is too large." };
  }

  next = next
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(EXCLUDED_BLOCKS, "")
    .replace(/<\s*style\b[\s\S]*?<\s*\/\s*style\s*>/gi, (block) =>
      sanitizeStyleBlock(block),
    );

  if (!/<svg[\s>]/i.test(next)) {
    return { ok: false, code: "SVG_UNSAFE", message: "No SVG root element found." };
  }

  let elementCount = 0;
  let pathCommandCount = 0;
  const idMap = new Map<string, string>();
  const usedIds = new Set<string>();

  next = next.replace(/<\s*(\/)?\s*([a-zA-Z][\w:.-]*)([^<>]*?)(\/?)\s*>/g, (match, close, tag, rawAttrs, selfClose) => {
    const originalTag = String(tag || "");
    const safeTag = originalTag.toLowerCase();
    if (!SAFE_ELEMENTS.has(safeTag)) return "";
    if (close) return `</${originalTag}>`;

    elementCount += 1;
    if (elementCount > MAX_SVG_ELEMENTS) return "";

    const attrs = sanitizeAttributes(String(rawAttrs || ""), safeTag, idMap, usedIds);
    const d = attrs.match(/\sd="([^"]*)"/i)?.[1] || "";
    if (safeTag === "path" && d) {
      pathCommandCount += (d.match(/[AaCcHhLlMmQqSsTtVvZz]/g) || []).length;
    }
    return `<${originalTag}${attrs}${selfClose ? " /" : ""}>`;
  });

  next = rewriteIdReferences(next, idMap);
  next = ensureSvgViewBox(next);

  if (pathCommandCount > maxPathCommands) {
    return {
      ok: false,
      code: "SVG_UNSAFE",
      message: "SVG has too many path commands to process safely.",
    };
  }
  if (Buffer.byteLength(next, "utf8") > maxOutputBytes) {
    return { ok: false, code: "SVG_UNSAFE", message: "Sanitized SVG output is too large." };
  }

  return { ok: true, svg: next, elementCount, pathCommandCount };
}

export function sanitizeVisibleSvgMarkup(
  svg: string,
  options: {
    maxBytes?: number;
    allowWhiteOnly?: boolean;
  } = {},
): SvgSanitizeResult {
  const sanitized = sanitizeSvgMarkup(svg, options.maxBytes ?? MAX_SVG_BYTES);
  if (!sanitized.ok) return sanitized;

  const validation = validateMeaningfulSvgOutput(sanitized.svg, {
    minBytes: 64,
    allowWhiteOnly: options.allowWhiteOnly ?? true,
  });
  if (!validation.ok) {
    return {
      ok: false,
      code: "SVG_UNSAFE",
      message:
        "SVG has no visible artwork after sanitizing. Upload an SVG with visible paths, shapes, or text.",
    };
  }

  return sanitized;
}

function sanitizeAttributes(
  rawAttrs: string,
  tagName: string,
  idMap: Map<string, string>,
  usedIds: Set<string>,
): string {
  const out: string[] = [];
  rawAttrs.replace(/([:@\w.-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g, (_match, name, rawValue = "") => {
    const attrName = String(name || "").toLowerCase();
    if (!SAFE_ATTRS.has(attrName) && !URL_ATTRS.has(attrName)) return "";
    if (/^on/i.test(attrName)) return "";

    const value = stripAttrQuotes(String(rawValue || ""));
    if (URL_ATTRS.has(attrName)) {
      if (!isSafeReferenceValue(value, tagName)) return "";
      out.push(` ${serializeSvgAttrName(attrName)}="${escapeAttr(value)}"`);
      return "";
    }
    if (!isSafeAttributeValue(attrName, value)) return "";

    if (attrName === "id") {
      const safe = uniqueId(sanitizeId(value), usedIds);
      idMap.set(value, safe);
      out.push(` id="${escapeAttr(safe)}"`);
      return "";
    }
    if (attrName === "class") {
      const classes = value
        .split(/\s+/)
        .map(sanitizeId)
        .filter(Boolean)
        .slice(0, 12)
        .join(" ");
      if (classes) out.push(` class="${escapeAttr(classes)}"`);
      return "";
    }
    const serializedName = serializeSvgAttrName(attrName);
    if (tagName === "svg" && (attrName === "width" || attrName === "height")) {
      out.push(` ${serializedName}="${escapeAttr(clampSvgLength(value))}"`);
      return "";
    }
    out.push(` ${serializedName}="${escapeAttr(value)}"`);
    return "";
  });
  return out.join("");
}

function serializeSvgAttrName(attrName: string): string {
  if (attrName === "viewbox") return "viewBox";
  if (attrName === "textlength") return "textLength";
  if (attrName === "lengthadjust") return "lengthAdjust";
  if (attrName === "preserveaspectratio") return "preserveAspectRatio";
  return attrName;
}

function sanitizeStyleBlock(block: string): string {
  if (/url\s*\(|expression\s*\(|@import|javascript\s*:/i.test(block)) return "";
  return block.replace(/\s+on[a-z]+\s*:/gi, "");
}

function isSafeAttributeValue(attrName: string, value: string): boolean {
  if (/javascript\s*:|data\s*:|vbscript\s*:|file\s*:|https?\s*:|url\s*\(|expression\s*\(|@import/i.test(value)) {
    return false;
  }
  if (attrName === "style") return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  const maxLength = LONG_DRAWABLE_ATTRS.has(attrName)
    ? MAX_SVG_BYTES
    : MAX_SAFE_ATTR_VALUE_LENGTH;
  return value.length <= maxLength;
}

function isSafeReferenceValue(value: string, tagName: string): boolean {
  const trimmed = value.trim();
  if (tagName === "image" && isSafeEmbeddedRasterImage(trimmed)) return true;
  return /^#[A-Za-z_][\w:.-]*$/.test(trimmed);
}

function isSafeEmbeddedRasterImage(value: string): boolean {
  if (value.length > MAX_SVG_BYTES) return false;
  return /^data:image\/(?:png|jpe?g|webp|gif|avif|bmp);base64,[a-z0-9+/=\s]+$/i.test(value);
}

function ensureSvgViewBox(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, (match, attrs) => {
    if (/\sxmlns\s*=/i.test(attrs) && /\sviewBox\s*=/i.test(attrs)) return match;
    let nextAttrs = attrs;
    if (!/\sxmlns\s*=/i.test(nextAttrs)) {
      nextAttrs += ` xmlns="http://www.w3.org/2000/svg"`;
    }
    if (!/\sviewBox\s*=/i.test(nextAttrs)) {
      const width = parseSvgLength(nextAttrs.match(/\swidth="([^"]+)"/i)?.[1] || "1024");
      const height = parseSvgLength(nextAttrs.match(/\sheight="([^"]+)"/i)?.[1] || "1024");
      nextAttrs += ` viewBox="0 0 ${width} ${height}"`;
    }
    return `<svg${nextAttrs}>`;
  });
}

function rewriteIdReferences(svg: string, idMap: Map<string, string>): string {
  let next = svg;
  for (const [from, to] of idMap) {
    if (from === to) continue;
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(`#${escaped}\\b`, "g"), `#${to}`);
  }
  return next;
}

function stripAttrQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function sanitizeId(value: string): string {
  return String(value || "")
    .replace(/[^\w:.-]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 80);
}

function uniqueId(base: string, usedIds: Set<string>): string {
  let next = base || "svg-id";
  let count = 2;
  while (usedIds.has(next)) {
    next = `${base || "svg-id"}-${count++}`;
  }
  usedIds.add(next);
  return next;
}

function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clampSvgLength(value: string): string {
  const numeric = parseSvgLength(value);
  return String(Math.max(1, Math.min(6000, numeric)));
}

function parseSvgLength(value: string): number {
  const numeric = Number.parseFloat(String(value || ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return 1024;
  return Math.max(1, Math.min(6000, Math.round(numeric)));
}
