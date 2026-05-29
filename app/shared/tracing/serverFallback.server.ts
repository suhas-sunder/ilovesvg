import type {
  RasterTracePreprocessOptions,
} from "~/utils/imagePreprocess.server";
import {
  normalizeRasterForTrace,
  neutralizeTransparencyCheckerboard as neutralizeRasterTransparencyCheckerboard,
} from "~/utils/imagePreprocess.server";
import type {
  ConversionDiagnostics,
} from "~/utils/conversionDiagnostics.server";
import type {
  LayeredColorSvgOptions,
  SvgLayerMeta,
} from "~/utils/svgLayerTrace.server";
import {
  annotateSingleTraceSvg,
  createLayeredColorSvg,
} from "~/utils/svgLayerTrace.server";
import { traceBitmapToSvg } from "~/utils/potraceCompat";
import { validateMeaningfulSvgOutput } from "./meaningfulOutput";

export type SharedPotraceOptions = Record<string, unknown> & {
  validateMeaningfulOutput?: boolean;
};

export type SharedLayeredTraceResult = {
  svg: string;
  width: number;
  height: number;
  layers: SvgLayerMeta[];
  engineUsed?: "vtracer" | "potrace" | "centerline";
  sourceKind?: "svg" | "raster";
  warnings?: string[];
  timings?: Record<string, number>;
  diagnostics?: ConversionDiagnostics;
};

export type SharedAnnotatedTraceResult = {
  svg: string;
  layers: SvgLayerMeta[];
};

export async function runSharedRasterNormalization(
  input: Buffer,
  options: RasterTracePreprocessOptions,
): Promise<Buffer> {
  return normalizeRasterForTrace(input, options);
}

export async function runSharedPotraceSvgTrace(
  input: Buffer,
  options: SharedPotraceOptions,
): Promise<string> {
  const { validateMeaningfulOutput = true, ...traceOptions } = options;
  const svg = await traceBitmapToSvg(input, {
    color: "#000000",
    threshold: 128,
    invert: false,
    blackOnWhite: true,
    ...traceOptions,
  });
  if (!validateMeaningfulOutput) return svg;
  const validation = validateMeaningfulSvgOutput(svg, {
    allowWhiteOnly: true,
  });
  if (!validation.ok) {
    throw new Error(
      `No visible vector output found. ${validation.reasons.join("; ")}`,
    );
  }
  return svg;
}

export async function runSharedLayeredColorTrace(
  input: Buffer,
  options: LayeredColorSvgOptions,
): Promise<SharedLayeredTraceResult> {
  return createLayeredColorSvg(input, options);
}

export function annotateSharedSingleTraceSvg(
  svg: string,
  color: string,
): SharedAnnotatedTraceResult {
  return annotateSingleTraceSvg(svg, color);
}

export async function neutralizeTransparencyCheckerboard(
  input: Buffer,
): Promise<Buffer> {
  return neutralizeRasterTransparencyCheckerboard(input);
}
