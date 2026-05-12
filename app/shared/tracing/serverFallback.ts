export type SharedPotraceOptions = Record<string, unknown>;

export type SharedLayerMeta = {
  id: string;
  label: string;
  color: string;
  originalColor: string;
  visible: boolean;
  pathTags?: string;
  opacity?: number;
  originalOpacity?: number;
  kind?: "fill" | "stroke";
};

export type SharedLayeredTraceResult = {
  svg: string;
  width: number;
  height: number;
  layers: SharedLayerMeta[];
  engineUsed?: "vtracer" | "potrace" | "centerline";
  sourceKind?: "svg" | "raster";
  warnings?: string[];
  timings?: Record<string, number>;
};

export type SharedAnnotatedTraceResult = {
  svg: string;
  layers: SharedLayerMeta[];
};

function serverOnlyFallback(): never {
  throw new Error("Shared tracing server fallback is only available in server actions.");
}

export async function runSharedRasterNormalization(
  _input: Buffer,
  _options: Record<string, unknown>,
): Promise<Buffer> {
  return serverOnlyFallback();
}

export async function runSharedPotraceSvgTrace(
  _input: Buffer,
  _options: SharedPotraceOptions,
): Promise<string> {
  return serverOnlyFallback();
}

export async function runSharedLayeredColorTrace(
  _input: Buffer,
  _options: Record<string, unknown>,
): Promise<SharedLayeredTraceResult> {
  return serverOnlyFallback();
}

export function annotateSharedSingleTraceSvg(
  _svg: string,
  _color: string,
): SharedAnnotatedTraceResult {
  return serverOnlyFallback();
}

export async function neutralizeTransparencyCheckerboard(
  _input: Buffer,
): Promise<Buffer> {
  return serverOnlyFallback();
}
