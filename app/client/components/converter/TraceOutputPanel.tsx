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
import {
  DEFAULT_OUTPUT_APPEARANCE,
  applyOutputAppearanceToSvg,
  detectOutputAppearanceSupport,
  hasOutputAppearanceChanges,
  normalizeOutputAppearance,
  type OutputAppearanceSettings,
} from "~/client/lib/converter/outputAppearance";

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
  jobId?: string;
  jobStatus?: "queued" | "running" | "succeeded" | "failed" | "canceled";
  jobStartedAt?: number;
  jobCompletedAt?: number;
  jobError?: string | null;
  sourceFileName?: string;
  sourceMimeType?: string;
  sourceFileSize?: number;
  sourcePreviewUrl?: string;
  enginePathLabel?: string;
  canCancel?: boolean;
  appearance?: OutputAppearanceSettings;
};

export type TraceOutputLayerPatch = {
  color?: string;
  visible?: boolean;
  opacity?: number;
};

const outputAppearanceStore = new Map<string, OutputAppearanceSettings>();

export function getTraceOutputSvg<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
): string {
  const baseSvg = getTraceOutputBaseSvg(item);
  const appearance = getStoredOutputAppearance(item);
  if (!hasOutputAppearanceChanges(appearance)) return baseSvg;
  const support = detectOutputAppearanceSupport(baseSvg, {
    precisionOutput: isPrecisionOutputItem(item),
  });
  return applyOutputAppearanceToSvg(baseSvg, appearance, support);
}

export function getTraceOutputBaseSvg<TSettings extends MixedTraceSettings>(
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
  onCancelOutputJob?: (jobId: string, stamp: number) => void;
  onRetryOutputJob?: (stamp: number) => void;
};

export function FocusedEditorPreviewComparison({
  outputSvg,
  outputAlt,
  originalPreviewUrl,
  originalAlt = "Original image",
  toolbar,
}: {
  outputSvg: string;
  outputAlt: string;
  originalPreviewUrl?: string | null;
  originalAlt?: string;
  toolbar?: React.ReactNode;
}) {
  return (
    <div
      data-editor-comparison-panel="true"
      className="grid min-w-0 gap-3 lg:sticky lg:top-4 lg:self-start"
    >
      <div
        data-editor-output-preview="true"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
          <p className="m-0 text-[13px] font-bold text-slate-800">Output</p>
          {toolbar ? <div className="flex shrink-0 gap-1.5">{toolbar}</div> : null}
        </div>
        <div className="flex min-h-[360px] items-center justify-center p-3 transparent-checkerboard md:min-h-[460px] xl:min-h-[520px]">
          {outputSvg ? (
            <EditedSvgPreviewImage
              svg={outputSvg}
              layers={null}
              alt={outputAlt}
              className="h-auto max-h-[68vh] max-w-full"
            />
          ) : (
            <p className="m-0 text-sm font-semibold text-slate-500">
              Output preview unavailable.
            </p>
          )}
        </div>
      </div>

      <div
        data-editor-original-preview="true"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <p className="m-0 border-b border-slate-100 px-3 py-2 text-[13px] font-bold text-slate-800">
          Original
        </p>
        <div className="flex max-h-[260px] min-h-[150px] items-center justify-center overflow-auto p-3 transparent-checkerboard">
          {originalPreviewUrl ? (
            <img
              src={originalPreviewUrl}
              alt={originalAlt}
              className="h-auto max-h-[240px] max-w-full"
            />
          ) : (
            <p className="m-0 text-center text-[13px] font-medium text-slate-500">
              Original image preview unavailable for this route.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

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
  onCancelOutputJob,
  onRetryOutputJob,
}: TraceOutputPanelProps<TSettings>) {
  const hasActiveJob = history.some((item) => isTraceJobActive(item.jobStatus));
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [focusedOutputStamp, setFocusedOutputStamp] = React.useState<
    number | null
  >(null);
  const [collapsedOutputStamps, setCollapsedOutputStamps] = React.useState<
    ReadonlySet<number>
  >(() => new Set());
  const [highlightedOutputStamp, setHighlightedOutputStamp] = React.useState<
    number | null
  >(null);
  const [focusedSettingsSections, setFocusedSettingsSections] = React.useState<
    Map<number, string | null>
  >(() => new Map());
  const [appearanceVersion, setAppearanceVersion] = React.useState(0);
  const focusedOutputHasSourcePreview = React.useMemo(
    () =>
      focusedOutputStamp != null &&
      history.some(
        (item) => item.stamp === focusedOutputStamp && item.sourcePreviewUrl,
      ),
    [focusedOutputStamp, history],
  );
  const [activeSourcePreviewUrl, setActiveSourcePreviewUrl] = React.useState<
    string | null
  >(null);
  React.useEffect(() => {
    if (!hasActiveJob) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [hasActiveJob]);

  React.useEffect(() => {
    if (focusedOutputStamp == null) return;
    if (history.some((item) => item.stamp === focusedOutputStamp)) return;
    setFocusedOutputStamp(null);
  }, [focusedOutputStamp, history]);

  React.useEffect(() => {
    if (focusedOutputStamp == null) return;
    const stamp = focusedOutputStamp;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeFocusedEditor(stamp);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusedOutputStamp]);

  React.useEffect(() => {
    if (focusedOutputStamp == null || !file || focusedOutputHasSourcePreview) {
      setActiveSourcePreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setActiveSourcePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, focusedOutputHasSourcePreview, focusedOutputStamp]);

  function closeFocusedEditor(stamp: number) {
    setFocusedOutputStamp(null);
    setHighlightedOutputStamp(stamp);
    window.setTimeout(() => {
      const card = document.querySelector<HTMLElement>(
        `[data-output-stamp="${stamp}"]`,
      );
      card?.scrollIntoView({ block: "center", behavior: "smooth" });
      const focusTarget = card?.querySelector<HTMLElement>(
        "[data-output-primary-action]",
      );
      (focusTarget || card)?.focus?.({ preventScroll: true });
    }, 80);
    window.setTimeout(() => {
      setHighlightedOutputStamp((current) => (current === stamp ? null : current));
    }, 1_500);
  }

  function setFocusedSettingsSection(stamp: number, sectionId: string | null) {
    setFocusedSettingsSections((current) => {
      const next = new Map(current);
      if (sectionId) {
        next.set(stamp, sectionId);
      } else {
        next.delete(stamp);
      }
      return next;
    });
  }

  function openFocusedEditor(stamp: number, sectionId = "output-appearance") {
    setFocusedSettingsSection(stamp, sectionId);
    setFocusedOutputStamp(stamp);
    setCollapsedOutputStamps((current) => {
      if (!current.has(stamp)) return current;
      const next = new Set(current);
      next.delete(stamp);
      return next;
    });
  }

  function toggleCollapsedOutput(stamp: number) {
    setCollapsedOutputStamps((current) => {
      const next = new Set(current);
      if (next.has(stamp)) next.delete(stamp);
      else next.add(stamp);
      return next;
    });
  }

  function setOutputAppearance(
    item: TraceOutputItem<TSettings>,
    patch: Partial<OutputAppearanceSettings>,
  ) {
    const key = getOutputAppearanceKey(item);
    const current = getStoredOutputAppearance(item);
    const next = normalizeOutputAppearance({ ...current, ...patch });
    outputAppearanceStore.set(key, next);
    setAppearanceVersion((value) => value + 1);
  }

  function resetOutputAppearance(item: TraceOutputItem<TSettings>) {
    outputAppearanceStore.set(getOutputAppearanceKey(item), DEFAULT_OUTPUT_APPEARANCE);
    setAppearanceVersion((value) => value + 1);
  }

  const focusedMode = focusedOutputStamp != null;
  void appearanceVersion;

  return (
    <div
      data-focused-editor={focusedMode ? "true" : "false"}
      data-output-panel-focused={focusedMode ? "true" : "false"}
      className={[
        "converter-output-panel order-2 min-w-0 overflow-auto rounded-2xl border border-slate-300/40 bg-[#43546b] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] transition-[opacity,transform,box-shadow] duration-[300ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        focusedMode
          ? "md:col-span-2 md:row-start-1 md:max-h-none md:self-start"
          : "md:sticky md:top-4 md:row-span-3 md:max-h-[calc(100vh-2rem)] md:self-start",
      ].join(" ")}
    >
      {busy && (
        <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
      )}
      {history.length > 0 ? (
        <div className="grid gap-3">
          {history.map((item, index) => {
            const outputSettings =
              item.draftSettings ?? item.settingsSnapshot ?? fallbackSettings;
            const isUpdating = updatingStamp === item.stamp;
            const jobStatus = item.jobStatus ?? "succeeded";
            const isActiveJob = isTraceJobActive(jobStatus);
            const isFailedJob = jobStatus === "failed" || jobStatus === "canceled";
            const previewSvg =
              isActiveJob || isFailedJob || !item.svg ? "" : getTraceOutputSvg(item);
            const displaySvgBytes = previewSvg
              ? getSvgByteSize(previewSvg)
              : item.svgBytes;
            const label = getOutputLabel(item, index);
            const elapsedMs = getTraceJobElapsedMs(item, nowMs);
            const focused = focusedOutputStamp === item.stamp;
            const sourceAvailableForOutput =
              !item.sourceFileName || file?.name === item.sourceFileName;
            const focusedSettingsSection =
              focusedSettingsSections.get(item.stamp) ?? "output-appearance";
            if (focusedOutputStamp != null && !focused) return null;
            const collapsed =
              !focused && collapsedOutputStamps.has(item.stamp);
            const appearance = getStoredOutputAppearance(item);
            const appearanceSupport =
              (focused || item.settingsOpen) && item.svg
                ? detectOutputAppearanceSupport(getTraceOutputBaseSvg(item), {
                    precisionOutput:
                      routeCapabilities.group === "cricut" ||
                      isPrecisionOutputItem(item),
                  })
                : null;
            const appearanceControls =
              appearanceSupport && !isActiveJob && !isFailedJob ? (
                <OutputAppearanceControls
                  settings={appearance}
                  support={appearanceSupport}
                  onChange={(patch) => setOutputAppearance(item, patch)}
                  onReset={() => resetOutputAppearance(item)}
                />
              ) : null;
            const settingsPanel =
              focused || item.settingsOpen ? (
                <div
                  id={`output-settings-${item.stamp}`}
                  data-editor-settings-panel={focused ? "true" : undefined}
                  className={[
                    "rounded-xl border border-sky-200 bg-sky-50/70 p-2",
                    focused
                      ? "max-h-none min-w-0 max-w-full overflow-x-hidden p-3 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
                      : "mb-2",
                  ].join(" ")}
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
                    sourceFile={sourceAvailableForOutput ? file : null}
                    removeColorsEnabled={
                      !(
                        sourceAvailableForOutput &&
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
                    buttonDisabled={
                      buttonDisabled || isUpdating || !sourceAvailableForOutput
                    }
                    liveSectionTitle="Live preview edits"
                    liveSectionDescription="These settings edit this output card directly. Copy and download use the current visible SVG."
                    livePreviewLead={
                      appearanceControls || item.layers?.length ? (
                        <div className="grid gap-2">
                          {appearanceControls}
                          {item.layers?.length ? (
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
                          ) : null}
                        </div>
                      ) : null
                    }
                    convertSectionTitle="Click to convert"
                    convertSectionDescription={
                      sourceAvailableForOutput
                        ? "These settings retrace the source image for this output only."
                        : item.sourceFileName
                          ? `Update preview needs the original source file (${item.sourceFileName}). Copy and download still use the saved SVG.`
                          : "Choose the original source image to retrace this output. Copy and download still use the saved SVG."
                    }
                    hideOutputLayerStyling={true}
                    focusedEditorMode={focused}
                    defaultOpenSection="output-appearance"
                    openSection={focused ? focusedSettingsSection : undefined}
                    onOpenSectionChange={
                      focused
                        ? (sectionId) =>
                            setFocusedSettingsSection(item.stamp, sectionId)
                        : undefined
                    }
                    updatePreviewLabel={
                      isUpdating ? "Updating..." : "Update preview"
                    }
                    onUpdatePreview={() => onUpdatePreview(item.stamp)}
                  />
                </div>
              ) : null;

            if (collapsed) {
              return (
                <CollapsedTraceOutputCard
                  key={item.stamp}
                  item={item}
                  label={label}
                  jobStatus={jobStatus}
                  elapsedMs={elapsedMs}
                  previewSvg={previewSvg}
                  displaySvgBytes={displaySvgBytes}
                  hasAppearanceChanges={hasOutputAppearanceChanges(appearance)}
                  onToggleCollapsed={() => toggleCollapsedOutput(item.stamp)}
                  onCopySvg={onCopySvg}
                  onDownloadSvg={() => downloadSvg(previewSvg, downloadFileName)}
                  onCancelOutputJob={onCancelOutputJob}
                  onRetryOutputJob={onRetryOutputJob}
                />
              );
            }

            return (
              <div
                key={item.stamp}
                tabIndex={-1}
                data-output-stamp={item.stamp}
                data-focused-editor={focused ? "true" : "false"}
                data-collapse-state="expanded"
                data-job-id={item.jobId || ""}
                data-job-status={jobStatus}
                data-engine-used={item.engineUsed || "unknown"}
                data-source-kind={item.sourceKind || "unknown"}
                data-engine-warnings={(item.warnings || []).join(" | ")}
                data-layer-build-mode={item.layerBuildMode || ""}
                data-requested-palette-count={item.requestedPaletteCount ?? ""}
                data-actual-palette-count={item.actualPaletteCount ?? ""}
                data-output-detected-colors={item.outputDetectedColors ?? ""}
                data-path-count={item.pathCount ?? ""}
                data-svg-bytes={displaySvgBytes ?? ""}
                className={[
                  "rounded-xl border border-slate-200 bg-white p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                  focused ? "shadow-xl" : "",
                  highlightedOutputStamp === item.stamp
                    ? "ring-2 ring-sky-300"
                    : "",
                ].join(" ")}
              >
                {focused && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="m-0 text-sm font-bold text-sky-950">
                        Editing {label}
                      </p>
                      <p className="m-0 mt-0.5 text-[12px] text-slate-600">
                        {item.engineUsed ? `Engine: ${item.engineUsed}` : "Engine pending"}
                        {item.width > 0 && item.height > 0
                          ? ` - ${item.width} x ${item.height} px`
                          : ""}
                        {displaySvgBytes ? (
                          <>
                            {" - "}
                            <span data-output-file-size="true">
                              {prettyBytes(displaySvgBytes)}
                            </span>
                          </>
                        ) : null}
                        {item.sourceFileName ? (
                          <>
                            {" - "}
                            <span
                              data-output-source-file={item.sourceFileName}
                              title={`Source: ${item.sourceFileName}`}
                            >
                              Source: {item.sourceFileName}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadSvg(previewSvg, downloadFileName)}
                        className="cursor-pointer rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                      >
                        Download SVG
                      </button>
                      <button
                        type="button"
                        onClick={() => void onCopySvg(previewSvg)}
                        className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                      >
                        Copy SVG
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (item.settingsOpen) onToggleSettings(item.stamp);
                          closeFocusedEditor(item.stamp);
                        }}
                        className="cursor-pointer rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-sky-950 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                      >
                        Done editing
                      </button>
                    </div>
                  </div>
                )}
                {!focused ? (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[13px] font-semibold text-slate-700">
                        {label}
                      </span>
                      <p className="m-0 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-600">
                        <span>
                          {isActiveJob
                            ? formatTraceJobElapsed(elapsedMs)
                            : item.width > 0 && item.height > 0
                            ? `${item.width} x ${item.height} px`
                            : "size unknown"}
                        </span>
                        {!isActiveJob && !isFailedJob && displaySvgBytes ? (
                          <span data-output-file-size="true">
                            {prettyBytes(displaySvgBytes)}
                          </span>
                        ) : null}
                        {item.sourceFileName ? (
                          <span
                            data-output-source-file={item.sourceFileName}
                            title={`Source: ${item.sourceFileName}`}
                            className="min-w-0 truncate"
                          >
                            Source: {item.sourceFileName}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCollapsedOutput(item.stamp)}
                      data-output-minimize-control="true"
                      className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      Minimize
                    </button>
                  </div>
                ) : null}

                {isActiveJob || isFailedJob ? (
                  <TraceJobStateCard
                    item={item}
                    label={label}
                    elapsedMs={elapsedMs}
                    onCancelOutputJob={onCancelOutputJob}
                    onRetryOutputJob={onRetryOutputJob}
                  />
                ) : (
                  <>
                {!focused && (
                <div data-output-action-row="true" className="my-2 flex flex-wrap gap-2">
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
                    onClick={() => {
                      if (!item.settingsOpen) onToggleSettings(item.stamp);
                      openFocusedEditor(item.stamp);
                    }}
                    data-output-primary-action="true"
                    aria-expanded={focused || !!item.settingsOpen}
                    aria-controls={`output-settings-${item.stamp}`}
                    className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-950 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    <SettingsGearIcon />
                    <span className="ml-1">Settings / Edit</span>
                  </button>
                </div>
                )}

                {item.updateError && (
                  <p className="m-0 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-5 text-red-700">
                    {item.updateError}
                  </p>
                )}

                {focused ? (
                  <div
                    data-focused-editor-workspace="true"
                    className="mt-3 grid min-w-0 max-w-full gap-4 overflow-x-hidden lg:grid-cols-[minmax(0,1fr)_minmax(340px,430px)] lg:items-start"
                  >
                    <FocusedEditorPreviewComparison
                      outputSvg={previewSvg}
                      outputAlt={`${label} SVG result`}
                      originalPreviewUrl={
                        item.sourcePreviewUrl ||
                        (sourceAvailableForOutput ? activeSourcePreviewUrl : null)
                      }
                      toolbar={
                        <>
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
                        </>
                      }
                    />
                    {settingsPanel}
                  </div>
                ) : (
                  <>
                    {settingsPanel}
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
                  </>
                )}
                  </>
                )}
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

function TraceJobStateCard<TSettings extends MixedTraceSettings>({
  item,
  label,
  elapsedMs,
  onCancelOutputJob,
  onRetryOutputJob,
}: {
  item: TraceOutputItem<TSettings>;
  label: string;
  elapsedMs: number;
  onCancelOutputJob?: (jobId: string, stamp: number) => void;
  onRetryOutputJob?: (stamp: number) => void;
}) {
  const status = item.jobStatus ?? "running";
  const failed = status === "failed" || status === "canceled";
  const title = failed ? "Conversion did not finish" : "Converting...";
  const statusText = getTraceJobStatusText(status);
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-bold text-slate-900">{title}</p>
          <p className="m-0 mt-1 text-[13px] leading-5 text-slate-600">
            {label}
            {item.sourceFileName ? ` from ${item.sourceFileName}` : ""}
          </p>
        </div>
        {!failed && (
          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[12px] font-bold text-sky-800">
            <span className="mr-1.5 inline-block h-3 w-3 rounded-full border-2 border-sky-300 border-t-sky-700 animate-spin" />
            {statusText}
          </span>
        )}
        {failed && (
          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[12px] font-bold text-red-700">
            {statusText}
          </span>
        )}
      </div>

      <dl className="mt-3 grid gap-2 text-[13px] text-slate-700 sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-900">Elapsed</dt>
          <dd className="m-0">{formatTraceJobElapsed(elapsedMs)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Engine path</dt>
          <dd className="m-0">{item.enginePathLabel || "Hybrid trace"}</dd>
        </div>
      </dl>

      {item.jobError && (
        <p className="m-0 mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-[13px] leading-5 text-red-700">
          {item.jobError}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!failed && item.canCancel && item.jobId && onCancelOutputJob && (
          <button
            type="button"
            onClick={() => onCancelOutputJob(item.jobId!, item.stamp)}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
          >
            Cancel
          </button>
        )}
        {failed && onRetryOutputJob && (
          <button
            type="button"
            onClick={() => onRetryOutputJob(item.stamp)}
            className="cursor-pointer rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function CollapsedTraceOutputCard<TSettings extends MixedTraceSettings>({
  item,
  label,
  jobStatus,
  elapsedMs,
  previewSvg,
  displaySvgBytes,
  hasAppearanceChanges,
  onToggleCollapsed,
  onCopySvg,
  onDownloadSvg,
  onCancelOutputJob,
  onRetryOutputJob,
}: {
  item: TraceOutputItem<TSettings>;
  label: string;
  jobStatus: TraceOutputItem<TSettings>["jobStatus"];
  elapsedMs: number;
  previewSvg: string;
  displaySvgBytes?: number;
  hasAppearanceChanges: boolean;
  onToggleCollapsed: () => void;
  onCopySvg: (svg: string) => void | Promise<void>;
  onDownloadSvg: () => void;
  onCancelOutputJob?: (jobId: string, stamp: number) => void;
  onRetryOutputJob?: (stamp: number) => void;
}) {
  const status = jobStatus ?? "succeeded";
  const active = isTraceJobActive(status);
  const failed = status === "failed" || status === "canceled";
  return (
    <div
      key={item.stamp}
      tabIndex={-1}
      data-output-stamp={item.stamp}
      data-focused-editor="false"
      data-collapse-state="collapsed"
      data-job-id={item.jobId || ""}
      data-job-status={status}
      data-engine-used={item.engineUsed || "unknown"}
      className="rounded-xl border border-slate-200 bg-white p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 truncate text-[13px] font-bold text-slate-800">
            {label}
          </p>
          <p className="m-0 mt-0.5 text-[12px] text-slate-600">
            {active
              ? `${getTraceJobStatusText(status)} - ${formatTraceJobElapsed(elapsedMs)}`
              : failed
                ? getTraceJobStatusText(status)
                : item.width > 0 && item.height > 0
                  ? `${item.width} x ${item.height} px`
                  : "size unknown"}
            {item.engineUsed ? ` - ${item.engineUsed}` : ""}
            {displaySvgBytes ? (
              <>
                {" - "}
                <span data-output-file-size="true">
                  {prettyBytes(displaySvgBytes)}
                </span>
              </>
            ) : null}
            {item.sourceFileName ? (
              <>
                {" - "}
                <span
                  data-output-source-file={item.sourceFileName}
                  title={`Source: ${item.sourceFileName}`}
                >
                  Source: {item.sourceFileName}
                </span>
              </>
            ) : null}
            {hasAppearanceChanges ? " - appearance adjusted" : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!active && !failed && previewSvg && (
            <>
              <button
                type="button"
                onClick={onDownloadSvg}
                className="cursor-pointer rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => void onCopySvg(previewSvg)}
                className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Copy
              </button>
            </>
          )}
          {active && item.canCancel && item.jobId && onCancelOutputJob && (
            <button
              type="button"
              onClick={() => onCancelOutputJob(item.jobId!, item.stamp)}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Cancel
            </button>
          )}
          {failed && onRetryOutputJob && (
            <button
              type="button"
              onClick={() => onRetryOutputJob(item.stamp)}
              className="cursor-pointer rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}

export function OutputAppearanceControls({
  settings,
  support,
  onChange,
  onReset,
}: {
  settings: OutputAppearanceSettings;
  support: ReturnType<typeof detectOutputAppearanceSupport>;
  onChange: (patch: Partial<OutputAppearanceSettings>) => void;
  onReset: () => void;
}) {
  const lineSupported = support.supportsLineWeight;
  const fillSupported = support.supportsFillSpread;
  const hasChanges = hasOutputAppearanceChanges(settings);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[13px] font-bold text-slate-900">
          Stroke and fill
        </p>
        <button
          type="button"
          onClick={onReset}
          disabled={!hasChanges}
          className="cursor-pointer rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      <label className="mt-3 block">
        <span className="flex items-center justify-between gap-2 text-[12px] font-semibold text-slate-700">
          <span>Line weight</span>
          <span>{settings.lineWeight.toFixed(2)}x</span>
        </span>
        <input
          type="range"
          min={0.25}
          max={30}
          step={0.05}
          value={settings.lineWeight}
          disabled={!lineSupported}
          onChange={(event) => onChange({ lineWeight: Number(event.target.value) })}
          className="mt-1 w-full cursor-pointer accent-[#0b2dff] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="text-[12px] text-slate-500">
          {lineSupported
            ? settings.lineWeight > 12
              ? "Very high line weights are manual visual boosts and can overpower delicate paths or increase file size."
              : "Make stroked lines thinner or thicker."
            : "No stroked lines were detected in this SVG."}
        </span>
      </label>

      <label className="mt-3 flex items-center gap-2 text-[12px] text-slate-700">
        <input
          type="checkbox"
          checked={settings.nonScalingStroke}
          disabled={!lineSupported}
          onChange={(event) =>
            onChange({ nonScalingStroke: event.currentTarget.checked })
          }
          className="h-4 w-4 cursor-pointer accent-[#0b2dff] disabled:cursor-not-allowed"
        />
        Keep stroke width consistent when resized
      </label>

      <label className="mt-3 block">
        <span className="flex items-center justify-between gap-2 text-[12px] font-semibold text-slate-700">
          <span>Fill spread</span>
          <span>{settings.fillSpread.toFixed(1)}px</span>
        </span>
        <input
          type="range"
          min={0}
          max={30}
          step={0.1}
          value={settings.fillSpread}
          disabled={!fillSupported}
          onChange={(event) => onChange({ fillSpread: Number(event.target.value) })}
          className="mt-1 w-full cursor-pointer accent-[#0b2dff] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="text-[12px] text-slate-500">
          {fillSupported
            ? settings.fillSpread > 12
              ? "High fill spread values are manual visual boosts and may make tight details heavier or increase file size."
              : "Expand filled regions with a same-color under-stroke."
            : support.fillSpreadDisabledReason || "Fill spread is not safe for this output."}
        </span>
      </label>
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

function isTraceJobActive(status?: TraceOutputItem<MixedTraceSettings>["jobStatus"]) {
  return status === "queued" || status === "running";
}

function getTraceJobElapsedMs<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
  nowMs: number,
): number {
  const started = Number(item.jobStartedAt || 0);
  if (!Number.isFinite(started) || started <= 0) return 0;
  const ended = Number(item.jobCompletedAt || 0);
  const end = Number.isFinite(ended) && ended > 0 ? ended : nowMs;
  return Math.max(0, end - started);
}

function formatTraceJobElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function getTraceJobStatusText(
  status: TraceOutputItem<MixedTraceSettings>["jobStatus"],
): string {
  if (status === "queued") return "Queued";
  if (status === "failed") return "Failed";
  if (status === "canceled") return "Canceled";
  return "Running";
}

function getStoredOutputAppearance<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
): OutputAppearanceSettings {
  return normalizeOutputAppearance(
    item.appearance ?? outputAppearanceStore.get(getOutputAppearanceKey(item)),
  );
}

function getOutputAppearanceKey<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
): string {
  return item.jobId || String(item.stamp);
}

function isPrecisionOutputItem<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
): boolean {
  const text = `${item.name || ""} ${item.presetLabel || ""}`.toLowerCase();
  return /\b(cut|cricut|vinyl|silhouette|laser)\b/.test(text);
}

const svgByteSizeCache = new Map<string, number>();

export function getSvgByteSize(svg: string): number {
  const cached = svgByteSizeCache.get(svg);
  if (cached != null) return cached;
  const size =
    typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(svg).length
      : new Blob([svg], { type: "image/svg+xml;charset=utf-8" }).size;
  svgByteSizeCache.set(svg, size);
  if (svgByteSizeCache.size > 80) {
    const firstKey = svgByteSizeCache.keys().next().value;
    if (firstKey) svgByteSizeCache.delete(firstKey);
  }
  return size;
}

export function prettyBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes) || 0;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
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
