import * as React from "react";
import type { Route } from "./+types/inline-svg-vs-img";
import { CurrentRouteGuide, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";
import { ThrottledColorInput as SharedThrottledColorInput } from "~/client/components/ui/ThrottledColorInput";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    `Inline SVG vs IMG Tag - Compare Embed Options | iLoveSVG`;
  const description =
    `Compare inline SVG and img tag usage in your browser. Preview styling, accessibility, caching tradeoffs, currentColor behavior, and copy ready-to-use embed snippets.`;
  const canonical = "https://www.ilovesvg.com/inline-svg-vs-img";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },

    { tagName: "link", rel: "canonical", href: canonical },

    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
  ];
}

/* ========================
   Types
======================== */
type SizeUnit = "px" | "pt" | "em" | "rem" | "%" | "vh" | "vw";
type QuoteMode = "double" | "single";

type Settings = {
  width: number;
  height: number;
  unit: SizeUnit;
  responsiveMode: "fixed" | "responsive";
  fitMode: "contain" | "cover" | "none";

  // Accessibility
  altText: string;
  titleText: string;
  decorative: boolean; // aria-hidden for inline, empty alt for img
  roleImgInline: boolean;
  focusableFalse: boolean;

  // Safety / cleanup
  sanitize: boolean;
  stripScripts: boolean;
  stripEventHandlers: boolean;
  stripForeignObject: boolean;
  stripJavascriptHrefs: boolean;
  removeComments: boolean;
  removeMetadata: boolean;

  // Normalization
  ensureXmlns: boolean;
  addViewBoxIfMissing: boolean;
  removeWidthHeightFromSvg: boolean;
  setCurrentColor: boolean;

  // Styling demo
  demoColor: string;
  demoBg: string;
  demoBorder: boolean;
  demoClassName: string;

  // Output formatting
  quoteMode: QuoteMode;
  indent: "2" | "4" | "tab";

  // <img> source options
  imgSrcMode: "file-url" | "data-uri-utf8" | "data-uri-base64" | "blob-url";
  assetUrl: string;
  includeUtf8Charset: boolean;

  // Copy helpers
  wrapInHtmlDoc: boolean;
};

type SvgInfo = {
  bytes: number;
  widthRaw?: string;
  heightRaw?: string;
  viewBox?: string;
  hasScripts?: boolean;
  hasForeignObject?: boolean;
  hasEvents?: boolean;
  hasComments?: boolean;
  hasMetadata?: boolean;
};

type SvgEmbedPreset = {
  key: string;
  label: string;
  description: string;
  outputFocus: string;
  settings: Partial<Settings>;
};

const SVG_EMBED_PRESETS: SvgEmbedPreset[] = [
  {
    key: "balanced",
    label: "Balanced comparison",
    description:
      "Standard accessible output with fixed sizing, cleanup, and a cache-friendly file URL for the img snippet.",
    outputFocus: "Compare both methods without bias.",
    settings: {
      width: 128,
      height: 128,
      unit: "px",
      responsiveMode: "fixed",
      fitMode: "contain",
      altText: "Icon",
      titleText: "",
      decorative: false,
      roleImgInline: true,
      focusableFalse: true,
      sanitize: true,
      stripScripts: true,
      stripEventHandlers: true,
      stripForeignObject: false,
      stripJavascriptHrefs: true,
      removeComments: true,
      removeMetadata: true,
      ensureXmlns: true,
      addViewBoxIfMissing: true,
      removeWidthHeightFromSvg: false,
      setCurrentColor: false,
      demoColor: "#0b2dff",
      demoBg: "#ffffff",
      demoBorder: true,
      demoClassName: "icon",
      quoteMode: "double",
      indent: "2",
      imgSrcMode: "file-url",
      assetUrl: "/icons/icon.svg",
      includeUtf8Charset: true,
      wrapInHtmlDoc: false,
    },
  },
  {
    key: "themeable-inline",
    label: "Themeable inline icon",
    description:
      "Use currentColor, responsive inline SVG, role=img, and a component-style class for icons that need CSS theming.",
    outputFocus: "Best when the inline SVG snippet is the intended output.",
    settings: {
      responsiveMode: "responsive",
      fitMode: "contain",
      altText: "Themeable icon",
      titleText: "Themeable icon",
      decorative: false,
      roleImgInline: true,
      focusableFalse: true,
      sanitize: true,
      stripScripts: true,
      stripEventHandlers: true,
      stripForeignObject: true,
      stripJavascriptHrefs: true,
      removeComments: true,
      removeMetadata: true,
      ensureXmlns: true,
      addViewBoxIfMissing: true,
      removeWidthHeightFromSvg: true,
      setCurrentColor: true,
      demoColor: "#0b2dff",
      demoBg: "#ffffff",
      demoBorder: true,
      demoClassName: "icon icon--themeable",
      quoteMode: "double",
      indent: "2",
      imgSrcMode: "file-url",
      assetUrl: "/icons/themeable-icon.svg",
      includeUtf8Charset: true,
      wrapInHtmlDoc: false,
    },
  },
  {
    key: "cached-img",
    label: "Cached img asset",
    description:
      "Keep the SVG as a reusable file URL with explicit dimensions and minimal DOM for repeated logos or illustrations.",
    outputFocus: "Best when the img snippet is the intended output.",
    settings: {
      width: 256,
      height: 256,
      unit: "px",
      responsiveMode: "fixed",
      fitMode: "contain",
      altText: "SVG image",
      titleText: "",
      decorative: false,
      roleImgInline: false,
      focusableFalse: true,
      sanitize: true,
      stripScripts: true,
      stripEventHandlers: true,
      stripForeignObject: false,
      stripJavascriptHrefs: true,
      removeComments: true,
      removeMetadata: true,
      ensureXmlns: true,
      addViewBoxIfMissing: true,
      removeWidthHeightFromSvg: false,
      setCurrentColor: false,
      demoColor: "#111827",
      demoBg: "#ffffff",
      demoBorder: true,
      demoClassName: "svg-asset",
      quoteMode: "double",
      indent: "2",
      imgSrcMode: "file-url",
      assetUrl: "/assets/graphic.svg",
      includeUtf8Charset: true,
      wrapInHtmlDoc: false,
    },
  },
  {
    key: "decorative",
    label: "Decorative UI icon",
    description:
      "Mark the SVG as decorative, remove labels/titles, and keep the output compact for non-content icons.",
    outputFocus: "Best for purely visual icons that screen readers should skip.",
    settings: {
      width: 24,
      height: 24,
      unit: "px",
      responsiveMode: "fixed",
      fitMode: "contain",
      altText: "",
      titleText: "",
      decorative: true,
      roleImgInline: false,
      focusableFalse: true,
      sanitize: true,
      stripScripts: true,
      stripEventHandlers: true,
      stripForeignObject: true,
      stripJavascriptHrefs: true,
      removeComments: true,
      removeMetadata: true,
      ensureXmlns: true,
      addViewBoxIfMissing: true,
      removeWidthHeightFromSvg: true,
      setCurrentColor: true,
      demoColor: "#334155",
      demoBg: "#ffffff",
      demoBorder: false,
      demoClassName: "ui-icon",
      quoteMode: "double",
      indent: "2",
      imgSrcMode: "file-url",
      assetUrl: "/icons/decorative.svg",
      includeUtf8Charset: true,
      wrapInHtmlDoc: false,
    },
  },
  {
    key: "responsive-logo",
    label: "Responsive logo",
    description:
      "Generate responsive snippets for logos or marks that need to scale inside flexible layouts.",
    outputFocus: "Best for layout testing and responsive embed code.",
    settings: {
      width: 320,
      height: 120,
      unit: "px",
      responsiveMode: "responsive",
      fitMode: "contain",
      altText: "Company logo",
      titleText: "Company logo",
      decorative: false,
      roleImgInline: true,
      focusableFalse: true,
      sanitize: true,
      stripScripts: true,
      stripEventHandlers: true,
      stripForeignObject: false,
      stripJavascriptHrefs: true,
      removeComments: true,
      removeMetadata: true,
      ensureXmlns: true,
      addViewBoxIfMissing: true,
      removeWidthHeightFromSvg: true,
      setCurrentColor: false,
      demoColor: "#0f172a",
      demoBg: "#f8fafc",
      demoBorder: true,
      demoClassName: "brand-logo",
      quoteMode: "double",
      indent: "2",
      imgSrcMode: "file-url",
      assetUrl: "/logos/company-logo.svg",
      includeUtf8Charset: true,
      wrapInHtmlDoc: false,
    },
  },
  {
    key: "single-file",
    label: "Single-file HTML",
    description:
      "Wrap the output in a full HTML document and use a UTF-8 Data URI for portable demos or handoff files.",
    outputFocus: "Best when you need a self-contained snippet to paste into a test file.",
    settings: {
      width: 160,
      height: 160,
      unit: "px",
      responsiveMode: "fixed",
      fitMode: "contain",
      altText: "Embedded SVG",
      titleText: "Embedded SVG",
      decorative: false,
      roleImgInline: true,
      focusableFalse: true,
      sanitize: true,
      stripScripts: true,
      stripEventHandlers: true,
      stripForeignObject: true,
      stripJavascriptHrefs: true,
      removeComments: true,
      removeMetadata: true,
      ensureXmlns: true,
      addViewBoxIfMissing: true,
      removeWidthHeightFromSvg: false,
      setCurrentColor: false,
      demoColor: "#0b2dff",
      demoBg: "#ffffff",
      demoBorder: true,
      demoClassName: "embedded-svg",
      quoteMode: "double",
      indent: "2",
      imgSrcMode: "data-uri-utf8",
      assetUrl: "/icons/icon.svg",
      includeUtf8Charset: true,
      wrapInHtmlDoc: true,
    },
  },
];

const DEFAULTS: Settings = {
  width: 128,
  height: 128,
  unit: "px",
  responsiveMode: "fixed",
  fitMode: "contain",

  altText: "Icon",
  titleText: "",
  decorative: false,
  roleImgInline: true,
  focusableFalse: true,

  sanitize: true,
  stripScripts: true,
  stripEventHandlers: true,
  stripForeignObject: false,
  stripJavascriptHrefs: true,
  removeComments: true,
  removeMetadata: true,

  ensureXmlns: true,
  addViewBoxIfMissing: true,
  removeWidthHeightFromSvg: false,
  setCurrentColor: false,

  demoColor: "#0b2dff",
  demoBg: "#ffffff",
  demoBorder: true,
  demoClassName: "icon",

  quoteMode: "double",
  indent: "2",

  imgSrcMode: "file-url",
  assetUrl: "/icons/icon.svg",
  includeUtf8Charset: true,

  wrapInHtmlDoc: false,
};

/* ========================
   Page
======================== */
export default function InlineSvgVsImg(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePresetKey, setActivePresetKey] = React.useState<string>(
    "balanced",
  );

  const [file, setFile] = React.useState<File | null>(null);
  const [svgText, setSvgText] = React.useState<string>("");
  const [preparedSvg, setPreparedSvg] = React.useState<string>("");
  const [info, setInfo] = React.useState<SvgInfo | null>(null);

  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);

  const [inlineCode, setInlineCode] = React.useState<string>("");
  const [imgCode, setImgCode] = React.useState<string>("");

  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const lastAutoSizeKeyRef = React.useRef<string>("");

  React.useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  function applyPreset(preset: SvgEmbedPreset) {
    const nextSettings: Settings = {
      ...settings,
      ...preset.settings,
    };

    setActivePresetKey(preset.key);
    setSettings(nextSettings);
    showToast(`${preset.label} preset applied`);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    await handleNewFile(f);
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    await handleNewFile(f);
  }

  async function onPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (
          f &&
          (f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg"))
        ) {
          e.preventDefault();
          await handleNewFile(f);
          return;
        }
      }
    }
  }

  function maybeAutoSetSizeFromSvgText(rawSvg: string) {
    const key = autoSizeKey(rawSvg);
    if (!key) return;
    if (lastAutoSizeKeyRef.current === key) return;

    const inferred = inferSvgDimensions(rawSvg);
    if (!inferred) {
      lastAutoSizeKeyRef.current = key;
      return;
    }

    lastAutoSizeKeyRef.current = key;

    setSettings((s) => ({
      ...s,
      width: clampInt(inferred.width, 1, 100000),
      height: clampInt(inferred.height, 1, 100000),
      unit: inferred.unit,
    }));
  }

  async function handleNewFile(f: File) {
    setErr(null);
    if (
      !(f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg"))
    ) {
      setErr("Please choose an SVG file.");
      return;
    }

    const text = await f.text();
    setFile(f);
    setSvgText(text);

    maybeAutoSetSizeFromSvgText(text);

    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const url = URL.createObjectURL(
      new Blob([text], { type: "image/svg+xml" }),
    );
    setBlobUrl(url);
  }

  function clearAll() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setFile(null);
    setSvgText("");
    setPreparedSvg("");
    setInfo(null);
    setBlobUrl(null);
    setInlineCode("");
    setImgCode("");
    setErr(null);
    lastAutoSizeKeyRef.current = "";
    setActivePresetKey("balanced");
    setSettings(DEFAULTS);
  }

  function loadExample() {
    const example = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path fill="#0b2dff" d="M64 10c29.8 0 54 24.2 54 54s-24.2 54-54 54S10 93.8 10 64 34.2 10 64 10Zm0 18a36 36 0 1 0 0 72 36 36 0 0 0 0-72Z"/><path fill="#0b2dff" d="M60 36h8v36h-8z"/><path fill="#0b2dff" d="M36 60h56v8H36z"/></svg>`;
    setErr(null);
    setFile(null);
    setSvgText(example);

    maybeAutoSetSizeFromSvgText(example);

    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const url = URL.createObjectURL(
      new Blob([example], { type: "image/svg+xml" }),
    );
    setBlobUrl(url);

    showToast("Example loaded");
  }

  React.useEffect(() => {
    if (!svgText.trim()) {
      setPreparedSvg("");
      setInfo(null);
      setInlineCode("");
      setImgCode("");
      setErr(null);
      return;
    }

    // If user pasted raw SVG into textarea (not via file/example), set size once for that new SVG.
    if (!file) {
      maybeAutoSetSizeFromSvgText(svgText);
    }

    try {
      setErr(null);

      const normalized = normalizeSvg(svgText, settings);
      setPreparedSvg(normalized);
      setInfo(parseSvgInfo(normalized));

      const inline = generateInlineSnippet(normalized, settings);
      const img = generateImgSnippet(normalized, blobUrl, settings);

      setInlineCode(settings.wrapInHtmlDoc ? wrapInDoc(inline) : inline);
      setImgCode(settings.wrapInHtmlDoc ? wrapInDoc(img) : img);
    } catch (e: any) {
      setErr(e?.message || "Failed to process SVG.");
      setPreparedSvg("");
      setInfo(null);
      setInlineCode("");
      setImgCode("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgText, settings, blobUrl]);

  function copyText(t: string) {
    if (!t || !hydrated) return;
    navigator.clipboard
      .writeText(t)
      .then(() => showToast("Copied"))
      .catch(() => setErr("Clipboard copy failed (browser blocked it)."));
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Inline SVG vs <img>", href: "/inline-svg-vs-img" },
  ];

  const activePreset = React.useMemo(
    () =>
      SVG_EMBED_PRESETS.find((preset) => preset.key === activePresetKey) ||
      SVG_EMBED_PRESETS[0],
    [activePresetKey],
  );

  const inlinePreview = React.useMemo(() => {
    if (!preparedSvg) return "";
    return applyInlinePreviewAttrs(preparedSvg, settings);
  }, [preparedSvg, settings]);

  const imgPreviewSrc = React.useMemo(() => {
    if (!preparedSvg) return "";
    if (settings.imgSrcMode === "file-url")
      return settings.assetUrl || "/icons/icon.svg";
    if (settings.imgSrcMode === "blob-url") return blobUrl || "";
    if (settings.imgSrcMode === "data-uri-base64")
      return toDataUriBase64(preparedSvg);
    return toDataUriUtf8(preparedSvg, settings.includeUtf8Charset);
  }, [
    preparedSvg,
    settings.imgSrcMode,
    settings.assetUrl,
    settings.includeUtf8Charset,
    blobUrl,
  ]);

  // Always-visible payload stats (not hidden in advanced)
  const payloadStats = React.useMemo(() => {
    if (!preparedSvg) {
      return {
        preparedBytes: 0,
        inlineBytes: 0,
        imgBytes: 0,
        dataUtf8Bytes: 0,
        dataB64Bytes: 0,
        dataUtf8Len: 0,
        dataB64Len: 0,
      };
    }

    const preparedBytes = new Blob([preparedSvg]).size;
    const inlineBytes = inlineCode ? utf8ByteLength(inlineCode) : 0;
    const imgBytes = imgCode ? utf8ByteLength(imgCode) : 0;

    const dataUtf8 = toDataUriUtf8(preparedSvg, settings.includeUtf8Charset);
    const dataB64 = toDataUriBase64(preparedSvg);

    const dataUtf8Bytes = utf8ByteLength(dataUtf8);
    const dataB64Bytes = utf8ByteLength(dataB64);

    return {
      preparedBytes,
      inlineBytes,
      imgBytes,
      dataUtf8Bytes,
      dataB64Bytes,
      dataUtf8Len: dataUtf8.length,
      dataB64Len: dataB64.length,
    };
  }, [preparedSvg, inlineCode, imgCode, settings.includeUtf8Charset]);

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  return (
    <>
      <main className="bg-slate-50 text-[#0f2537]" onPaste={onPaste}>
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

          <header className="text-center mb-4">
            <h1 className="inline-flex items-center gap-2 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none m-0">
              <span className="text-[#0b2dff]">Inline SVG</span>
              <span className="text-slate-400">vs</span>
              <span>{"<img>"}</span>
            </h1>
            <p className="mt-2 text-slate-600">
              Paste an SVG and compare both embed methods side by side. Generate
              code that matches what you actually need.
            </p>
          </header>

          <section className="lg:pt-0 lg:pb-8 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="m-0 font-bold text-lg text-slate-900">
                  Input SVG
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={loadExample}
                    className="flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-sky-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                  >
                    <Icons
                      name="example"
                      size={16}
                      className="inline-block mr-1"
                    />
                    Load example
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 cursor-pointer"
                  >
                    <Icons
                      name="trash"
                      size={16}
                      className="inline-block mr-1"
                    />
                    Clear
                  </button>
                </div>
              </div>

              {!file && !svgText.trim() ? (
                <DragArea onPick={onPick} onDrop={onDrop} />
              ) : (
                <>
                  {file ? (
                    <div className="mt-3 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#f7faff] border border-[#dae6ff] text-slate-900">
                      <div className="flex items-center min-w-0 gap-2">
                        <span className="truncate" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={clearAll}
                        className="px-2 py-1 rounded-md border border-[#d6e4ff] bg-[#eff4ff] cursor-pointer hover:bg-[#e5eeff]"
                        aria-label="Clear"
                      >
                        ×
                      </button>
                    </div>
                  ) : null}

                  <details
                    className="mt-3 rounded-2xl border border-slate-200 bg-white"
                    open
                  >
                    <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                      Edit SVG source (optional)
                    </summary>
                    <div className="px-4 pb-4">
                      <p className="text-[13px] text-slate-600 mt-2">
                        Paste raw SVG markup here. Changes apply instantly.
                      </p>
                      <textarea
                        value={svgText}
                        onChange={(e) => setSvgText(e.target.value)}
                        className="mt-2 w-full h-[320px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                        spellCheck={false}
                        placeholder="<svg ...>...</svg>"
                      />
                    </div>
                  </details>
                </>
              )}

              {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}

              {info && (
                <div className="mt-3 grid gap-2">
                  <div className="text-[13px] text-slate-700">
                    Detected:{" "}
                    <b>
                      {info.widthRaw || "?"} × {info.heightRaw || "?"}
                    </b>
                    {info.viewBox ? (
                      <span className="text-slate-500">
                        {" "}
                        • viewBox {info.viewBox}
                      </span>
                    ) : null}
                  </div>

                  {/* Preview of actual input image under detected line */}
                  <DetectedInputPreview
                    svg={preparedSvg || svgText}
                    settings={settings}
                  />

                  {(info.hasScripts ||
                    info.hasForeignObject ||
                    info.hasEvents) && (
                    <div className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      This SVG includes potentially risky content (scripts,
                      event handlers, or foreignObject). Keep sanitization
                      enabled if this is untrusted.
                    </div>
                  )}

                  {(info.hasComments || info.hasMetadata) && (
                    <div className="text-[13px] text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      This SVG contains {info.hasComments ? "comments" : ""}
                      {info.hasComments && info.hasMetadata ? " and " : ""}
                      {info.hasMetadata ? "metadata" : ""}. You can remove them
                      in settings.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SETTINGS + ALWAYS VISIBLE STATS */}
            <div className="min-w-0 bg-white rounded-2xl border border-slate-200 min-h-[200px] p-4 shadow-sm">
              {/* Always visible: Size + payload info */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="m-0 font-bold text-lg text-slate-900">
                    Size and payload
                  </h2>
                  {info ? (
                    <span className="text-[13px] text-slate-600">
                      SVG size: <b>{formatBytes(info.bytes)}</b>
                    </span>
                  ) : (
                    <span className="text-[13px] text-slate-600">
                      Upload or paste an SVG
                    </span>
                  )}
                </div>

                <div className="mt-3 grid gap-2 text-[13px] text-slate-700">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="font-semibold text-slate-900">
                      Prepared SVG (after settings)
                    </div>
                    <div className="mt-1">
                      {preparedSvg ? (
                        <b>{formatBytes(payloadStats.preparedBytes)}</b>
                      ) : (
                        "?"
                      )}
                    </div>
                    <div className="mt-1 text-[12px] text-slate-500">
                      This is what the tool uses to generate both snippets.
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="font-semibold text-slate-900">
                        Inline snippet size
                      </div>
                      <div className="mt-1">
                        {inlineCode ? (
                          <b>{formatBytes(payloadStats.inlineBytes)}</b>
                        ) : (
                          "?"
                        )}
                      </div>
                      <div className="mt-1 text-[12px] text-slate-500">
                        Approx UTF-8 bytes of the generated markup.
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="font-semibold text-slate-900">
                        IMG snippet size
                      </div>
                      <div className="mt-1">
                        {imgCode ? (
                          <b>{formatBytes(payloadStats.imgBytes)}</b>
                        ) : (
                          "?"
                        )}
                      </div>
                      <div className="mt-1 text-[12px] text-slate-500">
                        Often small unless you embed a Data URI.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="font-semibold text-slate-900">
                      Data URI payload sizes (if you use Data URI mode)
                    </div>
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      <div>
                        UTF-8 Data URI:{" "}
                        <b>
                          {preparedSvg
                            ? formatBytes(payloadStats.dataUtf8Bytes)
                            : "?"}
                        </b>{" "}
                        <span className="text-slate-500">
                          (
                          {preparedSvg
                            ? `${payloadStats.dataUtf8Len} chars`
                            : "?"}
                          )
                        </span>
                      </div>
                      <div>
                        Base64 Data URI:{" "}
                        <b>
                          {preparedSvg
                            ? formatBytes(payloadStats.dataB64Bytes)
                            : "?"}
                        </b>{" "}
                        <span className="text-slate-500">
                          (
                          {preparedSvg
                            ? `${payloadStats.dataB64Len} chars`
                            : "?"}
                          )
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-[12px] text-slate-500">
                      If you care about caching and bundle size, prefer a file
                      URL when possible.
                    </div>
                  </div>
                </div>
              </div>

              <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="m-0 font-bold text-lg text-sky-700">
                      Use-case presets
                    </h2>
                    <p className="mt-1 text-[13px] text-slate-600">
                      Pick a real output goal. Each preset changes sizing,
                      accessibility, cleanup, source mode, and formatting so the
                      generated snippets are meaningfully different.
                    </p>
                  </div>
                  <span className="text-[12px] px-2 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
                    Active: {activePreset.label}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {SVG_EMBED_PRESETS.map((preset) => {
                    const isActive = preset.key === activePresetKey;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={[
                          "text-left rounded-xl border p-3 cursor-pointer transition-colors",
                          isActive
                            ? "border-sky-500 bg-sky-50 hover:bg-sky-100"
                            : "border-slate-200 bg-white hover:bg-slate-50",
                        ].join(" ")}
                        aria-pressed={isActive}
                      >
                        <span className="block text-[13px] font-bold text-slate-900">
                          {preset.label}
                        </span>
                        <span className="mt-1 block text-[12px] leading-relaxed text-slate-600">
                          {preset.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="mt-3 mb-2 w-full inline-flex items-center justify-between px-3 py-1.5 rounded-md border border-slate-200 bg-sky-50 text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                aria-expanded={showAdvanced}
                aria-controls="advanced-settings"
              >
                <span className="inline-flex items-center justify-center">
                  <Icons name="settings" size={16} className=" mr-1" />
                  Settings
                </span>

                <svg
                  className={[
                    "h-4 w-4 text-slate-500 transition-transform",
                    showAdvanced ? "rotate-180" : "rotate-0",
                  ].join(" ")}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {showAdvanced && (
                <div
                  id="advanced-settings"
                  className="flex flex-col gap-2 min-w-0"
                >
                  <div className="bg-sky-50 border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0 overflow-auto">
                    <h2 className="m-0 font-bold mb-3 text-lg text-slate-900">
                      Comparison Settings
                    </h2>

                    <div className="bg-white border border-slate-200 rounded-2xl p-3 overflow-hidden">
                      <div className="grid gap-2 min-w-0">
                        <Field label="Sizing mode">
                          <select
                            value={settings.responsiveMode}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                responsiveMode: e.target.value as any,
                              }))
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate cursor-pointer transition-colors hover:bg-slate-50"
                          >
                            <option value="fixed">
                              Fixed (width/height attributes)
                            </option>
                            <option value="responsive">
                              Responsive (CSS width:100%)
                            </option>
                          </select>
                        </Field>

                        <Field label="Width">
                          <NumInt
                            value={settings.width}
                            min={1}
                            max={100000}
                            step={1}
                            onChange={(v) =>
                              setSettings((s) => ({
                                ...s,
                                width: clampInt(v, 1, 100000),
                              }))
                            }
                          />
                          <UnitSelect
                            value={settings.unit}
                            onChange={(u) =>
                              setSettings((s) => ({ ...s, unit: u }))
                            }
                          />
                        </Field>

                        <Field label="Height">
                          <NumInt
                            value={settings.height}
                            min={1}
                            max={100000}
                            step={1}
                            onChange={(v) =>
                              setSettings((s) => ({
                                ...s,
                                height: clampInt(v, 1, 100000),
                              }))
                            }
                          />
                          <UnitSelect
                            value={settings.unit}
                            onChange={(u) =>
                              setSettings((s) => ({ ...s, unit: u }))
                            }
                          />
                        </Field>

                        <Field label="Object fit">
                          <select
                            value={settings.fitMode}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                fitMode: e.target.value as any,
                              }))
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate cursor-pointer transition-colors hover:bg-slate-50"
                          >
                            <option value="contain">contain</option>
                            <option value="cover">cover</option>
                            <option value="none">none</option>
                          </select>
                        </Field>

                        <Field label="Accessibility">
                          <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                            <label className="flex items-center gap-2 min-w-0">
                              <span className="text-[12px] text-slate-600 min-w-[70px]">
                                Alt
                              </span>
                              <input
                                value={settings.altText}
                                onChange={(e) =>
                                  setSettings((s) => ({
                                    ...s,
                                    altText: e.target.value,
                                  }))
                                }
                                className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                                placeholder="Icon"
                              />
                            </label>

                            <label className="flex items-center gap-2 min-w-0">
                              <span className="text-[12px] text-slate-600 min-w-[70px]">
                                Title
                              </span>
                              <input
                                value={settings.titleText}
                                onChange={(e) =>
                                  setSettings((s) => ({
                                    ...s,
                                    titleText: e.target.value,
                                  }))
                                }
                                className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                                placeholder="Optional"
                              />
                            </label>

                            <ToggleRow
                              checked={settings.decorative}
                              onChange={(v) =>
                                setSettings((s) => ({ ...s, decorative: v }))
                              }
                              label="Decorative (aria-hidden for inline, empty alt for <img>)"
                            />
                            <ToggleRow
                              checked={settings.roleImgInline}
                              onChange={(v) =>
                                setSettings((s) => ({ ...s, roleImgInline: v }))
                              }
                              label='Inline: role="img"'
                            />
                            <ToggleRow
                              checked={settings.focusableFalse}
                              onChange={(v) =>
                                setSettings((s) => ({
                                  ...s,
                                  focusableFalse: v,
                                }))
                              }
                              label='Inline: focusable="false"'
                            />
                          </div>
                        </Field>

                        <Field label="Safety / cleanup">
                          <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                            <ToggleRow
                              checked={settings.sanitize}
                              onChange={(v) =>
                                setSettings((s) => ({ ...s, sanitize: v }))
                              }
                              label="Sanitize (recommended)"
                            />
                            {settings.sanitize && (
                              <div className="pl-6 flex flex-col gap-2">
                                <ToggleRow
                                  checked={settings.stripScripts}
                                  onChange={(v) =>
                                    setSettings((s) => ({
                                      ...s,
                                      stripScripts: v,
                                    }))
                                  }
                                  label="Strip <script>"
                                />
                                <ToggleRow
                                  checked={settings.stripEventHandlers}
                                  onChange={(v) =>
                                    setSettings((s) => ({
                                      ...s,
                                      stripEventHandlers: v,
                                    }))
                                  }
                                  label="Strip on* handlers"
                                />
                                <ToggleRow
                                  checked={settings.stripJavascriptHrefs}
                                  onChange={(v) =>
                                    setSettings((s) => ({
                                      ...s,
                                      stripJavascriptHrefs: v,
                                    }))
                                  }
                                  label="Strip javascript: hrefs"
                                />
                                <ToggleRow
                                  checked={settings.stripForeignObject}
                                  onChange={(v) =>
                                    setSettings((s) => ({
                                      ...s,
                                      stripForeignObject: v,
                                    }))
                                  }
                                  label="Strip <foreignObject>"
                                />
                              </div>
                            )}
                            <ToggleRow
                              checked={settings.removeComments}
                              onChange={(v) =>
                                setSettings((s) => ({
                                  ...s,
                                  removeComments: v,
                                }))
                              }
                              label="Remove comments"
                            />
                            <ToggleRow
                              checked={settings.removeMetadata}
                              onChange={(v) =>
                                setSettings((s) => ({
                                  ...s,
                                  removeMetadata: v,
                                }))
                              }
                              label="Remove <metadata> blocks"
                            />
                          </div>
                        </Field>

                        <Field label="Normalize">
                          <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                            <ToggleRow
                              checked={settings.ensureXmlns}
                              onChange={(v) =>
                                setSettings((s) => ({ ...s, ensureXmlns: v }))
                              }
                              label="Ensure xmlns on <svg>"
                            />
                            <ToggleRow
                              checked={settings.addViewBoxIfMissing}
                              onChange={(v) =>
                                setSettings((s) => ({
                                  ...s,
                                  addViewBoxIfMissing: v,
                                }))
                              }
                              label="Add viewBox if missing"
                            />
                            <ToggleRow
                              checked={settings.removeWidthHeightFromSvg}
                              onChange={(v) =>
                                setSettings((s) => ({
                                  ...s,
                                  removeWidthHeightFromSvg: v,
                                }))
                              }
                              label="Remove width/height from SVG source"
                            />
                            <ToggleRow
                              checked={settings.setCurrentColor}
                              onChange={(v) =>
                                setSettings((s) => ({
                                  ...s,
                                  setCurrentColor: v,
                                }))
                              }
                              label="Replace fill/stroke with currentColor (best-effort)"
                            />
                          </div>
                        </Field>

                        <Field label="Styling demo">
                          <div className="flex flex-col gap-2 min-w-0 overflow-hidden w-full">
                            <label className="flex items-center gap-2 min-w-0">
                              <span className="text-[12px] text-slate-600 min-w-[90px]">
                                Color
                              </span>
                              <SharedThrottledColorInput
                                value={settings.demoColor}
                                onCommit={(value) =>
                                  setSettings((s) => ({
                                    ...s,
                                    demoColor: value,
                                  }))
                                }
                                className="h-8 w-12 border border-slate-200 rounded-md bg-white cursor-pointer"
                              />
                              <input
                                value={settings.demoColor}
                                onChange={(e) =>
                                  setSettings((s) => ({
                                    ...s,
                                    demoColor: e.target.value,
                                  }))
                                }
                                className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                                placeholder="#0b2dff"
                              />
                            </label>

                            <label className="flex items-center gap-2 min-w-0">
                              <span className="text-[12px] text-slate-600 min-w-[90px]">
                                Background
                              </span>
                              <SharedThrottledColorInput
                                value={settings.demoBg}
                                onCommit={(value) =>
                                  setSettings((s) => ({
                                    ...s,
                                    demoBg: value,
                                  }))
                                }
                                className="h-8 w-12 border border-slate-200 rounded-md bg-white cursor-pointer"
                              />
                              <input
                                value={settings.demoBg}
                                onChange={(e) =>
                                  setSettings((s) => ({
                                    ...s,
                                    demoBg: e.target.value,
                                  }))
                                }
                                className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                                placeholder="#ffffff"
                              />
                            </label>

                            <label className="flex items-center gap-2 min-w-0">
                              <span className="text-[12px] text-slate-600 min-w-[90px]">
                                Class
                              </span>
                              <input
                                value={settings.demoClassName}
                                onChange={(e) =>
                                  setSettings((s) => ({
                                    ...s,
                                    demoClassName: sanitizeClassName(
                                      e.target.value,
                                    ),
                                  }))
                                }
                                className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                                placeholder="icon"
                              />
                            </label>

                            <ToggleRow
                              checked={settings.demoBorder}
                              onChange={(v) =>
                                setSettings((s) => ({ ...s, demoBorder: v }))
                              }
                              label="Show border around preview"
                            />
                          </div>
                        </Field>

                        <Field label="<img> src type">
                          <select
                            value={settings.imgSrcMode}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                imgSrcMode: e.target.value as any,
                              }))
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate cursor-pointer transition-colors hover:bg-slate-50"
                          >
                            <option value="file-url">
                              File URL (best for caching)
                            </option>
                            <option value="blob-url">
                              Blob URL (local preview)
                            </option>
                            <option value="data-uri-utf8">
                              Data URI (UTF-8)
                            </option>
                            <option value="data-uri-base64">
                              Data URI (Base64)
                            </option>
                          </select>
                        </Field>

                        {settings.imgSrcMode === "file-url" && (
                          <Field label="File URL">
                            <input
                              value={settings.assetUrl}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  assetUrl: e.target.value,
                                }))
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                              placeholder="/icons/icon.svg"
                            />
                          </Field>
                        )}

                        {settings.imgSrcMode === "data-uri-utf8" && (
                          <Field label="UTF-8 header">
                            <input
                              type="checkbox"
                              checked={settings.includeUtf8Charset}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  includeUtf8Charset: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
                            />
                            <span className="text-[13px] text-slate-700 min-w-0">
                              Include charset=utf-8
                            </span>
                          </Field>
                        )}

                        <Field label="Format">
                          <select
                            value={settings.indent}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                indent: e.target.value as any,
                              }))
                            }
                            className="min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                          >
                            <option value="2">2 spaces</option>
                            <option value="4">4 spaces</option>
                            <option value="tab">Tabs</option>
                          </select>
                          <select
                            value={settings.quoteMode}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                quoteMode: e.target.value as any,
                              }))
                            }
                            className="min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
                          >
                            <option value="double">"</option>
                            <option value="single">'</option>
                          </select>
                          <TogglePill
                            checked={settings.wrapInHtmlDoc}
                            onChange={(v) =>
                              setSettings((s) => ({ ...s, wrapInHtmlDoc: v }))
                            }
                            label="Wrap in HTML doc"
                          />
                        </Field>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <CompareCard
              title="Inline SVG output"
              badge={activePreset.outputFocus}
              code={inlineCode}
              onCopy={() => copyText(inlineCode)}
              preview={
                inlinePreview ? (
                  <InlinePreview svg={inlinePreview} settings={settings} />
                ) : (
                  <EmptyState />
                )
              }
            />

            <CompareCard
              title="IMG tag output"
              badge={
                settings.imgSrcMode === "file-url"
                  ? "File URL / cacheable"
                  : settings.imgSrcMode === "blob-url"
                    ? "Blob URL / local preview"
                    : settings.imgSrcMode === "data-uri-base64"
                      ? "Base64 Data URI"
                      : "UTF-8 Data URI"
              }
              code={imgCode}
              onCopy={() => copyText(imgCode)}
              preview={
                preparedSvg ? (
                  <ImgPreview
                    src={imgPreviewSrc}
                    settings={settings}
                    alt={settings.decorative ? "" : settings.altText}
                    title={settings.titleText}
                  />
                ) : (
                  <EmptyState />
                )
              }
            />
          </section>

          {/* COMPARISON */}
          <section className="mb-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="m-0 font-bold text-lg text-slate-900">
                Inline SVG vs {"<img>"} comparison
              </h2>
              {info ? (
                <span className="text-[13px] text-slate-600">
                  SVG size: <b>{formatBytes(info.bytes)}</b>
                </span>
              ) : null}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[13px] border-separate border-spacing-0">
                <thead>
                  <tr className="text-left">
                    <th className="sticky left-0 bg-white z-10 border-b border-slate-200 py-2 pr-3 w-[240px]">
                      Topic
                    </th>
                    <th className="border-b border-slate-200 py-2 px-3 w-[45%]">
                      Inline SVG
                    </th>
                    <th className="border-b border-slate-200 py-2 pl-3 w-[45%]">
                      {"<img>"} with SVG
                    </th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <Row
                    topic="CSS styling (fill, stroke)"
                    inline="Best. Can target internal shapes, use currentColor, hover states, animations, and CSS variables."
                    img="Limited. You can size the element and apply filters, but you cannot style paths inside the SVG."
                  />
                  <Row
                    topic="Accessibility"
                    inline="Excellent when done right. Use role, aria-label or <title>, or aria-hidden for decorative icons."
                    img="Straightforward. Use alt text. Decorative icons should use empty alt."
                  />
                  <Row
                    topic="Caching"
                    inline="No caching per icon instance. Repeated inline markup increases HTML size."
                    img="Best. Browser caches the SVG file URL across pages. Good for repeated icons."
                  />
                  <Row
                    topic="Security / sanitization"
                    inline="Higher risk if you inline untrusted SVG. You must sanitize scripts, handlers, and foreignObject."
                    img="Still can be risky depending on context, but you are not injecting markup into DOM as HTML. Prefer file URL with proper headers and CSP."
                  />
                  <Row
                    topic="Performance"
                    inline="Good for small icons and when you need styling. Can bloat HTML for large SVGs."
                    img="Good for large SVGs reused many times. Keeps HTML smaller."
                  />
                  <Row
                    topic="Interactivity"
                    inline="Best. You can attach events, animate, and manipulate with JS."
                    img="Not possible inside the SVG. Only events on the <img> element itself."
                  />
                  <Row
                    topic="CSP compatibility"
                    inline="Inline markup may be fine, but inline scripts are blocked. Sanitization recommended."
                    img="Usually easier. File URL is clean. Data URIs may be blocked by CSP in some setups."
                  />
                  <Row
                    topic="SEO"
                    inline="Inline can be indexed as markup, but icons are usually not SEO content."
                    img="Alt text can help for meaningful images. For icons, usually decorative."
                  />
                </tbody>
              </table>
            </div>

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
            <div className="mt-4 lg:pt-0 lg:pb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <h3 className="m-0 font-bold text-slate-900">
                  Pick Inline SVG when
                </h3>
                <ul className="mt-3 list-disc pl-5 text-[13px] text-slate-700 grid gap-1">
                  <li>
                    You need CSS styling of paths (currentColor icons, hover
                    effects).
                  </li>
                  <li>You need animations or per-shape manipulation.</li>
                  <li>
                    You are building a component library or design system.
                  </li>
                  <li>
                    You want maximum accessibility control for meaningful icons.
                  </li>
                </ul>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <h3 className="m-0 font-bold text-slate-900">
                  Pick {"<img>"} when
                </h3>
                <ul className="mt-3 list-disc pl-5 text-[13px] text-slate-700 grid gap-1">
                  <li>
                    You want simple embedding and strong caching across pages.
                  </li>
                  <li>The SVG is large and reused many times.</li>
                  <li>You do not need to style internal shapes.</li>
                  <li>
                    You prefer file URLs over inline markup for maintainability.
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        {toast && (
          <div className="fixed right-4 bottom-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[1000]">
            {toast}
          </div>
        )}
      </main>

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

      <SeoSections />
      <CurrentRouteGuide />
      <FaqSection />
      <JsonLdFaq />
      <Breadcrumbs crumbs={crumbs} />
      <JsonLdBreadcrumbs />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ========================
   Compare Cards
======================== */
function CompareCard({
  title,
  badge,
  code,
  onCopy,
  preview,
}: {
  title: string;
  badge: string;
  code: string;
  onCopy: () => void;
  preview: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-w-0">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="m-0 font-bold text-slate-900">{title}</h2>
          <span className="text-[12px] px-2 py-1 rounded-full bg-[#eff4ff] border border-[#d6e4ff] text-slate-700">
            {badge}
          </span>
        </div>

        <button
          type="button"
          onClick={onCopy}
          disabled={!code}
          className={[
            "flex items-center justify-center px-3 py-2 rounded-xl font-bold border transition-colors cursor-pointer",
            "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
            "disabled:opacity-70 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          <Icons name="copy" size={16} className="inline-block mr-1" />
          Copy snippet
        </button>
      </div>

      <div className="p-4 lg:pt-0 lg:pb-8 grid grid-cols-1 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
            Preview
          </div>
          <div className="p-3">{preview}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
            Generated code
          </div>
          <div className="p-3">
            <textarea
              value={code}
              readOnly
              className="w-full h-[220px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-slate-600 text-sm">
      Upload or paste an SVG to see previews and snippets.
    </div>
  );
}

function InlinePreview({ svg, settings }: { svg: string; settings: Settings }) {
  const sizeStyle = previewSizeStyle(settings);
  const borderStyle = settings.demoBorder
    ? "1px solid rgb(226 232 240)"
    : "none";

  const style = {
    ...sizeStyle,
    background: settings.demoBg,
    color: settings.demoColor,
    border: borderStyle,
    borderRadius: "16px",
    padding: "12px",
    overflow: "hidden",
  } as React.CSSProperties;

  return (
    <div style={style} className="min-w-0">
      <div
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

function ImgPreview({
  src,
  settings,
  alt,
  title,
}: {
  src: string;
  settings: Settings;
  alt: string;
  title: string;
}) {
  const sizeStyle = previewSizeStyle(settings);
  const borderStyle = settings.demoBorder
    ? "1px solid rgb(226 232 240)"
    : "none";

  const wrapStyle = {
    ...sizeStyle,
    background: settings.demoBg,
    border: borderStyle,
    borderRadius: "16px",
    padding: "12px",
    overflow: "hidden",
  } as React.CSSProperties;

  const imgStyle = {
    display: "block",
    width: settings.responsiveMode === "responsive" ? "100%" : undefined,
    height: settings.responsiveMode === "responsive" ? "auto" : undefined,
    objectFit: settings.fitMode === "none" ? undefined : settings.fitMode,
    maxWidth: "100%",
  } as React.CSSProperties;

  return (
    <div style={wrapStyle} className="min-w-0">
      {src ? (
        <img src={src} alt={alt} title={title || undefined} style={imgStyle} />
      ) : (
        <div className="text-slate-600 text-sm">
          Blob URL is not available. Use File URL or Data URI mode, or load an
          SVG.
        </div>
      )}
      {settings.setCurrentColor ? (
        <div className="mt-2 text-[12px] text-slate-600">
          Note: currentColor only affects inline SVG. {"<img>"} cannot inherit
          text color into SVG paths.
        </div>
      ) : null}
    </div>
  );
}

function Row({
  topic,
  inline,
  img,
}: {
  topic: string;
  inline: string;
  img: string;
}) {
  return (
    <tr>
      <td className="sticky left-0 bg-white z-10 border-b border-slate-200 py-3 pr-3 font-semibold text-slate-900 w-[240px]">
        {topic}
      </td>
      <td className="border-b border-slate-200 py-3 px-3 text-slate-700">
        {inline}
      </td>
      <td className="border-b border-slate-200 py-3 pl-3 text-slate-700">
        {img}
      </td>
    </tr>
  );
}

/* ========================
   Detected input preview
======================== */
function DetectedInputPreview({
  svg,
  settings,
}: {
  svg: string;
  settings: Settings;
}) {
  const safe = React.useMemo(() => {
    const s = String(svg || "").trim();
    if (!s) return "";
    let v = s;
    v = stripXmlProlog(v);
    v = ensureSvgHasXmlns(v);
    v = removeInlineTitle(v);
    v = removeAttrOnSvg(v, "class");
    v = removeAttrOnSvg(v, "style");
    v = removeAttrOnSvg(v, "width");
    v = removeAttrOnSvg(v, "height");
    // Ensure it lays out nicely in a fixed preview box
    v = setOrReplaceAttrOnSvg(
      v,
      "style",
      mergeStyleAttr(
        getAttrFromSvg(v, "style"),
        "display:block;max-width:100%;height:auto;",
      ),
    );
    return v;
  }, [svg]);

  if (!safe) return null;

  const wrapStyle = {
    background: "white",
    border: "1px solid rgb(226 232 240)",
    borderRadius: "16px",
    padding: "10px",
    overflow: "hidden",
    maxWidth: "100%",
  } as React.CSSProperties;

  return (
    <div style={wrapStyle}>
      <div className="text-[12px] text-slate-500 mb-2">Input preview</div>
      <div
        style={{
          width: "100%",
          maxWidth: "360px",
          margin: "0",
        }}
      >
        <div
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: safe }}
        />
      </div>
      {settings.setCurrentColor ? (
        <div className="mt-2 text-[12px] text-slate-600">
          currentColor preview may differ if the SVG had fixed fills/strokes and
          you enabled replacement.
        </div>
      ) : null}
    </div>
  );
}

/* ========================
   Snippet generation
======================== */
function generateInlineSnippet(svg: string, settings: Settings) {
  const w = `${settings.width}${settings.unit}`;
  const h = `${settings.height}${settings.unit}`;

  let s = svg;

  // Inline accessibility
  if (settings.decorative) {
    s = setOrReplaceAttrOnSvg(s, "aria-hidden", "true");
    s = removeAttrOnSvg(s, "aria-label");
    s = removeInlineTitle(s);
  } else {
    s = removeAttrOnSvg(s, "aria-hidden");
    const label = (settings.altText || "").trim();
    if (label) s = setOrReplaceAttrOnSvg(s, "aria-label", label);
    else s = removeAttrOnSvg(s, "aria-label");

    const title = (settings.titleText || "").trim();
    if (title) s = ensureInlineTitle(s, title);
    else s = removeInlineTitle(s);
  }

  if (settings.roleImgInline && !settings.decorative)
    s = setOrReplaceAttrOnSvg(s, "role", "img");
  else s = removeAttrOnSvg(s, "role");

  if (settings.focusableFalse)
    s = setOrReplaceAttrOnSvg(s, "focusable", "false");
  else s = removeAttrOnSvg(s, "focusable");

  // Sizing
  if (settings.responsiveMode === "responsive") {
    s = removeAttrOnSvg(s, "width");
    s = removeAttrOnSvg(s, "height");
    s = setOrReplaceAttrOnSvg(
      s,
      "style",
      mergeStyleAttr(
        getAttrFromSvg(s, "style"),
        "width:100%;height:auto;display:block;",
      ),
    );
  } else {
    s = setOrReplaceAttrOnSvg(s, "width", w);
    s = setOrReplaceAttrOnSvg(s, "height", h);
  }

  // Demo className for people who want to style it
  const cls = (settings.demoClassName || "").trim();
  if (cls) s = setOrReplaceAttrOnSvg(s, "class", cls);
  else s = removeAttrOnSvg(s, "class");

  // Ensure no XML/doctype junk
  s = stripXmlProlog(s);

  // Optionally pretty format (best effort)
  const indentStr =
    settings.indent === "tab" ? "\t" : " ".repeat(Number(settings.indent));
  s = prettyXmlLike(s, indentStr);

  // Quote mode
  if (settings.quoteMode === "single") s = swapQuotesToSingle(s);

  return s.trim();
}

function generateImgSnippet(
  svg: string,
  blobUrl: string | null,
  settings: Settings,
) {
  const q = settings.quoteMode === "single" ? "'" : '"';
  const w = `${settings.width}${settings.unit}`;
  const h = `${settings.height}${settings.unit}`;

  let src = "";
  if (settings.imgSrcMode === "file-url")
    src = settings.assetUrl || "/icons/icon.svg";
  else if (settings.imgSrcMode === "blob-url") src = blobUrl || "";
  else if (settings.imgSrcMode === "data-uri-base64")
    src = toDataUriBase64(svg);
  else src = toDataUriUtf8(svg, settings.includeUtf8Charset);

  const alt = settings.decorative ? "" : settings.altText || "";
  const title = (settings.titleText || "").trim();

  const attrs: string[] = [];
  attrs.push(`src=${q}${escapeAttr(src)}${q}`);
  attrs.push(`alt=${q}${escapeAttr(alt)}${q}`);
  if (title) attrs.push(`title=${q}${escapeAttr(title)}${q}`);

  if (settings.responsiveMode === "responsive") {
    const style = `display:block;width:100%;height:auto;object-fit:${settings.fitMode === "none" ? "initial" : settings.fitMode};`;
    attrs.push(`style=${q}${escapeAttr(style)}${q}`);
  } else {
    attrs.push(`width=${q}${escapeAttr(w)}${q}`);
    attrs.push(`height=${q}${escapeAttr(h)}${q}`);
    if (settings.fitMode !== "none") {
      attrs.push(
        `style=${q}${escapeAttr(`object-fit:${settings.fitMode};`)}${q}`,
      );
    }
  }

  return `<img ${attrs.filter(Boolean).join(" ")} />`;
}

function applyInlinePreviewAttrs(svg: string, settings: Settings) {
  let s = svg;

  s = stripXmlProlog(s);
  s = ensureSvgHasXmlns(s);

  if (settings.focusableFalse)
    s = setOrReplaceAttrOnSvg(s, "focusable", "false");

  const cls = (settings.demoClassName || "").trim();
  if (cls) s = setOrReplaceAttrOnSvg(s, "class", cls);

  if (settings.responsiveMode === "responsive") {
    s = removeAttrOnSvg(s, "width");
    s = removeAttrOnSvg(s, "height");
    s = setOrReplaceAttrOnSvg(
      s,
      "style",
      mergeStyleAttr(
        getAttrFromSvg(s, "style"),
        "max-width:100%;height:auto;display:block;",
      ),
    );
  }

  return s;
}

function previewSizeStyle(settings: Settings) {
  const w = `${settings.width}${settings.unit}`;
  const h = `${settings.height}${settings.unit}`;

  if (settings.responsiveMode === "responsive") {
    return { width: "100%" } as React.CSSProperties;
  }

  const style: React.CSSProperties = {};
  style.width = w;
  style.height = h;
  return style;
}

function wrapInDoc(snippet: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SVG Embed</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 24px; }
</style>
</head>
<body>
${snippet}
</body>
</html>`;
}

/* ========================
   SVG normalization / sanitization
======================== */
function normalizeSvg(svgText: string, settings: Settings) {
  let svg = String(svgText || "").trim();
  if (!svg) throw new Error("Paste an SVG first.");

  svg = coerceToSvgMarkup(svg);

  if (!/<svg\b/i.test(svg))
    throw new Error("Could not find an <svg> root tag.");

  if (settings.removeComments) {
    svg = svg.replace(/<!--[\s\S]*?-->/g, "");
  }

  if (settings.removeMetadata) {
    svg = svg.replace(/<metadata\b[\s\S]*?<\/metadata\s*>/gi, "");
  }

  if (settings.sanitize) {
    if (settings.stripScripts) {
      svg = svg
        .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
        .replace(/<script\b[^>]*\/\s*>/gi, "");
    }

    if (settings.stripForeignObject) {
      svg = svg.replace(
        /<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi,
        "",
      );
    }

    if (settings.stripEventHandlers) {
      // Remove on* handlers in any case, quoted or unquoted
      svg = svg.replace(
        /\s(on[a-zA-Z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/g,
        "",
      );
    }

    if (settings.stripJavascriptHrefs) {
      // Remove href/xlink:href that resolve to javascript:
      svg = svg.replace(
        /\s(?:href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
        (m0, a, b, c) => {
          const raw = String(a ?? b ?? c ?? "")
            .trim()
            .replace(/^['"]|['"]$/g, "");

          const normalized = raw.toLowerCase().replace(/\s+/g, "");

          const decodedOnce = safeDecodeURIComponent(normalized);

          if (
            normalized.startsWith("javascript:") ||
            decodedOnce.startsWith("javascript:")
          ) {
            return "";
          }

          return m0;
        },
      );
    }
  }

  if (settings.ensureXmlns) svg = ensureSvgHasXmlns(svg);

  if (settings.removeWidthHeightFromSvg) {
    svg = removeAttrOnSvg(svg, "width");
    svg = removeAttrOnSvg(svg, "height");
  }

  if (settings.addViewBoxIfMissing) {
    svg = ensureViewBox(svg, settings.width, settings.height);
  }

  if (settings.setCurrentColor) {
    svg = replaceSvgColorsWithCurrentColor(svg);
  }

  return svg.trim();
}

function coerceToSvgMarkup(input: string) {
  let t = String(input || "").trim();

  const imgSrc = t.match(/<img\b[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>/i)?.[1];
  if (imgSrc) t = imgSrc.trim();

  if (/^data:image\/svg\+xml/i.test(t)) {
    return decodeSvgDataUriToSvg(t);
  }

  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }

  const svgMatch = t.match(/<svg\b[\s\S]*<\/svg>/i);
  if (svgMatch) return svgMatch[0];

  return t;
}

function decodeSvgDataUriToSvg(dataUri: string) {
  const m = dataUri.match(/^data:([^,]*),(.*)$/is);
  if (!m) throw new Error("Invalid SVG data URI.");
  const meta = (m[1] || "").trim();
  const payload = (m[2] || "").trim();
  const isBase64 = /;base64/i.test(meta);

  if (isBase64) {
    const b64 = extractBase64(payload);
    return decodeBase64ToString(b64);
  }

  try {
    return decodeURIComponent(payload);
  } catch {
    try {
      return decodeURIComponent(payload.replace(/\s+/g, ""));
    } catch {
      throw new Error("Could not decode UTF-8 SVG data URI.");
    }
  }
}

function extractBase64(s: string) {
  let t = String(s || "").trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  t = t.replace(/\s+/g, "");

  if (/[-_]/.test(t) && !/[+/]/.test(t)) {
    t = t.replace(/-/g, "+").replace(/_/g, "/");
    const pad = t.length % 4;
    if (pad) t += "=".repeat(4 - pad);
  }

  if (!t) throw new Error("Missing Base64 payload.");
  if (!/^[a-z0-9+/=]+$/i.test(t))
    throw new Error("Input does not look like Base64.");
  return t;
}

function decodeBase64ToString(b64: string) {
  let bin = "";
  try {
    bin = atob(b64);
  } catch {
    throw new Error("Base64 decode failed.");
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff;

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      s += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return s;
  }
}

function toDataUriBase64(svg: string) {
  const clean = stripXmlProlog(svg);
  const bytes = new TextEncoder().encode(clean);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(bin);
  return `data:image/svg+xml;base64,${b64}`;
}

function toDataUriUtf8(svg: string, includeCharset: boolean) {
  const clean = stripXmlProlog(svg);
  const payload = encodeSvgForUtf8DataUri(clean);
  const charset = includeCharset ? ";charset=utf-8" : "";
  return `data:image/svg+xml${charset},${payload}`;
}

function encodeSvgForUtf8DataUri(svg: string) {
  // Keep this conservative. Do not rewrite quotes.
  return encodeURIComponent(svg).replace(/%0A/g, "");
}

function stripXmlProlog(svg: string) {
  let s = String(svg || "");
  s = s.replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, "");
  s = s.replace(/^\s*<!DOCTYPE[\s\S]*?>\s*/i, "");
  return s;
}

function replaceSvgColorsWithCurrentColor(svg: string) {
  let s = svg;

  const replAttr = (_m0: string, attr: string, val: string) => {
    const v = String(val || "").trim();
    if (!v) return _m0;
    if (/^none$/i.test(v)) return _m0;
    if (/^url\(/i.test(v)) return _m0;
    if (/^currentColor$/i.test(v)) return _m0;
    return ` ${attr}="currentColor"`;
  };

  // fill="..." and stroke="..."
  s = s.replace(/\s(fill)\s*=\s*["']([^"']+)["']/gi, replAttr as any);
  s = s.replace(/\s(stroke)\s*=\s*["']([^"']+)["']/gi, replAttr as any);

  // style="...fill:...; stroke:...;"
  s = s.replace(/\sstyle\s*=\s*["']([^"']*)["']/gi, (_m, css) => {
    const orig = String(css || "");
    let next = orig;

    next = next.replace(/(^|;)\s*fill\s*:\s*([^;]+)\s*/gi, (m0, p1, v) => {
      const vv = String(v || "").trim();
      if (
        !vv ||
        /^none$/i.test(vv) ||
        /^url\(/i.test(vv) ||
        /^currentColor$/i.test(vv)
      )
        return m0;
      return `${p1} fill: currentColor `;
    });

    next = next.replace(/(^|;)\s*stroke\s*:\s*([^;]+)\s*/gi, (m0, p1, v) => {
      const vv = String(v || "").trim();
      if (
        !vv ||
        /^none$/i.test(vv) ||
        /^url\(/i.test(vv) ||
        /^currentColor$/i.test(vv)
      )
        return m0;
      return `${p1} stroke: currentColor `;
    });

    return ` style="${escapeAttr(next)}"`;
  });

  return s;
}

function safeDecodeURIComponent(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/* ========================
   SVG parsing
======================== */
function parseSvgInfo(svg: string): SvgInfo {
  const bytes = new Blob([svg]).size;
  const open = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
  const widthRaw = matchAttr(open, "width") || undefined;
  const heightRaw = matchAttr(open, "height") || undefined;
  const viewBox = matchAttr(open, "viewBox") || undefined;

  const hasScripts = /<script\b/i.test(svg);
  const hasForeignObject = /<foreignObject\b/i.test(svg);
  const hasEvents = /\son[a-zA-Z]+\s*=\s*/.test(svg);
  const hasComments = /<!--[\s\S]*?-->/.test(svg);
  const hasMetadata = /<metadata\b/i.test(svg);

  return {
    bytes,
    widthRaw,
    heightRaw,
    viewBox,
    hasScripts,
    hasForeignObject,
    hasEvents,
    hasComments,
    hasMetadata,
  };
}

function matchAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
}

/* ========================
   SVG attribute helpers
======================== */
function ensureSvgHasXmlns(svg: string) {
  const hasSvg = /<svg\b/i.test(svg);
  if (!hasSvg) return `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  const hasXmlns = /<svg\b[^>]*\sxmlns\s*=\s*["'][^"']+["']/i.test(svg);
  if (hasXmlns) return svg;
  return svg.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
}

function ensureViewBox(svg: string, w: number, h: number) {
  const openMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openMatch) return svg;
  const open = openMatch[0];
  const hasVB = /\sviewBox\s*=\s*["'][^"']*["']/i.test(open);
  if (hasVB) return svg;

  const widthRaw = matchAttr(open, "width");
  const heightRaw = matchAttr(open, "height");
  const ww = parseLen(widthRaw || "") ?? w;
  const hh = parseLen(heightRaw || "") ?? h;

  const newOpen = setOrReplaceAttr(
    open,
    "viewBox",
    `0 0 ${Math.max(1, ww)} ${Math.max(1, hh)}`,
  );
  return svg.replace(open, newOpen);
}

function setOrReplaceAttrOnSvg(svg: string, name: string, value: string) {
  const openMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openMatch) return svg;
  const open = openMatch[0];
  const newOpen = setOrReplaceAttr(open, name, value);
  return svg.replace(open, newOpen);
}

function removeAttrOnSvg(svg: string, name: string) {
  const openMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openMatch) return svg;
  const open = openMatch[0];
  const newOpen = removeAttr(open, name);
  return svg.replace(open, newOpen);
}

function getAttrFromSvg(svg: string, name: string) {
  const openMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openMatch) return "";
  return matchAttr(openMatch[0], name) || "";
}

function setOrReplaceAttr(tag: string, name: string, value: string) {
  const re = new RegExp(`\\s${escapeRegExp(name)}\\s*=\\s*["'][^"']*["']`, "i");
  if (re.test(tag)) return tag.replace(re, ` ${name}="${escapeAttr(value)}"`);
  return tag.replace(/<svg\b/i, (m) => `${m} ${name}="${escapeAttr(value)}"`);
}

function removeAttr(tag: string, name: string) {
  const re = new RegExp(
    `\\s${escapeRegExp(name)}\\s*=\\s*["'][^"']*["']`,
    "ig",
  );
  return tag.replace(re, "");
}

function mergeStyleAttr(existing: string, addition: string) {
  const a = String(addition || "").trim();
  if (!a) return existing || "";
  const e = String(existing || "").trim();
  if (!e) return a;
  const eNorm = e.endsWith(";") ? e : `${e};`;
  return `${eNorm}${a}`;
}

function ensureInlineTitle(svg: string, title: string) {
  const t = String(title || "").trim();
  if (!t) return svg;

  let s = removeInlineTitle(svg);
  const openMatch = s.match(/<svg\b[^>]*>/i);
  if (!openMatch) return s;

  const open = openMatch[0];
  const titleTag = `<title>${escapeXmlText(t)}</title>`;
  return s.replace(open, `${open}${titleTag}`);
}

function removeInlineTitle(svg: string) {
  return svg.replace(/<title\b[\s\S]*?<\/title>/gi, "");
}

function swapQuotesToSingle(markup: string) {
  return markup.replace(
    /="([^"]*)"/g,
    (_m, v) => `='${String(v).replace(/'/g, "&#39;")}'`,
  );
}

/* ========================
   Text helpers
======================== */
function escapeAttr(v: string) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlText(v: string) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegExp(s: string) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseLen(raw: string): number | null {
  const m = String(raw || "")
    .trim()
    .match(/^(-?\d+(\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

function clampInt(v: number, lo: number, hi: number) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function sanitizeClassName(s: string) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t
    .split(/\s+/g)
    .map((x) => x.replace(/[^\w\-:]/g, ""))
    .filter(Boolean)
    .slice(0, 6)
    .join(" ");
}

function formatBytes(bytes: number) {
  if (!bytes || !Number.isFinite(bytes)) return "?";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function utf8ByteLength(s: string) {
  try {
    return new TextEncoder().encode(String(s || "")).length;
  } catch {
    return String(s || "").length;
  }
}

/* ========================
   Formatting helpers
======================== */
function prettyXmlLike(xml: string, indentStr: string) {
  const s = xml.replace(/>\s*</g, ">\n<");
  const lines = s.split("\n");
  let indent = 0;
  const out: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const isClose = /^<\/[^>]+>/.test(line);
    const isOpen = /^<[^/!][^>]*>$/.test(line) && !/\/>$/.test(line);
    const isSelf = /\/>$/.test(line) || /^<\?/.test(line) || /^<!/.test(line);

    if (isClose) indent = Math.max(0, indent - 1);
    out.push(indentStr.repeat(indent) + line);
    if (isOpen && !isSelf) indent += 1;
  }

  return out.join("\n").trim();
}

/* ========================
   UI helpers
======================== */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 bg-[#fafcff] border border-[#edf2fb] rounded-xl px-3 py-2 min-w-0">
      <span className="min-w-[180px] text-[13px] text-slate-700 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">{children}</div>
    </label>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 min-w-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#0b2dff] shrink-0 cursor-pointer"
      />
      <span className="text-[13px] text-slate-700 min-w-0">{label}</span>
    </label>
  );
}

function TogglePill({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "px-2 py-1 rounded-lg border text-[12px] font-semibold cursor-pointer transition-colors",
        checked
          ? "bg-[#eff4ff] border-[#d6e4ff] text-slate-900 hover:bg-[#e9f0ff]"
          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
      ].join(" ")}
      aria-pressed={checked}
    >
      {label}
    </button>
  );
}

function NumInt({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-[130px] px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
    />
  );
}

function UnitSelect({
  value,
  onChange,
}: {
  value: SizeUnit;
  onChange: (v: SizeUnit) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as any)}
      className="px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
    >
      <option value="px">px</option>
      <option value="pt">pt</option>
      <option value="em">em</option>
      <option value="rem">rem</option>
      <option value="%">%</option>
      <option value="vh">vh</option>
      <option value="vw">vw</option>
    </select>
  );
}

/* ========================
   Breadcrumbs UI + JSON-LD
======================== */
function Breadcrumbs({
  crumbs,
}: {
  crumbs: Array<{ name: string; href: string }>;
}) {
  return (
    <div className="mb-4 flex max-w-[1180px] mx-auto px-4">
      <nav aria-label="Breadcrumb" className="text-[13px] text-slate-600">
        <ol className="flex flex-wrap items-center gap-2">
          {crumbs.map((c, i) => (
            <li key={c.href} className="flex items-center gap-2">
              <a href={c.href} className="hover:text-slate-900">
                {c.name}
              </a>
              {i < crumbs.length - 1 ? (
                <span className="text-slate-300">/</span>
              ) : null}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

function JsonLdBreadcrumbs() {
  const baseUrl = "https://www.ilovesvg.com";

  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Inline SVG vs img",
        item: `${baseUrl}/inline-svg-vs-img`,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

const INLINE_SVG_FAQS = [
  {
    q: "What is the difference between inline SVG and <img>?",
    a: "Inline SVG inserts the <svg> markup directly into the page, which allows styling internal shapes with CSS and manipulating elements with JavaScript. Using <img> links to an SVG file or data URI, which is simpler and cache-friendly but does not allow styling the SVG's internal paths with CSS.",
  },
  {
    q: "Which is better for icons: inline SVG or <img>?",
    a: "Inline SVG is better when you need currentColor, hover states, or per-path styling. <img> is better when you want simple embedding, strong caching, and you do not need to style internal shapes.",
  },
  {
    q: "Can I change the color of an SVG used in an <img> tag?",
    a: "Not reliably. You can style the <img> element itself, but you cannot directly target the SVG's internal paths with CSS. For currentColor icons, inline SVG is the usual solution.",
  },
  {
    q: "Is it safe to inline SVG?",
    a: "Untrusted SVG can include scripts, event handlers, or foreignObject content. If you inline SVG you should sanitize it first by removing risky elements and attributes.",
  },
  {
    q: "Do you upload my SVG?",
    a: "No. Everything runs client-side in your browser. Nothing is uploaded to a server.",
  },
];

/* ========================
   FAQ JSON-LD
======================== */
function JsonLdFaq() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: INLINE_SVG_FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function FaqSection() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="mx-auto max-w-[1180px] px-4 py-10 text-slate-800">
        <div className="max-w-[900px]">
          <h2 className="m-0 text-2xl font-extrabold text-slate-900">FAQ</h2>
          <div className="mt-4 grid gap-3">
            {INLINE_SVG_FAQS.map((item) => (
              <details
                key={item.q}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                  {item.q}
                </summary>
                <p className="m-0 border-t border-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-700">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ========================
   SEO sections
======================== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              inline svg vs img
            </p>

            <h2 className="mt-2 text-2xl md:text-3xl font-bold leading-tight text-slate-900">
              Inline SVG vs {"<img>"}: which should you use?
            </h2>

            <p className="mt-3 text-slate-700 max-w-[92ch] leading-relaxed">
              If you’re choosing between <strong>inline SVG</strong> and the{" "}
              <strong>{"<img>"}</strong> tag, the decision is mostly about{" "}
              <strong>styling control</strong> vs <strong>simplicity</strong>.
              Inline SVG lives in the DOM so you can style fills/strokes and use{" "}
              <strong>currentColor</strong>. {"<img>"} is cache-friendly and
              clean, but you can’t reliably style internal SVG paths with CSS.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Need theming
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  Use inline SVG for <code>currentColor</code>, hover, active,
                  and per-path styling.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Need caching
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  Use {"<img>"} for URL-based reuse across pages and bundles.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Want clean DOM
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  {"<img>"} keeps SVG markup out of your HTML and components.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Untrusted SVG
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  Keep sanitization on before you inline anything.
                </div>
              </div>
            </div>
          </header>

          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-bold text-slate-900 m-0">
                Inline SVG
              </h3>
              <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                Best when the SVG is part of your UI system and needs to respond
                to theme colors, hover states, and component props.
              </p>

              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    What you can control
                  </div>
                  <ul className="mt-2 text-sm text-slate-700 list-disc pl-5 space-y-1">
                    <li>
                      Target internal nodes (<code>path</code>,{" "}
                      <code>circle</code>, <code>stroke</code>,{" "}
                      <code>fill</code>)
                    </li>
                    <li>
                      Use <code>currentColor</code> for themeable icons
                    </li>
                    <li>
                      Add <code>aria-label</code>, <code>&lt;title&gt;</code>,{" "}
                      <code>&lt;desc&gt;</code> for accessibility
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Trade-offs
                  </div>
                  <ul className="mt-2 text-sm text-slate-700 list-disc pl-5 space-y-1">
                    <li>More DOM nodes and bigger HTML if repeated</li>
                    <li>Requires sanitization for untrusted SVG markup</li>
                    <li>
                      IDs can collide if you inline the same SVG many times
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-bold text-slate-900 m-0">
                {"<img>"} (file URL or data URI)
              </h3>
              <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                Best when you want a simple, cacheable asset that you place like
                any other image.
              </p>

              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    What you get
                  </div>
                  <ul className="mt-2 text-sm text-slate-700 list-disc pl-5 space-y-1">
                    <li>Easy caching and reuse across pages</li>
                    <li>Cleaner DOM (no inline markup)</li>
                    <li>
                      Standard accessibility via <code>alt</code>
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Limits
                  </div>
                  <ul className="mt-2 text-sm text-slate-700 list-disc pl-5 space-y-1">
                    <li>Cannot style internal paths with CSS</li>
                    <li>
                      Theme color changes require separate files or
                      preprocessing
                    </li>
                    <li>
                      Data URIs can bloat CSS/HTML and are harder to debug
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
            <h3 className="m-0 text-xl font-bold text-slate-900">
              Quick decision rules
            </h3>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="text-sm font-semibold text-slate-900">
                  Choose inline SVG if…
                </div>
                <ul className="mt-2 text-sm text-slate-700 list-disc pl-5 space-y-1">
                  <li>
                    You need themeable icons with <code>currentColor</code>
                  </li>
                  <li>
                    You want hover/active states that change fills/strokes
                  </li>
                  <li>You need SVG-specific accessibility markup</li>
                  <li>You need to tweak viewBox, IDs, or classes in-place</li>
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="text-sm font-semibold text-slate-900">
                  Choose {"<img>"} if…
                </div>
                <ul className="mt-2 text-sm text-slate-700 list-disc pl-5 space-y-1">
                  <li>You want maximum caching and reuse</li>
                  <li>The icon is decorative and does not need theming</li>
                  <li>You want minimal DOM and simpler components</li>
                  <li>You’re embedding the same asset many times</li>
                </ul>
              </div>
            </div>
          </section>

          <section
            className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 md:p-8"
            itemScope
            itemType="https://schema.org/HowTo"
          >
            <h3
              itemProp="name"
              className="m-0 text-xl font-bold text-slate-900"
            >
              How to choose between inline SVG and {"<img>"}
            </h3>

            <p className="mt-2 text-sm text-slate-700 max-w-[92ch] leading-relaxed">
              Use the preview on this page to validate the exact behavior you
              care about: theming with <code>currentColor</code>, styling
              constraints, and whether your SVG has any unsafe markup that
              should be removed before shipping.
            </p>

            <ol className="mt-4 grid gap-2 list-decimal pl-5 text-sm text-slate-700">
              <li itemProp="step">Paste or upload an SVG.</li>
              <li itemProp="step">
                Choose a use-case preset if you want output tuned for theming,
                caching, decorative icons, responsive logos, or single-file
                handoff.
              </li>
              <li itemProp="step">
                Enable currentColor if you want themeable icons.
              </li>
              <li itemProp="step">
                Compare previews and copy the snippet that matches your needs.
              </li>
              <li itemProp="step">
                Keep sanitization enabled for any untrusted SVG.
              </li>
            </ol>
          </section>
        </article>
      </div>
    </section>
  );
}

/* ========================
   Auto-dimension inference
======================== */
function autoSizeKey(svgText: string) {
  const t = String(svgText || "").trim();
  if (!t) return "";
  // Good enough: stable per SVG content, cheap, no crypto.
  return `${t.length}:${t.slice(0, 200)}:${t.slice(-200)}`;
}

function inferSvgDimensions(
  svgText: string,
): { width: number; height: number; unit: SizeUnit } | null {
  const coerced = coerceToSvgMarkup(String(svgText || ""));
  const open = coerced.match(/<svg\b[^>]*>/i)?.[0] || "";
  if (!open) return null;

  const widthRaw = matchAttr(open, "width") || "";
  const heightRaw = matchAttr(open, "height") || "";
  const viewBoxRaw = matchAttr(open, "viewBox") || "";

  const wParsed = parseLengthWithUnit(widthRaw);
  const hParsed = parseLengthWithUnit(heightRaw);

  // Prefer explicit width/height if present and valid
  if (wParsed?.value && hParsed?.value) {
    const unit = (
      wParsed.unit && hParsed.unit && wParsed.unit === hParsed.unit
        ? wParsed.unit
        : "px"
    ) as SizeUnit;
    return {
      width: Math.max(1, wParsed.value),
      height: Math.max(1, hParsed.value),
      unit,
    };
  }

  // Fall back to viewBox
  if (viewBoxRaw) {
    const parts = viewBoxRaw
      .trim()
      .split(/[\s,]+/g)
      .map((x) => Number(x));
    if (parts.length >= 4 && parts.every((n) => Number.isFinite(n))) {
      const vw = Math.abs(parts[2]);
      const vh = Math.abs(parts[3]);
      if (vw > 0 && vh > 0) {
        return { width: Math.max(1, vw), height: Math.max(1, vh), unit: "px" };
      }
    }
  }

  // As a last resort, if only one dimension exists, still use it
  if (wParsed?.value && !hParsed?.value)
    return {
      width: Math.max(1, wParsed.value),
      height: DEFAULTS.height,
      unit: (wParsed.unit || "px") as SizeUnit,
    };
  if (!wParsed?.value && hParsed?.value)
    return {
      width: DEFAULTS.width,
      height: Math.max(1, hParsed.value),
      unit: (hParsed.unit || "px") as SizeUnit,
    };

  return null;
}

function parseLengthWithUnit(
  raw: string,
): { value: number; unit: SizeUnit | null } | null {
  const t = String(raw || "").trim();
  if (!t) return null;

  const m = t.match(/^(-?\d+(?:\.\d+)?)([a-z%]+)?$/i);
  if (!m) {
    const v = parseLen(t);
    return v ? { value: v, unit: null } : null;
  }

  const value = Number(m[1]);
  if (!Number.isFinite(value) || value === 0) return null;

  const unitRaw = String(m[2] || "").toLowerCase();
  const allowed: Record<string, SizeUnit> = {
    px: "px",
    pt: "pt",
    em: "em",
    rem: "rem",
    "%": "%",
    vh: "vh",
    vw: "vw",
  };

  const unit = unitRaw ? (allowed[unitRaw] ?? null) : null;
  return { value: Math.abs(value), unit };
}
