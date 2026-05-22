const PATH_D_ATTRIBUTE_PATTERN =
  /(<path\b(?=[^>]*\bd\s*=)[^>]*?\bd\s*=\s*)(["'])([\s\S]*?)(\2)([^>]*>)/gi;
const SVG_NUMBER_PATTERN = /-?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi;

export function clampSvgPathDataPrecision(svg: string, precision = 2): string {
  const safePrecision = clampPrecision(precision);
  return String(svg || "").replace(
    PATH_D_ATTRIBUTE_PATTERN,
    (_match, prefix: string, quote: string, pathData: string, _closingQuote: string, suffix: string) =>
      `${prefix}${quote}${clampPathDataPrecision(pathData, safePrecision)}${quote}${suffix}`,
  );
}

export function clampPathDataPrecision(pathData: string, precision = 2): string {
  const safePrecision = clampPrecision(precision);
  const rounded = String(pathData || "").replace(SVG_NUMBER_PATTERN, (token) =>
    formatPathNumberToken(token, safePrecision),
  );
  return compactPathData(rounded);
}

function formatPathNumberToken(token: string, precision: number): string {
  const value = Number(token);
  if (!Number.isFinite(value)) return token;
  const rounded = Number(value.toFixed(precision));
  if (Object.is(rounded, -0)) return "0";
  const text = String(rounded);
  if (text.startsWith("0.")) return text.slice(1);
  if (text.startsWith("-0.")) return `-${text.slice(2)}`;
  return text;
}

function clampPrecision(value: number): number {
  if (!Number.isFinite(value)) return 2;
  return Math.max(0, Math.min(4, Math.round(value)));
}

function compactPathData(pathData: string): string {
  return String(pathData || "")
    .replace(/[\s,]+/g, " ")
    .replace(/\s*([AaCcHhLlMmQqSsTtVvZz])\s*/g, "$1")
    .replace(/\s+(-)/g, "$1")
    .trim();
}
