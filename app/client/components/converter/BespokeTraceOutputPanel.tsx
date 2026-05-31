import * as React from "react";
import Icons from "~/client/assets/icons/Icons";
import {
  ExportCompressionSettingsSection,
  useSvgExportCompression,
} from "~/client/components/converter/ExportCompressionControls";
import {
  FullscreenPreviewButton,
} from "~/client/components/converter/FullscreenOutputPreview";
import {
  FocusedEditorPreviewComparison,
  OutputAppearanceControls,
  OutputWarningList,
  getSvgByteSize,
  prettyBytes,
} from "~/client/components/converter/TraceOutputPanel";
import { EditedSvgPreviewImage } from "~/client/components/svg/EditedSvgPreviewImage";
import {
  DEFAULT_OUTPUT_APPEARANCE,
  applyOutputAppearanceToSvg,
  detectOutputAppearanceSupport,
  hasOutputAppearanceChanges,
  normalizeOutputAppearance,
  type OutputAppearanceSettings,
} from "~/client/lib/converter/outputAppearance";
import type { SvgEditingLayerInput } from "~/client/lib/converter/svgEditingModel";
import { validateMeaningfulSvgOutput } from "~/shared/tracing/meaningfulOutput";
import {
  getOutputComplexityWarnings,
  mergeOutputWarnings,
} from "~/shared/tracing/outputComplexity";
import type { TraceResult } from "~/shared/tracing/types";

export type BespokeTraceOutputItem = {
  svg: string;
  width: number;
  height: number;
  stamp: number;
  name?: string;
  presetLabel?: string;
  engineUsed?: TraceResult["engineUsed"];
  sourceKind?: "svg" | "raster";
  warnings?: string[];
  svgBytes?: number;
  pathCount?: number;
  layers?: ReadonlyArray<unknown>;
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

type SettingsRenderArgs<TItem extends BespokeTraceOutputItem> = {
  item: TItem;
  displaySvg: string;
  focused: boolean;
  sourceAvailableForOutput: boolean;
  appearanceControls: React.ReactNode;
};

type BespokeTraceOutputPanelProps<TItem extends BespokeTraceOutputItem> = {
  history: TItem[];
  busy?: boolean;
  file?: File | null;
  downloadLabel?: string;
  downloadFileName?: string;
  emptyTitle?: string;
  emptyBusyTitle?: string;
  resultKindLabel?: string;
  precisionOutput?: boolean;
  fullscreenPreviewIndex: number | null;
  setFullscreenPreviewIndex: (index: number | null) => void;
  getSvg: (item: TItem) => string;
  onCopySvg: (svg: string) => void | Promise<void>;
  renderSettings?: (args: SettingsRenderArgs<TItem>) => React.ReactNode;
  renderPreview?: (args: { item: TItem; displaySvg: string; focused: boolean }) => React.ReactNode;
  onOpenEditor?: (item: TItem) => void;
  onCancelOutputJob?: (jobId: string, stamp: number) => void;
  onRetryOutputJob?: (stamp: number) => void;
};

const appearanceStore = new Map<string, OutputAppearanceSettings>();
type AppearanceSvgCacheEntry = {
  rawSvg: string;
  settingsKey: string;
  precisionOutput: boolean;
  svg: string;
};
const appearanceSvgCache = new Map<string, AppearanceSvgCacheEntry>();

export function getBespokeTraceOutputSvg<TItem extends BespokeTraceOutputItem>(
  item: TItem,
  getSvg: (item: TItem) => string,
  precisionOutput = false,
): string {
  const rawSvg = getSvg(item);
  if (!rawSvg || isActiveJob(item.jobStatus) || isFailedJob(item.jobStatus)) {
    return rawSvg;
  }
  const appearance = getStoredAppearance(item);
  if (!hasOutputAppearanceChanges(appearance)) return rawSvg;
  const cacheKey = getAppearanceKey(item);
  const settingsKey = serializeAppearance(appearance);
  const cached = appearanceSvgCache.get(cacheKey);
  if (
    cached &&
    cached.rawSvg === rawSvg &&
    cached.settingsKey === settingsKey &&
    cached.precisionOutput === precisionOutput
  ) {
    return cached.svg;
  }
  const support = detectOutputAppearanceSupport(rawSvg, {
    precisionOutput,
    sourceKind: item.sourceKind,
    engineUsed: item.engineUsed,
    layers: item.layers as SvgEditingLayerInput[] | undefined,
  });
  const svg = applyOutputAppearanceToSvg(rawSvg, appearance, support, {
    idPrefix: `output-${getAppearanceKey(item)}`,
  });
  appearanceSvgCache.set(cacheKey, {
    rawSvg,
    settingsKey,
    precisionOutput,
    svg,
  });
  return svg;
}

export function BespokeTraceOutputPanel<TItem extends BespokeTraceOutputItem>({
  history,
  busy,
  file,
  downloadLabel = "Download SVG",
  downloadFileName = "converted.svg",
  emptyTitle = "Converted files appear here...",
  emptyBusyTitle = "Converting...",
  resultKindLabel = "SVG result",
  precisionOutput = false,
  fullscreenPreviewIndex,
  setFullscreenPreviewIndex,
  getSvg,
  onCopySvg,
  renderSettings,
  renderPreview,
  onOpenEditor,
  onCancelOutputJob,
  onRetryOutputJob,
}: BespokeTraceOutputPanelProps<TItem>) {
  const hasActiveJob = history.some((item) => isActiveJob(item.jobStatus));
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [focusedOutputStamp, setFocusedOutputStamp] = React.useState<number | null>(null);
  const [collapsedOutputStamps, setCollapsedOutputStamps] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [highlightedOutputStamp, setHighlightedOutputStamp] = React.useState<number | null>(null);
  const [appearanceVersion, setAppearanceVersion] = React.useState(0);
  const exportCompressionKeys = React.useMemo(
    () => history.map((item) => item.stamp),
    [history],
  );
  const exportCompression = useSvgExportCompression(exportCompressionKeys);
  const focusedOutputHasSourcePreview = React.useMemo(
    () =>
      focusedOutputStamp != null &&
      history.some(
        (item) => item.stamp === focusedOutputStamp && item.sourcePreviewUrl,
      ),
    [focusedOutputStamp, history],
  );
  const [activeSourcePreviewUrl, setActiveSourcePreviewUrl] = React.useState<string | null>(null);

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

  React.useEffect(() => {
    pruneAppearanceState(history.map((item) => getAppearanceKey(item)));
  }, [history]);

  function openFocusedEditor(item: TItem) {
    const stamp = item.stamp;
    onOpenEditor?.(item);
    setFocusedOutputStamp(stamp);
    setCollapsedOutputStamps((current) => {
      if (!current.has(stamp)) return current;
      const next = new Set(current);
      next.delete(stamp);
      return next;
    });
  }

  function closeFocusedEditor(stamp: number) {
    setFocusedOutputStamp(null);
    setHighlightedOutputStamp(stamp);
    window.setTimeout(() => {
      const card = document.querySelector<HTMLElement>(`[data-output-stamp="${stamp}"]`);
      card?.scrollIntoView({ block: "center", behavior: "smooth" });
      const focusTarget = card?.querySelector<HTMLElement>("[data-output-primary-action]");
      (focusTarget || card)?.focus?.({ preventScroll: true });
    }, 80);
    window.setTimeout(() => {
      setHighlightedOutputStamp((current) => (current === stamp ? null : current));
    }, 1_500);
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
    item: TItem,
    patch: Partial<OutputAppearanceSettings>,
  ) {
    const key = getAppearanceKey(item);
    const current = getStoredAppearance(item);
    const next = normalizeOutputAppearance({ ...current, ...patch });
    if (serializeAppearance(current) === serializeAppearance(next)) return;
    appearanceStore.set(key, next);
    appearanceSvgCache.delete(key);
    React.startTransition(() => {
      setAppearanceVersion((value) => value + 1);
    });
  }

  function resetOutputAppearance(item: TItem) {
    const key = getAppearanceKey(item);
    const current = getStoredAppearance(item);
    if (
      serializeAppearance(current) === serializeAppearance(DEFAULT_OUTPUT_APPEARANCE) &&
      !appearanceSvgCache.has(key)
    ) {
      return;
    }
    appearanceStore.set(key, DEFAULT_OUTPUT_APPEARANCE);
    appearanceSvgCache.delete(key);
    React.startTransition(() => {
      setAppearanceVersion((value) => value + 1);
    });
  }

  const focusedMode = focusedOutputStamp != null;
  void appearanceVersion;

  return (
    <div
      data-focused-editor={focusedMode ? "true" : "false"}
      data-output-panel-focused={focusedMode ? "true" : "false"}
      className={[
        "converter-output-panel order-3 min-w-0 overflow-visible rounded-xl border border-slate-300/40 bg-[#43546b] p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] transition-[opacity,transform,box-shadow] duration-[300ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:rounded-2xl sm:p-4 md:order-2 md:overflow-auto",
        history.length === 0 && !busy ? "hidden md:block" : "",
        focusedMode
          ? "md:col-span-2 md:row-start-1 md:max-h-none md:self-start"
          : "md:sticky md:top-4 md:row-span-3 md:max-h-[calc(100vh-2rem)] md:self-start",
      ].join(" ")}
    >
      {busy ? (
        <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
      ) : null}
      {history.length > 0 ? (
        <div className="grid gap-3">
          {history.map((item, index) => {
            const label = getOutputLabel(item, index);
            const jobStatus = item.jobStatus ?? "succeeded";
            const active = isActiveJob(jobStatus);
            const failed = jobStatus === "failed" || jobStatus === "canceled";
            const focused = focusedOutputStamp === item.stamp;
            if (focusedOutputStamp != null && !focused) return null;
            const collapsed = !focused && collapsedOutputStamps.has(item.stamp);
            const rawSvg = active || failed || !item.svg ? "" : getSvg(item);
            const appearance = getStoredAppearance(item);
            const support =
              rawSvg && !active && !failed
                ? detectOutputAppearanceSupport(rawSvg, {
                    precisionOutput,
                    sourceKind: item.sourceKind,
                    engineUsed: item.engineUsed,
                    layers: item.layers as SvgEditingLayerInput[] | undefined,
                  })
                : null;
            const candidateDisplaySvg = getBespokeTraceOutputSvg(
              item,
              getSvg,
              precisionOutput,
            );
            const outputValidation =
              candidateDisplaySvg && !active && !failed
                ? validateMeaningfulSvgOutput(candidateDisplaySvg)
                : null;
            const outputInvalidMessage =
              outputValidation && !outputValidation.ok
                ? outputValidation.reasons[0] || "SVG output is not visibly renderable."
                : null;
            const displaySvg = outputInvalidMessage ? "" : candidateDisplaySvg;
            const hasUsableOutput = Boolean(displaySvg && !active && !failed);
            const displaySvgBytes = outputInvalidMessage
              ? undefined
              : displaySvg
                ? getSvgByteSize(displaySvg)
                : item.svgBytes;
            const exportCompressionLevel = exportCompression.getLevel(item.stamp);
            const exportCompressionResult = hasUsableOutput
              ? exportCompression.getExportResult(item.stamp, displaySvg)
              : null;
            const exportCompressionSection = hasUsableOutput ? (
              <ExportCompressionSettingsSection
                id={`output-export-compression-${item.stamp}`}
                level={exportCompressionLevel}
                onLevelChange={(level) =>
                  exportCompression.setLevel(item.stamp, level)
                }
                result={exportCompressionResult}
              />
            ) : null;
            const outputWarnings =
              !active && !failed && !outputInvalidMessage
                ? mergeOutputWarnings(
                    item.warnings,
                    getOutputComplexityWarnings({
                      svg: displaySvg,
                      svgBytes: displaySvgBytes,
                      pathCount: item.pathCount,
                      layerCount: item.layers?.length,
                      routeGroup: item.layers?.length ? "layered" : undefined,
                      precisionOutput,
                    }),
                  )
                : item.warnings || [];
            const elapsedMs = getElapsedMs(item, nowMs);
            const sourceAvailableForOutput =
              !item.sourceFileName || file?.name === item.sourceFileName;
            const appearanceControls =
              support && !active && !failed ? (
                <OutputAppearanceControls
                  settings={appearance}
                  support={support}
                  onChange={(patch) => setOutputAppearance(item, patch)}
                  onReset={() => resetOutputAppearance(item)}
                />
              ) : null;

            if (collapsed) {
              return (
                <CollapsedBespokeCard
                  key={item.stamp}
                  item={item}
                  label={label}
                  jobStatus={jobStatus}
                  elapsedMs={elapsedMs}
                  displaySvg={displaySvg}
                  displaySvgBytes={displaySvgBytes}
                  hasAppearanceChanges={hasOutputAppearanceChanges(appearance)}
                  onToggleCollapsed={() => toggleCollapsedOutput(item.stamp)}
                  onCopySvg={(svg) =>
                    onCopySvg(exportCompression.getExportSvg(item.stamp, svg))
                  }
                  onDownloadSvg={() =>
                    downloadSvg(
                      exportCompression.getExportSvg(item.stamp, displaySvg),
                      downloadFileName,
                    )
                  }
                  onCancelOutputJob={onCancelOutputJob}
                  onRetryOutputJob={onRetryOutputJob}
                />
              );
            }

            const settingsPanel =
              focused && renderSettings && hasUsableOutput ? (
                <div
                  id={`output-settings-${item.stamp}`}
                  data-editor-settings-panel="true"
                  className="min-w-0 max-w-full overflow-x-hidden rounded-xl border border-sky-200 bg-sky-50/70 p-3 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
                >
                  {exportCompressionSection}
                  {renderSettings({
                    item,
                    displaySvg,
                    focused,
                    sourceAvailableForOutput,
                    appearanceControls,
                  })}
                </div>
              ) : null;

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
                data-output-warnings={outputWarnings.join(" | ")}
                data-svg-bytes={displaySvgBytes ?? ""}
                className={[
                  "rounded-xl border border-slate-200 bg-white p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                  focused ? "shadow-xl" : "",
                  highlightedOutputStamp === item.stamp ? "ring-2 ring-sky-300" : "",
                ].join(" ")}
              >
                {focused ? (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="m-0 text-sm font-bold text-sky-950">
                        Editing {label}
                      </p>
                      <OutputMetadataLine
                        item={item}
                        displaySvgBytes={displaySvgBytes}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {hasUsableOutput ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              downloadSvg(
                                exportCompression.getExportSvg(item.stamp, displaySvg),
                                downloadFileName,
                              )
                            }
                            className="cursor-pointer rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                          >
                            Download SVG
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void onCopySvg(
                                exportCompression.getExportSvg(item.stamp, displaySvg),
                              )
                            }
                            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                          >
                            Copy SVG
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => closeFocusedEditor(item.stamp)}
                        className="cursor-pointer rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-sky-950 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                      >
                        Done editing
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[13px] font-semibold text-slate-700">
                        {label}
                      </span>
                      <OutputMetadataLine
                        item={item}
                        displaySvgBytes={displaySvgBytes}
                        elapsedMs={elapsedMs}
                      />
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
                )}

                {!active && !failed && outputWarnings.length > 0 ? (
                  <OutputWarningList warnings={outputWarnings} />
                ) : null}

                {active || failed ? (
                  <BespokeJobStateCard
                    item={item}
                    label={label}
                    elapsedMs={elapsedMs}
                    onCancelOutputJob={onCancelOutputJob}
                    onRetryOutputJob={onRetryOutputJob}
                  />
                ) : outputInvalidMessage ? (
                  <BespokeInvalidOutputCard message={outputInvalidMessage} />
                ) : (
                  <>
                    {!focused ? (
                      <div
                        data-output-action-row="true"
                        data-export-compression-level={exportCompressionLevel}
                        className="my-2 flex flex-wrap gap-2"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            downloadSvg(
                              exportCompression.getExportSvg(item.stamp, displaySvg),
                              downloadFileName,
                            )
                          }
                          disabled={!displaySvg}
                          className="flex cursor-pointer items-center justify-center rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 font-semibold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Icons name="download" size={16} className="mr-1 inline-block" />
                          {downloadLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void onCopySvg(
                              exportCompression.getExportSvg(item.stamp, displaySvg),
                            )
                          }
                          disabled={!displaySvg}
                          className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Icons name="copy" size={16} className="mr-1 inline-block" />
                          Copy SVG
                        </button>
                        {renderSettings ? (
                          <button
                            type="button"
                            onClick={() => openFocusedEditor(item)}
                            disabled={!displaySvg}
                            data-output-primary-action="true"
                            aria-controls={`output-settings-${item.stamp}`}
                            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-950 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                          >
                            <Icons name="settings" size={16} className="mr-1 inline-block" />
                            Settings / Edit
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {focused ? (
                      <div
                        data-focused-editor-workspace="true"
                        className="mt-3 grid min-w-0 max-w-full gap-4 overflow-x-hidden lg:grid-cols-[minmax(0,1fr)_minmax(340px,430px)] lg:items-start"
                      >
                        <FocusedEditorPreviewComparison
                          outputSvg={displaySvg}
                          outputAlt={`${label} ${resultKindLabel}`}
                          originalPreviewUrl={
                            item.sourcePreviewUrl ||
                            (sourceAvailableForOutput ? activeSourcePreviewUrl : null)
                          }
                          toolbar={
                            <FullscreenPreviewButton
                              onOpen={() => setFullscreenPreviewIndex(index)}
                              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                            />
                          }
                        />
                        {settingsPanel}
                      </div>
                    ) : (
                      <div className="relative flex min-h-[240px] items-center justify-center rounded-xl border border-slate-200 bg-white p-2 transparent-checkerboard">
                        <div className="absolute right-2 top-2 z-10">
                          <FullscreenPreviewButton
                            onOpen={() => setFullscreenPreviewIndex(index)}
                            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                          />
                        </div>
                        {renderPreview ? (
                          renderPreview({ item, displaySvg, focused })
                        ) : (
                          <EditedSvgPreviewImage
                            svg={displaySvg}
                            alt={`${label} ${resultKindLabel}`}
                            className="h-auto max-w-full"
                          />
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className={[
            "converter-empty-output-state",
            busy ? "" : "hidden md:flex",
          ].join(" ")}
        >
          {!busy ? <Icons name="success" size={20} className="mb-2 inline-block" /> : null}
          <p className="m-0 font-bold">{busy ? emptyBusyTitle : emptyTitle}</p>
        </div>
      )}
    </div>
  );
}

function OutputMetadataLine({
  item,
  displaySvgBytes,
  elapsedMs,
}: {
  item: BespokeTraceOutputItem;
  displaySvgBytes?: number;
  elapsedMs?: number;
}) {
  const status = item.jobStatus ?? "succeeded";
  const active = isActiveJob(status);
  return (
    <p className="m-0 mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-600">
      <span>
        {active && elapsedMs != null
          ? formatElapsed(elapsedMs)
          : item.width > 0 && item.height > 0
            ? `${item.width} x ${item.height} px`
            : "size unknown"}
      </span>
      {item.engineUsed ? <span>{item.engineUsed}</span> : null}
      {!active && displaySvgBytes ? (
        <span data-output-file-size="true">{prettyBytes(displaySvgBytes)}</span>
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
  );
}

function BespokeInvalidOutputCard({ message }: { message: string }) {
  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="m-0 font-bold">No visible vector output found</p>
      <p className="m-0 mt-1 text-[13px] leading-5">
        {message} Conversion needs a visible SVG before preview, copy, download, or editing is enabled.
      </p>
    </div>
  );
}

function BespokeJobStateCard<TItem extends BespokeTraceOutputItem>({
  item,
  label,
  elapsedMs,
  onCancelOutputJob,
  onRetryOutputJob,
}: {
  item: TItem;
  label: string;
  elapsedMs: number;
  onCancelOutputJob?: (jobId: string, stamp: number) => void;
  onRetryOutputJob?: (stamp: number) => void;
}) {
  const status = item.jobStatus ?? "running";
  const failed = status === "failed" || status === "canceled";
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-bold text-slate-900">
            {failed ? "Conversion did not finish" : "Converting..."}
          </p>
          <p className="m-0 mt-1 text-[13px] leading-5 text-slate-600">
            {label}
            {item.sourceFileName ? ` from ${item.sourceFileName}` : ""}
          </p>
        </div>
        <span
          className={[
            "inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-bold",
            failed
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-sky-200 bg-sky-50 text-sky-800",
          ].join(" ")}
        >
          {!failed ? (
            <span className="mr-1.5 inline-block h-3 w-3 rounded-full border-2 border-sky-300 border-t-sky-700 animate-spin" />
          ) : null}
          {status === "failed"
            ? "Failed"
            : status === "canceled"
              ? "Canceled"
              : status === "queued"
                ? "Queued"
                : "Running"}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-[13px] text-slate-700 sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-900">Elapsed</dt>
          <dd className="m-0">{formatElapsed(elapsedMs)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Engine path</dt>
          <dd className="m-0">{item.enginePathLabel || "Hybrid trace"}</dd>
        </div>
      </dl>
      {item.jobError ? (
        <p className="m-0 mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-[13px] leading-5 text-red-700">
          {item.jobError}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {!failed && item.canCancel && item.jobId && onCancelOutputJob ? (
          <button
            type="button"
            onClick={() => onCancelOutputJob(item.jobId!, item.stamp)}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
          >
            Cancel
          </button>
        ) : null}
        {failed && onRetryOutputJob ? (
          <button
            type="button"
            onClick={() => onRetryOutputJob(item.stamp)}
            className="cursor-pointer rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CollapsedBespokeCard<TItem extends BespokeTraceOutputItem>({
  item,
  label,
  jobStatus,
  elapsedMs,
  displaySvg,
  displaySvgBytes,
  hasAppearanceChanges,
  onToggleCollapsed,
  onCopySvg,
  onDownloadSvg,
  onCancelOutputJob,
  onRetryOutputJob,
}: {
  item: TItem;
  label: string;
  jobStatus: TItem["jobStatus"];
  elapsedMs: number;
  displaySvg: string;
  displaySvgBytes?: number;
  hasAppearanceChanges: boolean;
  onToggleCollapsed: () => void;
  onCopySvg: (svg: string) => void | Promise<void>;
  onDownloadSvg: () => void;
  onCancelOutputJob?: (jobId: string, stamp: number) => void;
  onRetryOutputJob?: (stamp: number) => void;
}) {
  const status = jobStatus ?? "succeeded";
  const active = isActiveJob(status);
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
          <OutputMetadataLine
            item={item}
            displaySvgBytes={displaySvgBytes}
            elapsedMs={elapsedMs}
          />
          {hasAppearanceChanges ? (
            <p className="m-0 mt-0.5 text-[12px] font-medium text-sky-700">
              Appearance adjusted
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!active && !failed && displaySvg ? (
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
                onClick={() => void onCopySvg(displaySvg)}
                className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Copy
              </button>
            </>
          ) : null}
          {active && item.canCancel && item.jobId && onCancelOutputJob ? (
            <button
              type="button"
              onClick={() => onCancelOutputJob(item.jobId!, item.stamp)}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Cancel
            </button>
          ) : null}
          {failed && onRetryOutputJob ? (
            <button
              type="button"
              onClick={() => onRetryOutputJob(item.stamp)}
              className="cursor-pointer rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Retry
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleCollapsed}
            data-output-restore-control="true"
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}

function getStoredAppearance(item: BespokeTraceOutputItem) {
  return normalizeOutputAppearance(
    item.appearance ?? appearanceStore.get(getAppearanceKey(item)),
  );
}

function serializeAppearance(
  appearance: Partial<OutputAppearanceSettings> | null | undefined,
) {
  return JSON.stringify(normalizeOutputAppearance(appearance));
}

function pruneAppearanceState(keys: Iterable<string>) {
  const activeKeys = new Set(keys);
  for (const key of appearanceStore.keys()) {
    if (!activeKeys.has(key)) appearanceStore.delete(key);
  }
  for (const key of appearanceSvgCache.keys()) {
    if (!activeKeys.has(key)) appearanceSvgCache.delete(key);
  }
}

function getAppearanceKey(item: BespokeTraceOutputItem) {
  return item.jobId || String(item.stamp);
}

function getOutputLabel(item: BespokeTraceOutputItem, index: number) {
  const explicit = item.name?.trim();
  if (explicit) return explicit;
  return `Output ${index + 1}${item.presetLabel ? ` - ${item.presetLabel}` : ""}`;
}

function isActiveJob(status?: BespokeTraceOutputItem["jobStatus"]) {
  return status === "queued" || status === "running";
}

function isFailedJob(status?: BespokeTraceOutputItem["jobStatus"]) {
  return status === "failed" || status === "canceled";
}

function getElapsedMs(item: BespokeTraceOutputItem, nowMs: number) {
  const started = Number(item.jobStartedAt || 0);
  if (!Number.isFinite(started) || started <= 0) return 0;
  const completed = Number(item.jobCompletedAt || 0);
  const end = Number.isFinite(completed) && completed > 0 ? completed : nowMs;
  return Math.max(0, end - started);
}

function formatElapsed(elapsedMs: number) {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes <= 0) return `${rest}s`;
  return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

function downloadSvg(svg: string, filename: string) {
  if (!svg) return;
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
