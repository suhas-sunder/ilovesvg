import * as React from "react";
import Icons from "~/client/assets/icons/Icons";
import {
  FullscreenPreviewButton,
  PreviewHistoryArrowButton,
} from "~/client/components/converter/FullscreenOutputPreview";
import {
  TraceAdvancedSettingsPanel,
  type MixedTraceSettings,
} from "~/client/components/converter/AdvancedSettingsPanel";
import type { ConverterRouteCapabilities } from "~/client/lib/converter/routeCapabilities";
import {
  EditedSvgPreviewImage,
  ensureSvgRootNamespace,
  getEditedSvg,
} from "~/client/components/svg/EditedSvgPreviewImage";
import {
  LayerPaletteEditor,
  type EditableSvgLayer,
} from "~/client/components/svg/LayerPaletteEditor";

type OutputVersion<TSettings extends MixedTraceSettings> = {
  svg: string;
  layers?: EditableSvgLayer[];
  width: number;
  height: number;
  originalWidth?: number;
  originalHeight?: number;
  settingsSnapshot?: TSettings;
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
};

export type TraceOutputItem<TSettings extends MixedTraceSettings> = {
  svg: string;
  layers?: EditableSvgLayer[];
  width: number;
  height: number;
  originalWidth?: number;
  originalHeight?: number;
  stamp: number;
  name?: string;
  presetLabel?: string;
  settingsSnapshot?: TSettings;
  draftSettings?: TSettings;
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
  settingsOpen?: boolean;
  updateError?: string | null;
  previousVersion?: OutputVersion<TSettings> | null;
  nextVersion?: OutputVersion<TSettings> | null;
};

export type TraceOutputLayerPatch = {
  color?: string;
  visible?: boolean;
  opacity?: number;
};

export function getTraceOutputSvg<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
): string {
  const edited = getEditedSvg(item.svg, item.layers);
  return applySvgSizeAttributes(edited, item.width, item.height);
}

export function snapshotTraceOutputVersion<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
): OutputVersion<TSettings> {
  return {
    svg: item.svg,
    layers: cloneEditableLayers(item.layers),
    width: item.width,
    height: item.height,
    originalWidth: item.originalWidth,
    originalHeight: item.originalHeight,
    settingsSnapshot: item.settingsSnapshot,
    engineUsed: item.engineUsed,
    sourceKind: item.sourceKind,
    warnings: item.warnings,
    timings: item.timings,
    layerBuildMode: item.layerBuildMode,
    requestedPaletteCount: item.requestedPaletteCount,
    actualPaletteCount: item.actualPaletteCount,
    outputDetectedColors: item.outputDetectedColors,
    pathCount: item.pathCount,
    svgBytes: item.svgBytes,
  };
}

export function applyTraceOutputVersion<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
  version: OutputVersion<TSettings>,
): TraceOutputItem<TSettings> {
  return {
    ...item,
    svg: version.svg,
    layers: cloneEditableLayers(version.layers),
    width: version.width,
    height: version.height,
    originalWidth: version.originalWidth,
    originalHeight: version.originalHeight,
    settingsSnapshot: version.settingsSnapshot,
    engineUsed: version.engineUsed,
    sourceKind: version.sourceKind,
    warnings: version.warnings,
    timings: version.timings,
    layerBuildMode: version.layerBuildMode,
    requestedPaletteCount: version.requestedPaletteCount,
    actualPaletteCount: version.actualPaletteCount,
    outputDetectedColors: version.outputDetectedColors,
    pathCount: version.pathCount,
    svgBytes: version.svgBytes,
    draftSettings: version.settingsSnapshot ?? item.draftSettings,
  };
}

export function cloneEditableLayers(
  layers?: ReadonlyArray<EditableSvgLayer> | null,
): EditableSvgLayer[] | undefined {
  return layers?.map((layer) => ({ ...layer }));
}

export function stepTraceOutputVersion<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
  direction: "previous" | "next",
): TraceOutputItem<TSettings> {
  if (direction === "previous" && item.previousVersion) {
    return {
      ...applyTraceOutputVersion(item, item.previousVersion),
      previousVersion: null,
      nextVersion: snapshotTraceOutputVersion(item),
      updateError: null,
    };
  }

  if (direction === "next" && item.nextVersion) {
    return {
      ...applyTraceOutputVersion(item, item.nextVersion),
      previousVersion: snapshotTraceOutputVersion(item),
      nextVersion: null,
      updateError: null,
    };
  }

  return item;
}

export function replaceTraceOutputCurrent<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
  version: OutputVersion<TSettings>,
): TraceOutputItem<TSettings> {
  return {
    ...applyTraceOutputVersion(item, version),
    previousVersion: snapshotTraceOutputVersion(item),
    nextVersion: null,
    updateError: null,
  };
}

type TraceOutputPanelProps<TSettings extends MixedTraceSettings> = {
  history: TraceOutputItem<TSettings>[];
  busy?: boolean;
  buttonDisabled?: boolean;
  updatingStamp?: number | null;
  file?: File | null;
  fallbackSettings: TSettings;
  routeCapabilities: ConverterRouteCapabilities;
  downloadLabel?: string;
  downloadFileName?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  helpHref?: string;
  fullscreenPreviewIndex: number | null;
  setFullscreenPreviewIndex: (index: number | null) => void;
  onCopySvg: (svg: string) => void | Promise<void>;
  onToggleSettings: (stamp: number) => void;
  onDraftSettingsChange: (
    stamp: number,
    updater: React.SetStateAction<TSettings>,
  ) => void;
  onUpdatePreview: (stamp: number) => void;
  onStepVersion: (stamp: number, direction: "previous" | "next") => void;
  onOutputLayerChange: (
    stamp: number,
    layerId: string,
    patch: TraceOutputLayerPatch,
  ) => void;
  onResetOutputLayer: (stamp: number, layerId: string) => void;
  onResetAllOutputLayers: (stamp: number) => void;
  onOutputSizeChange?: (
    stamp: number,
    size: { width: number; height: number },
  ) => void;
};

export function TraceOutputPanel<TSettings extends MixedTraceSettings>({
  history,
  busy,
  buttonDisabled,
  updatingStamp,
  file,
  fallbackSettings,
  routeCapabilities,
  downloadLabel = "Download SVG",
  downloadFileName = "converted.svg",
  emptyTitle = "Converted files appear here...",
  emptyDescription = "Convert your input to preview, copy, or download the result.",
  helpHref = "#advanced-settings-help",
  fullscreenPreviewIndex,
  setFullscreenPreviewIndex,
  onCopySvg,
  onToggleSettings,
  onDraftSettingsChange,
  onUpdatePreview,
  onStepVersion,
  onOutputLayerChange,
  onResetOutputLayer,
  onResetAllOutputLayers,
  onOutputSizeChange,
}: TraceOutputPanelProps<TSettings>) {
  return (
    <div className="order-2 min-w-0 overflow-auto rounded-2xl border border-slate-300/40 bg-[#43546b] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:sticky md:top-4 md:row-span-3 md:max-h-[calc(100vh-2rem)] md:self-start">
      {busy && (
        <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
      )}
      {history.length > 0 ? (
        <div className="grid gap-3">
          {history.map((item, index) => {
            const outputSettings =
              item.draftSettings ?? item.settingsSnapshot ?? fallbackSettings;
            const isUpdating = updatingStamp === item.stamp;
            const previewSvg = getTraceOutputSvg(item);
            const label = getOutputLabel(item, index);

            return (
              <div
                key={item.stamp}
                data-engine-used={item.engineUsed || "unknown"}
                data-source-kind={item.sourceKind || "unknown"}
                data-engine-warnings={(item.warnings || []).join(" | ")}
                data-layer-build-mode={item.layerBuildMode || ""}
                data-requested-palette-count={item.requestedPaletteCount ?? ""}
                data-actual-palette-count={item.actualPaletteCount ?? ""}
                data-output-detected-colors={item.outputDetectedColors ?? ""}
                data-path-count={item.pathCount ?? ""}
                data-svg-bytes={item.svgBytes ?? ""}
                className="rounded-xl border border-slate-200 bg-white p-2 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-slate-700">
                    {label}
                  </span>
                  <span className="text-[13px] text-slate-600">
                    {item.width > 0 && item.height > 0
                      ? `${item.width} x ${item.height} px`
                      : "size unknown"}
                  </span>
                </div>

                <div className="my-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => downloadSvg(previewSvg, downloadFileName)}
                    className="flex cursor-pointer items-center justify-center rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 font-semibold text-white transition-colors hover:bg-sky-600"
                  >
                    <Icons
                      name="download"
                      size={16}
                      className="mr-1 inline-block"
                    />
                    {downloadLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onCopySvg(previewSvg)}
                    className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 transition-colors hover:bg-slate-100"
                  >
                    <Icons name="copy" size={16} className="mr-1 inline-block" />
                    Copy SVG
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleSettings(item.stamp)}
                    aria-expanded={!!item.settingsOpen}
                    aria-controls={`output-settings-${item.stamp}`}
                    className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-950 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    <SettingsGearIcon />
                    <span className="ml-1">Settings</span>
                  </button>
                </div>

                {item.updateError && (
                  <p className="m-0 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-5 text-red-700">
                    {item.updateError}
                  </p>
                )}

                {item.settingsOpen && (
                  <div
                    id={`output-settings-${item.stamp}`}
                    className="mb-2 rounded-xl border border-sky-200 bg-sky-50/70 p-2"
                  >
                    <TraceAdvancedSettingsPanel
                      id={`output-settings-panel-${item.stamp}`}
                      open={true}
                      settings={outputSettings}
                      setSettings={(updater) =>
                        onDraftSettingsChange(item.stamp, updater)
                      }
                      capabilities={routeCapabilities}
                      detectedColorItems={[item]}
                      sourceFile={file}
                      removeColorsEnabled={
                        !(
                          file &&
                          (file.type === "image/svg+xml" ||
                            /\.svg$/i.test(file.name || ""))
                        )
                      }
                      outputLayerItems={item.layers}
                      outputSize={{
                        width: item.width,
                        height: item.height,
                        originalWidth: item.originalWidth || item.width,
                        originalHeight: item.originalHeight || item.height,
                      }}
                      onOutputLayerChange={(layerId, patch) =>
                        onOutputLayerChange(item.stamp, layerId, patch)
                      }
                      onResetOutputLayer={(layerId) =>
                        onResetOutputLayer(item.stamp, layerId)
                      }
                      onResetAllOutputLayers={() =>
                        onResetAllOutputLayers(item.stamp)
                      }
                      onOutputSizeChange={
                        onOutputSizeChange
                          ? (size) => onOutputSizeChange(item.stamp, size)
                          : undefined
                      }
                      helpHref={helpHref}
                      buttonDisabled={buttonDisabled || isUpdating}
                      liveSectionTitle="Live preview edits"
                      liveSectionDescription="These settings edit this output card directly. Copy and download use the current visible SVG."
                      livePreviewLead={
                        item.layers?.length ? (
                          <div className="rounded-xl border border-slate-200 bg-white p-2">
                            <p className="m-0 mb-2 text-[13px] font-bold text-slate-900">
                              Layer colors
                            </p>
                            <LayerPaletteEditor
                              item={item}
                              onColorChange={(layerId, color) =>
                                onOutputLayerChange(item.stamp, layerId, {
                                  color,
                                })
                              }
                              onVisibilityChange={(layerId, visible) =>
                                onOutputLayerChange(item.stamp, layerId, {
                                  visible,
                                })
                              }
                              onOpacityChange={(layerId, opacity) =>
                                onOutputLayerChange(item.stamp, layerId, {
                                  opacity,
                                })
                              }
                              onResetLayer={(layerId) =>
                                onResetOutputLayer(item.stamp, layerId)
                              }
                              onResetAll={() =>
                                onResetAllOutputLayers(item.stamp)
                              }
                            />
                          </div>
                        ) : null
                      }
                      convertSectionTitle="Click to convert"
                      convertSectionDescription="These settings retrace the source image for this output only."
                      hideOutputLayerStyling={true}
                      updatePreviewLabel={
                        isUpdating ? "Updating..." : "Update preview"
                      }
                      onUpdatePreview={() => onUpdatePreview(item.stamp)}
                    />
                  </div>
                )}

                <div className="relative flex min-h-[240px] items-center justify-center rounded-xl border border-slate-200 bg-white p-2 transparent-checkerboard">
                  <div className="absolute right-2 top-2 z-10 flex gap-2">
                    <PreviewHistoryArrowButton
                      direction="left"
                      disabled={!item.previousVersion}
                      onClick={() => onStepVersion(item.stamp, "previous")}
                    />
                    <PreviewHistoryArrowButton
                      direction="right"
                      disabled={!item.nextVersion}
                      onClick={() => onStepVersion(item.stamp, "next")}
                    />
                    <FullscreenPreviewButton
                      onOpen={() => setFullscreenPreviewIndex(index)}
                      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    />
                  </div>
                  <EditedSvgPreviewImage
                    svg={previewSvg}
                    layers={null}
                    alt={`${label} SVG result`}
                    className="h-auto max-w-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="converter-empty-output-state">
          {!busy && (
            <Icons name="success" size={20} className="mb-2 inline-block" />
          )}
          <p className="m-0 font-bold">
            {busy ? "Converting..." : emptyTitle}
          </p>
          {!busy && (
            <p className="m-0 mt-2 text-sm font-medium text-slate-200">
              {emptyDescription}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function buildOutputLabel<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
  index: number,
): string {
  const preset = item.presetLabel ? ` - ${item.presetLabel}` : "";
  return `Output ${index + 1}${preset}`;
}

function getOutputLabel<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
  index: number,
): string {
  const fallback = buildOutputLabel(item, index);
  const explicitName = item.name?.trim();
  if (!explicitName) return fallback;
  if (!item.presetLabel) return explicitName;
  if (explicitName.includes(item.presetLabel)) return explicitName;
  if (/^Output\s+\d+$/i.test(explicitName)) {
    return `${explicitName} - ${item.presetLabel}`;
  }
  return explicitName;
}

function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function applySvgSizeAttributes(svg: string, width: number, height: number): string {
  const safeWidth = Math.round(Number(width));
  const safeHeight = Math.round(Number(height));
  if (
    !Number.isFinite(safeWidth) ||
    !Number.isFinite(safeHeight) ||
    safeWidth <= 0 ||
    safeHeight <= 0
  ) {
    return svg;
  }

  return String(svg).replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
    const nextAttrs = String(attrs)
      .replace(/\swidth\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sheight\s*=\s*["'][^"']*["']/gi, "");
    return ensureSvgRootNamespace(
      `<svg${nextAttrs} width="${safeWidth}" height="${safeHeight}">`,
    );
  });
}

function SettingsGearIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.1.35.33.66.66.85.26.15.55.23.85.24H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}
