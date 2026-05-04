import type {
  RasterTracePreprocessOptions,
} from "~/utils/imagePreprocess.server";
import {
  normalizeRasterForTrace,
  neutralizeTransparencyCheckerboard as neutralizeRasterTransparencyCheckerboard,
} from "~/utils/imagePreprocess.server";
import type {
  LayeredColorSvgOptions,
  SvgLayerMeta,
} from "~/utils/svgLayerTrace.server";
import {
  annotateSingleTraceSvg,
  createLayeredColorSvg,
} from "~/utils/svgLayerTrace.server";
import { traceBitmapToSvg } from "~/utils/potraceCompat";

export type SharedPotraceOptions = Record<string, unknown>;

export type SharedLayeredTraceResult = {
  svg: string;
  width: number;
  height: number;
  layers: SvgLayerMeta[];
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
  return traceBitmapToSvg(input, {
    color: "#000000",
    threshold: 128,
    invert: false,
    blackOnWhite: true,
    ...options,
  });
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
