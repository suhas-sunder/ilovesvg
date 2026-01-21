import * as React from "react";
import type { Route } from "./+types/svg-accessibility-and-contrast-checker";
import { Link } from "react-router";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "./cookies";
import SocialLinks from "~/client/components/navigation/SocialLinks";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "SVG Accessibility and Contrast Checker | WCAG AA/AAA + Color Blindness Preview";
  const description =
    "Check SVG color contrast against WCAG (AA/AAA), preview common color blindness modes, and generate higher-contrast color options you can apply and download as an updated SVG.";
  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
  ];
}

/* ========================
   Page
======================== */
export default function SvgAccessibilityAndContrastChecker() {
  // Keep original and a working copy so users can compare before/after.
  const [originalSvg, setOriginalSvg] = React.useState<string>("");
  const [workingSvg, setWorkingSvg] = React.useState<string>("");

  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  // Selected colors
  const [fg, setFg] = React.useState<string>("#0b2dff");
  const [bg, setBg] = React.useState<string>("#ffffff");

  // Which attribute set should be affected when applying suggestions
  const [applyScope, setApplyScope] = React.useState<
    "fill" | "stroke" | "both"
  >("both");

  const [blindMode, setBlindMode] = React.useState<
    "none" | "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia"
  >("none");

  // Preview toggles
  const [previewMode, setPreviewMode] = React.useState<"original" | "updated">(
    "updated",
  );
  const [showCheckerSample, setShowCheckerSample] =
    React.useState<boolean>(true);

  const activeSvg = previewMode === "original" ? originalSvg : workingSvg;

  const parsed = React.useMemo(() => {
    return parseSvgAndExtractColors(workingSvg);
  }, [workingSvg]);

  // When SVG changes, try to auto-select sensible fg/bg.
  React.useEffect(() => {
    if (!workingSvg.trim()) {
      setErr(null);
      setInfo(null);
      return;
    }
    if (!parsed.ok) {
      setErr(parsed.error || "Could not parse SVG.");
      setInfo(null);
      return;
    }

    setErr(null);

    // Auto-pick bg if a full-size rect is detected, else keep current.
    if (parsed.autoBg && isHex(parsed.autoBg)) {
      const next = normalizeHex(parsed.autoBg);
      setBg(next);
      setInfo("Detected a likely background color from the SVG.");
    } else {
      setInfo(null);
    }

    // Auto pick a foreground if we can find a non-background prominent color.
    if (parsed.colors.length > 0) {
      const normalized = parsed.colors.map((c) => normalizeHex(c));
      const bgN = normalizeHex(bg);
      const firstNonBg =
        normalized.find((c) => c.toLowerCase() !== bgN.toLowerCase()) ??
        normalized[0];
      if (firstNonBg && isHex(firstNonBg)) setFg(firstNonBg);
    }
    // We intentionally include bg so foreground choice stays consistent with current bg.
  }, [workingSvg, parsed.ok, parsed.autoBg, parsed.colors, bg]);

  const ratio = React.useMemo(() => contrastRatio(fg, bg), [fg, bg]);

  const wcagTargets = React.useMemo(
    () =>
      [
        { id: "aa-normal", label: "AA (Normal text)", value: 4.5 },
        { id: "aaa-normal", label: "AAA (Normal text)", value: 7 },
        { id: "aa-large", label: "AA (Large text)", value: 3 },
        { id: "aaa-large", label: "AAA (Large text)", value: 4.5 },
      ] as const,
    [],
  );

  const wcag = React.useMemo(() => {
    return {
      aaNormal: ratio >= 4.5,
      aaaNormal: ratio >= 7,
      aaLarge: ratio >= 3,
      aaaLarge: ratio >= 4.5,
    };
  }, [ratio]);

  const passSummary = React.useMemo(() => {
    if (ratio >= 7)
      return { label: "Pass AAA (Normal)", tone: "good" as const };
    if (ratio >= 4.5)
      return { label: "Pass AA (Normal)", tone: "good" as const };
    if (ratio >= 3) return { label: "Pass AA (Large)", tone: "warn" as const };
    return { label: "Fail WCAG targets", tone: "bad" as const };
  }, [ratio]);

  // Suggestions grouped by target (best foreground + best background each).
  const suggestionGroups = React.useMemo(() => {
    const groups = wcagTargets.map((t) => {
      const fgFix = suggestNearestContrastColor({
        fixedHex: bg,
        movingHex: fg,
        moving: "foreground",
        target: t.value,
      });

      const bgFix = suggestNearestContrastColor({
        fixedHex: fg,
        movingHex: bg,
        moving: "background",
        target: t.value,
      });

      return {
        targetId: t.id,
        targetLabel: t.label,
        targetValue: t.value,
        fgFix,
        bgFix,
      };
    });

    return groups;
  }, [fg, bg, wcagTargets]);

  const simulated = React.useMemo(() => {
    const fgSim = simulateColorBlindness(fg, blindMode);
    const bgSim = simulateColorBlindness(bg, blindMode);
    return { fgSim, bgSim };
  }, [fg, bg, blindMode]);

  const palette = parsed.ok ? parsed.colors : [];

  function setSvgTextBoth(next: string) {
    setWorkingSvg(next);
    if (!originalSvg.trim()) setOriginalSvg(next);
  }

  function onUploadSvg(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".svg")) {
      setErr("Please upload an SVG file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const t = String(reader.result ?? "");
      setOriginalSvg(t);
      setWorkingSvg(t);
      setPreviewMode("updated");
      setErr(null);
      setInfo("SVG loaded.");
    };
    reader.onerror = () => setErr("Could not read file.");
    reader.readAsText(f);
    e.currentTarget.value = "";
  }

  function onPasteChange(next: string) {
    // If original is empty, treat first paste as original too.
    if (!originalSvg.trim() && next.trim()) {
      setOriginalSvg(next);
    }
    setWorkingSvg(next);
  }

  function clearAll() {
    setOriginalSvg("");
    setWorkingSvg("");
    setErr(null);
    setInfo(null);
  }

  function setFromPalette(color: string) {
    const c = normalizeHex(color);
    setFg(c);
  }

  function applySuggestion(args: {
    kind: "foreground" | "background";
    to: string;
    targetLabel: string;
    targetValue: number;
    ratioAfter: number;
  }) {
    if (!workingSvg.trim()) {
      setInfo("Pick colors first, then paste/upload an SVG to apply changes.");
      return;
    }

    if (!parsed.ok) return;

    let nextSvg = workingSvg;

    if (args.kind === "foreground") {
      nextSvg = replaceSvgColorBestEffort(nextSvg, fg, args.to, applyScope);
      setFg(args.to);
      setWorkingSvg(nextSvg);
      setPreviewMode("updated");
      setInfo(
        `Applied foreground update for ${args.targetLabel} (${args.targetValue}:1).`,
      );
      return;
    }

    // Background change: update likely bg rect if present. Otherwise only the checker bg changes.
    const updated = replaceLikelyBackgroundFill(nextSvg, bg, args.to);
    setBg(args.to);
    setWorkingSvg(updated);
    setPreviewMode("updated");
    setInfo(
      `Applied background update where possible for ${args.targetLabel} (${args.targetValue}:1).`,
    );
  }

  function resetToOriginal() {
    if (!originalSvg.trim()) return;
    setWorkingSvg(originalSvg);
    setPreviewMode("updated");
    setInfo("Reset updated SVG back to the original.");
  }

  function downloadSvg() {
    if (!workingSvg.trim()) return;
    const blob = new Blob([workingSvg], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "accessible.svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const safeOriginalSvg = React.useMemo(
    () => sanitizeSvgString(originalSvg),
    [originalSvg],
  );
  const safeWorkingSvg = React.useMemo(
    () => sanitizeSvgString(workingSvg),
    [workingSvg],
  );

  return (
    <>
      <SiteHeader />

      <main className="min-h-[100dvh] bg-slate-50 text-slate-900">
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-12">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="text-sm text-slate-600 mb-4">
            <Link to="/" className="hover:underline underline-offset-4">
              Home
            </Link>{" "}
            <span className="text-slate-300" aria-hidden>
              /
            </span>{" "}
            <span className="text-slate-900 font-semibold">
              SVG Accessibility and Contrast Checker
            </span>
          </nav>

          <header className="text-center mb-4">
            <h1 className="text-[28px] sm:text-[34px] font-extrabold leading-tight m-0">
              SVG Accessibility and Contrast Checker
            </h1>
            <p className="mt-2 text-slate-600 max-w-[78ch] mx-auto">
              Check WCAG contrast (AA/AAA), preview common color blindness
              modes, generate higher-contrast options, apply them to your SVG,
              and download the updated file.
            </p>
          </header>

          {/* Status banner */}
          <section className="mb-4">
            <div
              className={[
                "rounded-2xl border p-4 bg-white shadow-sm",
                passSummary.tone === "good"
                  ? "border-emerald-200"
                  : passSummary.tone === "warn"
                    ? "border-amber-200"
                    : "border-rose-200",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-700">
                    Current contrast ratio
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    {ratio.toFixed(2)}:1
                  </div>
                  <div className="text-sm text-slate-600">
                    {passSummary.label}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span
                      className="h-4 w-4 rounded-full border border-slate-200"
                      style={{ background: fg }}
                      aria-hidden
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      FG
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-900">
                      {fg}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span
                      className="h-4 w-4 rounded-full border border-slate-200"
                      style={{ background: bg }}
                      aria-hidden
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      BG
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-900">
                      {bg}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={downloadSvg}
                    disabled={!workingSvg.trim()}
                    className="px-3 py-2 rounded-xl font-semibold border bg-[#0b2dff] text-white border-[#0a24da] hover:bg-[#0a24da] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Download updated SVG
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* INPUT */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden min-w-0">
              <div className="flex items-start justify-between gap-3">
                <h2 className="m-0 text-lg text-slate-900">Input</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetToOriginal}
                    disabled={!originalSvg.trim()}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Reset updated
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-3 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100">
                    <span className="text-sm font-semibold">Upload SVG</span>
                    <input
                      type="file"
                      accept="image/svg+xml,.svg"
                      onChange={onUploadSvg}
                      className="hidden"
                    />
                  </label>

                  <div className="flex-1 min-w-[220px]">
                    <label className="sr-only" htmlFor="previewMode">
                      Preview mode
                    </label>
                    <select
                      id="previewMode"
                      value={previewMode}
                      onChange={(e) =>
                        setPreviewMode(e.target.value as typeof previewMode)
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
                      disabled={!originalSvg.trim() && !workingSvg.trim()}
                    >
                      <option value="updated">Preview: Updated SVG</option>
                      <option value="original">Preview: Original SVG</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">
                    Paste SVG code (this edits the updated copy)
                  </label>
                  <textarea
                    value={workingSvg}
                    onChange={(e) => onPasteChange(e.target.value)}
                    placeholder="<svg ...>...</svg>"
                    className="mt-2 w-full min-h-[240px] rounded-2xl border border-slate-200 bg-white p-3 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                </div>

                {err && <div className="text-red-700 text-sm">{err}</div>}
                {!err && info && (
                  <div className="text-slate-600 text-sm">{info}</div>
                )}

                {/* Palette */}
                <div className="mt-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">
                      Extracted palette
                    </div>
                    <div className="text-xs text-slate-500">
                      {palette.length > 0 ? `${palette.length} colors` : ""}
                    </div>
                  </div>

                  {parsed.ok ? (
                    palette.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {palette.slice(0, 30).map((c) => {
                          const n = normalizeHex(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setFromPalette(n)}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50"
                              title={`Use ${n} as foreground`}
                            >
                              <span
                                className="h-4 w-4 rounded-full border border-slate-200"
                                style={{ background: n }}
                              />
                              <span className="text-xs font-semibold text-slate-800">
                                {n}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-600">
                        No colors detected yet. Paste or upload an SVG.
                      </div>
                    )
                  ) : (
                    <div className="mt-2 text-sm text-slate-600">
                      Paste a valid SVG to extract colors.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-7 grid gap-4 min-w-0">
              {/* CONTROLS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0">
                <h2 className="m-0 mb-3 text-lg text-slate-900">Check</h2>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 min-w-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
                      <ColorField
                        label="Foreground"
                        value={fg}
                        onChange={setFg}
                      />
                      <ColorField
                        label="Background"
                        value={bg}
                        onChange={setBg}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="min-w-0">
                        <label className="text-sm font-semibold text-slate-700">
                          Apply scope
                        </label>
                        <select
                          value={applyScope}
                          onChange={(e) =>
                            setApplyScope(e.target.value as typeof applyScope)
                          }
                          className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                        >
                          <option value="both">fill + stroke</option>
                          <option value="fill">fill only</option>
                          <option value="stroke">stroke only</option>
                        </select>
                      </div>

                      <div className="min-w-0">
                        <label className="text-sm font-semibold text-slate-700">
                          Color blindness preview
                        </label>
                        <select
                          value={blindMode}
                          onChange={(e) => setBlindMode(e.target.value as any)}
                          className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                        >
                          <option value="none">None</option>
                          <option value="protanopia">
                            Protanopia (red-weak)
                          </option>
                          <option value="deuteranopia">
                            Deuteranopia (green-weak)
                          </option>
                          <option value="tritanopia">
                            Tritanopia (blue-weak)
                          </option>
                          <option value="achromatopsia">
                            Achromatopsia (gray)
                          </option>
                        </select>
                      </div>

                      <div className="min-w-0">
                        <label className="text-sm font-semibold text-slate-700">
                          Preview helper text
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowCheckerSample((v) => !v)}
                          className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold"
                        >
                          {showCheckerSample
                            ? "Hide sample text"
                            : "Show sample text"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* WCAG table */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-sm font-semibold text-slate-900">
                        WCAG contrast checks
                      </div>
                      <div className="text-xs text-slate-600">
                        Ratio:{" "}
                        <span className="font-bold text-slate-900">
                          {ratio.toFixed(2)}:1
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-slate-600">
                          <tr>
                            <th className="py-2 pr-2 font-semibold">Target</th>
                            <th className="py-2 pr-2 font-semibold">
                              Threshold
                            </th>
                            <th className="py-2 pr-2 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-800">
                          <tr className="border-t border-slate-100">
                            <td className="py-2 pr-2">AA (Normal text)</td>
                            <td className="py-2 pr-2">4.5:1</td>
                            <td className="py-2 pr-2">
                              <WcagPill
                                ok={wcag.aaNormal}
                                label="AA normal 4.5"
                              />
                            </td>
                          </tr>
                          <tr className="border-t border-slate-100">
                            <td className="py-2 pr-2">AAA (Normal text)</td>
                            <td className="py-2 pr-2">7.0:1</td>
                            <td className="py-2 pr-2">
                              <WcagPill
                                ok={wcag.aaaNormal}
                                label="AAA normal 7.0"
                              />
                            </td>
                          </tr>
                          <tr className="border-t border-slate-100">
                            <td className="py-2 pr-2">AA (Large text)</td>
                            <td className="py-2 pr-2">3.0:1</td>
                            <td className="py-2 pr-2">
                              <WcagPill
                                ok={wcag.aaLarge}
                                label="AA large 3.0"
                              />
                            </td>
                          </tr>
                          <tr className="border-t border-slate-100">
                            <td className="py-2 pr-2">AAA (Large text)</td>
                            <td className="py-2 pr-2">4.5:1</td>
                            <td className="py-2 pr-2">
                              <WcagPill
                                ok={wcag.aaaLarge}
                                label="AAA large 4.5"
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 text-xs text-slate-600">
                      WCAG contrast targets are defined for text, but they are a
                      practical proxy for SVG UI labels, meaningful icons, and
                      key visual elements. Decorative art does not always
                      require strict compliance.
                    </div>
                  </div>
                </div>
              </div>

              {/* PREVIEWS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="m-0 text-lg text-slate-900">Preview</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">
                      Background
                    </span>
                    <span
                      className="h-4 w-4 rounded-full border border-slate-200"
                      style={{
                        background: blindMode === "none" ? bg : simulated.bgSim,
                      }}
                      aria-hidden
                    />
                    <span className="text-xs font-mono text-slate-700">
                      {blindMode === "none" ? bg : simulated.bgSim}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
                  <PreviewCard
                    title="Original SVG"
                    svg={safeOriginalSvg}
                    bg={blindMode === "none" ? bg : simulated.bgSim}
                    emptyHint="Upload or paste an SVG to see it here."
                    tone="original"
                  />

                  <PreviewCard
                    title="Updated SVG"
                    svg={safeWorkingSvg}
                    bg={blindMode === "none" ? bg : simulated.bgSim}
                    emptyHint="Apply a suggestion or edit the SVG to see changes here."
                    tone="updated"
                  />
                </div>

                {showCheckerSample && (
                  <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
                    <div
                      className="p-4"
                      style={{
                        background: blindMode === "none" ? bg : simulated.bgSim,
                      }}
                    >
                      <div className="text-xs font-semibold text-slate-700">
                        Readability sample (uses the chosen FG color)
                      </div>

                      <div className="mt-2 rounded-2xl border border-slate-200 bg-white/80 p-4">
                        <div
                          className="text-[18px] font-extrabold"
                          style={{
                            color: blindMode === "none" ? fg : simulated.fgSim,
                          }}
                        >
                          Sample headline text
                        </div>
                        <div
                          className="mt-1 text-sm"
                          style={{
                            color: blindMode === "none" ? fg : simulated.fgSim,
                          }}
                        >
                          Sample body text for readability checks.
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-slate-600">
                        The color blindness preview is a best-effort simulation
                        for design checks. It is not medical-grade.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SUGGESTIONS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="m-0 text-lg text-slate-900">
                    Better contrast options
                  </h2>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("original")}
                      disabled={!originalSvg.trim()}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Show original
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("updated")}
                      disabled={!workingSvg.trim()}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Show updated
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3">
                  {suggestionGroups.map((g) => {
                    const fgCandidate = g.fgFix
                      ? {
                          kind: "foreground" as const,
                          to: g.fgFix.hex,
                          ratioAfter: g.fgFix.ratio,
                        }
                      : null;

                    const bgCandidate = g.bgFix
                      ? {
                          kind: "background" as const,
                          to: g.bgFix.hex,
                          ratioAfter: g.bgFix.ratio,
                        }
                      : null;

                    const alreadyMeets = ratio >= g.targetValue;

                    return (
                      <div
                        key={g.targetId}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {g.targetLabel}
                            </div>
                            <div className="text-xs text-slate-600">
                              Target: {g.targetValue}:1
                              {alreadyMeets ? " • Already passing" : ""}
                            </div>
                          </div>

                          <div className="text-xs text-slate-600">
                            Current:{" "}
                            <span className="font-bold text-slate-900">
                              {ratio.toFixed(2)}:1
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <SuggestionTile
                            disabled={!fgCandidate}
                            title="Adjust foreground"
                            scopeHint={
                              applyScope === "both"
                                ? "Applies to fill and stroke"
                                : applyScope === "fill"
                                  ? "Applies to fill only"
                                  : "Applies to stroke only"
                            }
                            current={fg}
                            candidate={fgCandidate?.to}
                            ratioAfter={fgCandidate?.ratioAfter}
                            onApply={() => {
                              if (!fgCandidate) return;
                              applySuggestion({
                                kind: "foreground",
                                to: fgCandidate.to,
                                targetLabel: g.targetLabel,
                                targetValue: g.targetValue,
                                ratioAfter: fgCandidate.ratioAfter,
                              });
                            }}
                          />

                          <SuggestionTile
                            disabled={!bgCandidate}
                            title="Adjust background"
                            scopeHint="Updates likely 100% rect background when possible"
                            current={bg}
                            candidate={bgCandidate?.to}
                            ratioAfter={bgCandidate?.ratioAfter}
                            onApply={() => {
                              if (!bgCandidate) return;
                              applySuggestion({
                                kind: "background",
                                to: bgCandidate.to,
                                targetLabel: g.targetLabel,
                                targetValue: g.targetValue,
                                ratioAfter: bgCandidate.ratioAfter,
                              });
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 text-xs text-slate-600">
                  Applying changes is best-effort. This updates matching colors
                  in attributes and inline styles. If your SVG uses gradients,
                  CSS variables, external stylesheets, or complex paint servers,
                  you may need manual edits.
                </div>
              </div>
            </div>
          </section>

          {/* SEO + FAQ (below utility) */}
          <SeoSections />

          {/* ld+json FAQPage */}
          <FaqJsonLd />
        </div>
      </main>
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />

      <SiteFooter />
    </>
  );
}

/* ========================
   Small UI components
======================== */
function ColorField(props: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center gap-3 min-w-0">
      <label
        htmlFor={id}
        className="text-sm font-semibold text-slate-900 min-w-[96px]"
      >
        {props.label}
      </label>
      <input
        type="color"
        value={isHex(props.value) ? normalizeHex(props.value) : "#000000"}
        onChange={(e) => props.onChange(normalizeHex(e.target.value))}
        className="w-14 h-9 rounded-lg border border-slate-200 bg-white"
        aria-label={`${props.label} color`}
      />
      <input
        id={id}
        value={props.value}
        onChange={(e) => props.onChange(normalizeHex(e.target.value))}
        className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-mono"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

function PreviewCard(props: {
  title: string;
  svg: string;
  bg: string;
  emptyHint: string;
  tone: "original" | "updated";
}) {
  const border =
    props.tone === "updated" ? "border-sky-200" : "border-slate-200";
  const chip =
    props.tone === "updated"
      ? "bg-sky-50 text-sky-800 border-sky-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <div className={`rounded-2xl border ${border} overflow-hidden min-w-0`}>
      <div className="px-3 py-2 bg-white border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">
          {props.title}
        </div>
        <span
          className={`text-xs font-semibold rounded-full px-2 py-1 border ${chip}`}
        >
          {props.tone === "updated" ? "Updated" : "Original"}
        </span>
      </div>

      <div className="p-3">
        <div
          className="rounded-2xl border border-slate-200 overflow-hidden"
          style={{ background: props.bg }}
        >
          <div className="h-[240px] w-full p-3">
            {props.svg.trim() ? (
              <div
                className="w-full h-full flex items-center justify-center"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{
                  __html: wrapSvgForPreview(props.svg),
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-600 px-4 text-center">
                {props.emptyHint}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SuggestionTile(props: {
  title: string;
  scopeHint: string;
  current: string;
  candidate?: string;
  ratioAfter?: number;
  disabled: boolean;
  onApply: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 min-w-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {props.title}
          </div>
          <div className="text-xs text-slate-600">{props.scopeHint}</div>
        </div>

        {props.ratioAfter != null && (
          <div className="text-xs text-slate-600">
            New ratio:{" "}
            <span className="font-bold text-slate-900">
              {props.ratioAfter.toFixed(2)}:1
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
          <div className="text-xs font-semibold text-slate-700">Current</div>
          <div className="mt-1 flex items-center gap-2 min-w-0">
            <span
              className="h-5 w-5 rounded-full border border-slate-200"
              style={{ background: normalizeHex(props.current) }}
              aria-hidden
            />
            <span className="text-xs font-mono font-semibold text-slate-900 truncate">
              {normalizeHex(props.current)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
          <div className="text-xs font-semibold text-slate-700">Suggested</div>
          <div className="mt-1 flex items-center gap-2 min-w-0">
            <span
              className="h-5 w-5 rounded-full border border-slate-200"
              style={{
                background: props.candidate
                  ? normalizeHex(props.candidate)
                  : "#fff",
              }}
              aria-hidden
            />
            <span className="text-xs font-mono font-semibold text-slate-900 truncate">
              {props.candidate
                ? normalizeHex(props.candidate)
                : "No option found"}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={props.onApply}
        disabled={props.disabled}
        className="mt-3 w-full px-3 py-2 rounded-xl font-semibold border bg-white border-slate-200 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Apply suggestion to updated SVG
      </button>
    </div>
  );
}

/* ========================
   UI bits
======================== */
function WcagPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={[
        "inline-flex items-center justify-center rounded-lg border px-2.5 py-2 text-center font-semibold",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800",
      ].join(" ")}
    >
      {ok ? "Pass" : "Fail"} <span className="mx-1 font-normal">•</span> {label}
    </div>
  );
}

/* ========================
   SEO section + FAQ
======================== */
function SeoSections() {
  return (
    <section className="mt-12 border-t border-slate-200 bg-white">
      <div className="max-w-[1180px] mx-auto px-4 py-12 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              WCAG contrast for SVG
            </p>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight mt-2">
              Make your SVG colors readable and accessible
            </h2>
            <p className="mt-2 text-slate-600 max-w-[80ch]">
              This tool checks color contrast for foreground and background
              pairs against common WCAG targets (AA and AAA). It also previews
              how your chosen colors may appear under common color blindness
              modes, and generates higher-contrast alternatives you can apply to
              your SVG and download.
            </p>

            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { k: "WCAG checks", v: "AA and AAA thresholds" },
                { k: "Palette extract", v: "Pull colors from your SVG" },
                { k: "Color blindness", v: "Preview major modes" },
                { k: "Apply and download", v: "Update SVG in one click" },
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

          <section className="mt-10">
            <h3 className="text-lg font-bold">What this checks</h3>
            <div className="mt-3 grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-sm font-semibold">Contrast ratio</div>
                <p className="mt-1 text-sm text-slate-600">
                  Contrast is computed from relative luminance (sRGB). Higher is
                  better. Typical targets are 4.5:1 for normal text (AA) and 7:1
                  for enhanced readability (AAA).
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-sm font-semibold">
                  Color blindness preview
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  The preview applies a best-effort simulation matrix for common
                  types of color vision deficiency. It helps you catch pairs
                  that look distinct in full color but collapse into similar
                  tones.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h3 className="text-lg font-bold">Best practices</h3>
            <div className="mt-3 grid md:grid-cols-2 gap-4">
              {[
                [
                  "Avoid meaning by color alone",
                  "Use shape, icons, labels, or patterns so meaning survives when colors are hard to distinguish.",
                ],
                [
                  "Choose a real background",
                  "If your SVG is used on a colored UI surface, test against that background, not pure white.",
                ],
                [
                  "Aim higher than the minimum",
                  "If you can reach 7:1, do it. It holds up better across screens, lighting, and compression.",
                ],
                [
                  "Watch saturated blues",
                  "Bright blues can look strong but still fail contrast depending on luminance.",
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

          <section
            className="mt-12"
            itemScope
            itemType="https://schema.org/FAQPage"
          >
            <h3 className="text-lg font-bold">Frequently asked questions</h3>

            <div className="mt-4 grid gap-3">
              {FAQ.map((x) => (
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

const FAQ = [
  {
    q: "What WCAG targets does this tool use?",
    a: "It checks common contrast thresholds: 4.5:1 for normal text (AA), 7:1 for normal text (AAA), and 3:1 for large text (AA).",
  },
  {
    q: "Is this only for text?",
    a: "Contrast targets are defined for text, but they are a useful proxy for SVG UI labels, important icons, and meaning-carrying graphics. Decorative art does not always require strict compliance.",
  },
  {
    q: "How does the color blindness preview work?",
    a: "It applies a best-effort simulation matrix for common color vision deficiency types. Use it as a practical sanity check, not as a medical-grade simulator.",
  },
  {
    q: "Will applying suggestions always update my SVG correctly?",
    a: "It is best-effort. It updates matching colors in attributes and styles. If your SVG uses gradients, CSS variables, or external stylesheets, you may need manual edits.",
  },
];

function FaqJsonLd() {
  const jsonLd = React.useMemo(() => {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((x) => ({
        "@type": "Question",
        name: x.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: x.a,
        },
      })),
    };
  }, []);

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

/* ========================
   SVG parsing and extraction
======================== */
function parseSvgAndExtractColors(svgText: string): {
  ok: boolean;
  error?: string;
  colors: string[];
  autoBg?: string | null;
} {
  const t = (svgText ?? "").trim();
  if (!t) return { ok: true, colors: [], autoBg: null };

  if (!t.toLowerCase().includes("<svg")) {
    return {
      ok: false,
      error: "This does not look like an SVG.",
      colors: [],
      autoBg: null,
    };
  }

  // DOMParser is browser-only. This route is client heavy by design.
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return { ok: true, colors: [], autoBg: null };
  }

  try {
    const doc = new DOMParser().parseFromString(t, "image/svg+xml");
    const parserErr = doc.querySelector("parsererror");
    if (parserErr) {
      return {
        ok: false,
        error: "SVG parse error. Please paste a valid SVG.",
        colors: [],
        autoBg: null,
      };
    }

    const svg = doc.querySelector("svg");
    if (!svg) {
      return {
        ok: false,
        error: "No <svg> root element found.",
        colors: [],
        autoBg: null,
      };
    }

    const colors = new Set<string>();

    // Extract from fill/stroke attributes + inline styles
    const all = doc.querySelectorAll("*");
    all.forEach((el) => {
      const fill = el.getAttribute("fill");
      const stroke = el.getAttribute("stroke");
      const style = el.getAttribute("style");

      for (const v of [fill, stroke]) {
        if (!v) continue;
        const maybe = normalizeColorToken(v);
        if (maybe) colors.add(maybe);
      }

      if (style) {
        const found = extractColorsFromStyle(style);
        found.forEach((c) => colors.add(c));
      }
    });

    // Try to detect background: look for a rect that likely covers the canvas
    let autoBg: string | null = null;
    const rects = Array.from(doc.querySelectorAll("rect"));
    for (const r of rects) {
      const x = r.getAttribute("x") ?? "0";
      const y = r.getAttribute("y") ?? "0";
      const w = r.getAttribute("width") ?? "";
      const h = r.getAttribute("height") ?? "";
      const fill = r.getAttribute("fill") ?? "";
      const maybeFill = normalizeColorToken(fill);

      const x0 = x === "0" || x === "0%";
      const y0 = y === "0" || y === "0%";
      const whFull = w === "100%" && h === "100%";
      if (x0 && y0 && whFull && maybeFill) {
        autoBg = maybeFill;
        break;
      }
    }

    const list = Array.from(colors).filter(isHex).map(normalizeHex);

    // Stable ordering: sort by luminance descending
    list.sort((a, b) => relLuminance(b) - relLuminance(a));

    return { ok: true, colors: list, autoBg };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message || "Could not parse SVG.",
      colors: [],
      autoBg: null,
    };
  }
}

function extractColorsFromStyle(style: string): string[] {
  const out: string[] = [];
  const re = /(fill|stroke|color|stop-color)\s*:\s*([^;]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(style))) {
    const token = m[2].trim();
    const maybe = normalizeColorToken(token);
    if (maybe) out.push(maybe);
  }
  return out;
}

/* ========================
   Contrast math
======================== */
function contrastRatio(fg: string, bg: string): number {
  if (!isHex(fg) || !isHex(bg)) return 1;
  const L1 = relLuminance(fg);
  const L2 = relLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function relLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const srgb = [r, g, b].map((v) => v / 255);
  const lin = srgb.map((c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/* ========================
   Suggestions
======================== */
function suggestNearestContrastColor(opts: {
  fixedHex: string;
  movingHex: string;
  moving: "foreground" | "background";
  target: number;
}): { hex: string; ratio: number } | null {
  const fixed = normalizeHex(opts.fixedHex);
  const moving = normalizeHex(opts.movingHex);
  if (!isHex(fixed) || !isHex(moving)) return null;

  const current =
    opts.moving === "foreground"
      ? contrastRatio(moving, fixed)
      : contrastRatio(fixed, moving);

  if (current >= opts.target) {
    return { hex: moving, ratio: current };
  }

  const black = "#000000";
  const white = "#ffffff";

  const towardBlack = findBlendThatMeetsTarget(
    moving,
    black,
    fixed,
    opts.moving,
    opts.target,
  );
  const towardWhite = findBlendThatMeetsTarget(
    moving,
    white,
    fixed,
    opts.moving,
    opts.target,
  );

  if (!towardBlack && !towardWhite) return null;
  if (towardBlack && !towardWhite) return towardBlack;
  if (!towardBlack && towardWhite) return towardWhite;

  return towardBlack!.delta <= towardWhite!.delta ? towardBlack! : towardWhite!;
}

function findBlendThatMeetsTarget(
  start: string,
  end: string,
  fixed: string,
  moving: "foreground" | "background",
  target: number,
): { hex: string; ratio: number; delta: number } | null {
  let best: { hex: string; ratio: number; delta: number } | null = null;
  for (let i = 1; i <= 80; i++) {
    const t = i / 80;
    const blended = rgbToHex(blendRgb(hexToRgb(start), hexToRgb(end), t));
    const r =
      moving === "foreground"
        ? contrastRatio(blended, fixed)
        : contrastRatio(fixed, blended);
    if (r >= target) {
      best = { hex: blended, ratio: r, delta: t };
      break;
    }
  }
  return best;
}

/* ========================
   Color blindness preview
======================== */
function simulateColorBlindness(
  hex: string,
  mode: "none" | "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia",
): string {
  if (mode === "none") return normalizeHex(hex);
  if (!isHex(hex)) return "#000000";

  const { r, g, b } = hexToRgb(hex);
  const M = getBlindMatrix(mode);
  const nr = clamp(Math.round(r * M[0] + g * M[1] + b * M[2]));
  const ng = clamp(Math.round(r * M[3] + g * M[4] + b * M[5]));
  const nb = clamp(Math.round(r * M[6] + g * M[7] + b * M[8]));
  return rgbToHex({ r: nr, g: ng, b: nb });
}

function getBlindMatrix(
  mode: "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia",
): number[] {
  switch (mode) {
    case "protanopia":
      return [0.567, 0.433, 0.0, 0.558, 0.442, 0.0, 0.0, 0.242, 0.758];
    case "deuteranopia":
      return [0.625, 0.375, 0.0, 0.7, 0.3, 0.0, 0.0, 0.3, 0.7];
    case "tritanopia":
      return [0.95, 0.05, 0.0, 0.0, 0.433, 0.567, 0.0, 0.475, 0.525];
    case "achromatopsia":
      return [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114];
  }
}

/* ========================
   Apply to SVG (best-effort)
======================== */
function replaceSvgColorBestEffort(
  svg: string,
  fromHex: string,
  toHex: string,
  scope: "fill" | "stroke" | "both",
): string {
  const from = normalizeHex(fromHex).toLowerCase();
  const to = normalizeHex(toHex);

  const parts: Array<"fill" | "stroke"> =
    scope === "both" ? ["fill", "stroke"] : [scope];

  let out = svg;

  for (const attr of parts) {
    out = out.replace(
      new RegExp(`${attr}\\s*=\\s*["']\\s*${escapeReg(from)}\\s*["']`, "gi"),
      `${attr}="${to}"`,
    );

    out = out.replace(
      new RegExp(`(${attr}\\s*:\\s*)${escapeReg(from)}(\\s*;)`, "gi"),
      `$1${to}$2`,
    );

    out = out.replace(
      new RegExp(`(${attr}\\s*:\\s*)${escapeReg(from)}(\\s*["'])`, "gi"),
      `$1${to}$2`,
    );
  }

  out = out.replace(
    new RegExp(
      `(${["stop-color", "color"].join("|")})\\s*:\\s*${escapeReg(from)}`,
      "gi",
    ),
    (_m, k) => `${k}: ${to}`,
  );

  return out;
}

function replaceLikelyBackgroundFill(
  svg: string,
  fromHex: string,
  toHex: string,
): string {
  const from = normalizeHex(fromHex).toLowerCase();
  const to = normalizeHex(toHex);

  let out = svg;

  out = out.replace(
    new RegExp(
      `(<rect\\b[^>]*\\bwidth\\s*=\\s*["']100%["'][^>]*\\bheight\\s*=\\s*["']100%["'][^>]*\\bfill\\s*=\\s*["'])\\s*${escapeReg(
        from,
      )}\\s*(["'][^>]*>)`,
      "gi",
    ),
    `$1${to}$2`,
  );

  out = out.replace(
    new RegExp(
      `(<rect\\b[^>]*\\bwidth\\s*=\\s*["']100%["'][^>]*\\bheight\\s*=\\s*["']100%["'][^>]*\\bstyle\\s*=\\s*["'][^"']*fill\\s*:\\s*)${escapeReg(
        from,
      )}([^"']*["'][^>]*>)`,
      "gi",
    ),
    `$1${to}$2`,
  );

  return out;
}

/* ========================
   SVG preview safety helpers
   Minimal sanitizer: strips scripts + event handlers.
======================== */
function sanitizeSvgString(svg: string): string {
  const t = (svg ?? "").trim();
  if (!t) return "";

  // Remove <script> blocks
  let out = t.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");

  // Remove on* handlers like onclick="..."
  out = out.replace(/\son[a-z]+\s*=\s*(".*?"|'.*?')/gi, "");

  // Remove javascript: URLs in href/xlink:href
  out = out.replace(
    /\s(xlink:href|href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi,
    "",
  );

  return out;
}

function wrapSvgForPreview(svg: string): string {
  // Ensure the SVG scales nicely inside the preview box
  // If the SVG already has width/height, the wrapper will still constrain it.
  // This stays best-effort. No heavy parsing here.
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
    <div style="max-width:100%;max-height:100%;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
      ${svg}
    </div>
  </div>`;
}

/* ========================
   Color helpers
======================== */
function normalizeColorToken(token: string): string | null {
  const t = token.trim().toLowerCase();
  if (!t) return null;
  if (t === "none" || t === "transparent" || t.startsWith("url(")) return null;

  if (isHex(t)) return normalizeHex(t);

  const rgb = t.match(
    /^rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)$/,
  );
  if (rgb) {
    const r = clamp(parseInt(rgb[1], 10));
    const g = clamp(parseInt(rgb[2], 10));
    const b = clamp(parseInt(rgb[3], 10));
    return rgbToHex({ r, g, b });
  }

  const rgba = t.match(
    /^rgba\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9.]+)\s*\)$/,
  );
  if (rgba) {
    const r = clamp(parseInt(rgba[1], 10));
    const g = clamp(parseInt(rgba[2], 10));
    const b = clamp(parseInt(rgba[3], 10));
    return rgbToHex({ r, g, b });
  }

  const named = NAMED_COLORS[t];
  if (named) return named;

  return null;
}

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  gray: "#808080",
  grey: "#808080",
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  orange: "#ffa500",
  purple: "#800080",
  pink: "#ffc0cb",
  brown: "#a52a2a",
};

function normalizeHex(hex: string): string {
  let h = (hex ?? "").trim();
  if (!h) return "#000000";
  if (!h.startsWith("#")) h = "#" + h;
  h = h.toLowerCase();
  if (h.length === 4) {
    const r = h[1],
      g = h[2],
      b = h[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (h.length === 7) return h.toLowerCase();
  return h.toLowerCase();
}

function isHex(v: string): boolean {
  const s = (v ?? "").trim().toLowerCase();
  if (s.startsWith("#")) return /^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(s);
  return /^([0-9a-f]{3}|[0-9a-f]{6})$/.test(s);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex).slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const r = clamp(rgb.r).toString(16).padStart(2, "0");
  const g = clamp(rgb.g).toString(16).padStart(2, "0");
  const b = clamp(rgb.b).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`.toLowerCase();
}

function blendRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, n));
}

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ========================
   Header/Footer
======================== */
function SiteHeader() {
  return (
    <div className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 h-12 flex items-center justify-between">
        <a href="/" className="font-extrabold tracking-tight text-slate-900">
          i<span className="text-sky-600">🩵</span>SVG
        </a>

        <nav aria-label="Primary">
          <ul className="flex items-center gap-4 text-[14px] font-semibold">
            <li>
              <a
                href="/#other-tools"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                All Tools
              </a>
            </li>
            <li>
              <a
                href="/svg-recolor"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Recolor
              </a>
            </li>
            <li>
              <a
                href="/svg-resize-and-scale-editor"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Resize/Scale
              </a>
            </li>
            <li>
              <a
                href="/svg-to-png-converter"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                SVG to PNG
              </a>
            </li>
            <li>
              <a
                href="/svg-to-jpg-converter"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                SVG to JPG
              </a>
            </li>
            <li>
              <a
                href="/svg-to-webp-converter"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                SVG to WEBP
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            <span>© {new Date().getFullYear()} i🩵SVG</span>
            <span className="mx-2 text-slate-300">•</span>
            <span className="text-slate-500">
              Simple SVG tools, no accounts.
            </span>
          </div>

          <nav aria-label="Footer" className="text-sm">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-600">
              <li>
                <Link
                  to="/"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Home
                </Link>
              </li>

              <li className="text-slate-300" aria-hidden>
                |
              </li>

              <li>
                <Link
                  to="/privacy-policy"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms-of-service"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Terms
                </Link>
              </li>
              <li>
                <Link
                  to="/cookies"
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Cookies
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
