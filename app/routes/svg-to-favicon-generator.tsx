import * as React from "react";
import type { Route } from "./+types/svg-to-favicon-generator";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { Link } from "react-router";
import { zipSync, strToU8 } from "fflate";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "i🩵SVG  -  Favicon Generator (ICO + App Icons) from SVG/PNG/JPG/WEBP";
  const description =
    "Generate a favicon.ico and full app icon set from SVG, PNG, JPG, or WEBP. Create 16x16 to 256x256 ICO, Apple touch icons, Android/Chrome icons, Microsoft tiles, plus a production-ready HTML snippet. Runs 100% in your browser.";
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
   Types
======================== */
type SourceKind = "svg" | "raster";

type PlatformPreset = {
  web: boolean;
  android: boolean;
  ios: boolean;
  microsoft: boolean;
};

type Settings = {
  generateAllPlatforms: boolean;
  onlyIco16: boolean;

  maintainAspect: boolean;
  padToSquare: boolean;
  background: "transparent" | "white" | "custom";
  backgroundCustom: string;

  includeInGallery: boolean;

  appName: string;
  themeColor: string;
  msTileColor: string;

  icoSizes: number[];
  pngMasterSize: number;

  platforms: PlatformPreset;

  sharpenDownscales: boolean;
  removeMetadata: boolean;

  baseName: string;
  includeManifest: boolean;
  includeMsConfig: boolean;
};

type GeneratedFile = {
  name: string;
  mime: string;
  bytes: Uint8Array;
};

const DEFAULTS: Settings = {
  generateAllPlatforms: true,
  onlyIco16: false,

  maintainAspect: true,
  padToSquare: true,
  background: "transparent",
  backgroundCustom: "#ffffff",

  includeInGallery: false,

  appName: "My App",
  themeColor: "#0b2dff",
  msTileColor: "#0b2dff",

  icoSizes: [16, 24, 32, 48, 64, 128, 256],
  pngMasterSize: 512,

  platforms: {
    web: true,
    android: true,
    ios: true,
    microsoft: true,
  },

  sharpenDownscales: false,
  removeMetadata: true,

  baseName: "favicon",
  includeManifest: true,
  includeMsConfig: true,
};

/* ========================
   Page
======================== */
export default function SvgFaviconGenerator(_: Route.ComponentProps) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);

  const [file, setFile] = React.useState<File | null>(null);
  const [srcKind, setSrcKind] = React.useState<SourceKind | null>(null);

  const [srcSvgText, setSrcSvgText] = React.useState<string>("");
  const [srcImageUrl, setSrcImageUrl] = React.useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [resultPreviewUrl, setResultPreviewUrl] = React.useState<string | null>(
    null,
  );

  const [files, setFiles] = React.useState<GeneratedFile[] | null>(null);
  const [htmlSnippet, setHtmlSnippet] = React.useState<string>("");

  const [err, setErr] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [isWorking, setIsWorking] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (srcImageUrl) URL.revokeObjectURL(srcImageUrl);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (resultPreviewUrl) URL.revokeObjectURL(resultPreviewUrl);
    };
  }, [srcImageUrl, previewUrl, resultPreviewUrl]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    await handleNewFile(f);
    e.currentTarget.value = "";
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
        if (!f) continue;
        const name = f.name.toLowerCase();
        const ok =
          f.type === "image/svg+xml" ||
          f.type === "image/png" ||
          f.type === "image/jpeg" ||
          f.type === "image/webp" ||
          name.endsWith(".svg") ||
          name.endsWith(".png") ||
          name.endsWith(".jpg") ||
          name.endsWith(".jpeg") ||
          name.endsWith(".webp");
        if (ok) {
          e.preventDefault();
          await handleNewFile(f);
          return;
        }
      }
    }
  }

  function clearAll() {
    if (srcImageUrl) URL.revokeObjectURL(srcImageUrl);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultPreviewUrl) URL.revokeObjectURL(resultPreviewUrl);

    setFile(null);
    setSrcKind(null);
    setSrcSvgText("");
    setSrcImageUrl(null);
    setPreviewUrl(null);
    setResultPreviewUrl(null);
    setFiles(null);
    setHtmlSnippet("");
    setErr(null);
  }

  async function handleNewFile(f: File) {
    setErr(null);
    setFiles(null);
    setHtmlSnippet("");
    setResultPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });

    const name = f.name.toLowerCase();
    const isSvg = f.type === "image/svg+xml" || name.endsWith(".svg");
    const isPng = f.type === "image/png" || name.endsWith(".png");
    const isJpg =
      f.type === "image/jpeg" ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg");
    const isWebp = f.type === "image/webp" || name.endsWith(".webp");

    if (!isSvg && !isPng && !isJpg && !isWebp) {
      setErr("Upload an SVG, PNG, JPG, or WEBP file.");
      return;
    }

    setFile(f);

    const base = stripExt(f.name) || "favicon";
    setSettings((s) => ({ ...s, baseName: safeFileName(base) }));

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const u = URL.createObjectURL(f);
    setPreviewUrl(u);

    // use a stable image URL for raster inputs
    setSrcImageUrl((prev) => {
      if (prev && prev !== u) URL.revokeObjectURL(prev);
      return u;
    });

    if (isSvg) {
      setSrcKind("svg");
      const text = await f.text();
      const coerced = ensureSvgHasXmlns(text);
      setSrcSvgText(coerced);

      // for rendering svg as an image reliably, use a blob URL from the text
      const svgUrl = URL.createObjectURL(
        new Blob([coerced], { type: "image/svg+xml;charset=utf-8" }),
      );
      setSrcImageUrl((prev) => {
        if (prev && prev !== u) URL.revokeObjectURL(prev);
        return svgUrl;
      });
    } else {
      setSrcKind("raster");
      setSrcSvgText("");
    }

    showToast("File loaded. Click Generate.");
  }

  function loadExample() {
    const example = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2dff"/>
      <stop offset="1" stop-color="#22c55e"/>
    </linearGradient>
  </defs>
  <rect x="48" y="48" width="416" height="416" rx="96" fill="url(#g)"/>
  <path d="M176 330V182h60l40 74 40-74h60v148h-50v-72l-50 88-50-88v72z"
    fill="#fff"/>
</svg>`;

    setFile(null);
    setErr(null);
    setSrcKind("svg");
    setSrcSvgText(example);
    setFiles(null);
    setHtmlSnippet("");

    setPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return URL.createObjectURL(
        new Blob([example], { type: "image/svg+xml" }),
      );
    });

    setSrcImageUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return URL.createObjectURL(
        new Blob([example], { type: "image/svg+xml" }),
      );
    });

    showToast("Example loaded. Click Generate.");
  }

  function toggleAllPlatforms(on: boolean) {
    setSettings((s) => ({
      ...s,
      generateAllPlatforms: on,
      onlyIco16: on ? false : s.onlyIco16,
      platforms: on
        ? { web: true, android: true, ios: true, microsoft: true }
        : s.platforms,
    }));
  }

  async function generateNow() {
    setErr(null);
    setIsWorking(true);

    try {
      if (!srcImageUrl && !srcSvgText.trim())
        throw new Error("Upload an image first.");

      const platforms = settings.generateAllPlatforms
        ? { web: true, android: true, ios: true, microsoft: true }
        : settings.platforms;

      // Build a master square icon canvas (512 default)
      const masterSize = clampNum(settings.pngMasterSize, 64, 2048);
      const master = await rasterizeToSquareCanvas({
        srcKind,
        srcSvgText,
        srcUrl: srcImageUrl,
        size: masterSize,
        maintainAspect: settings.maintainAspect,
        padToSquare: settings.padToSquare,
        background: settings.background,
        backgroundCustom: settings.backgroundCustom,
      });

      setResultPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return canvasToObjectUrl(master, "image/png");
      });

      const out: GeneratedFile[] = [];

      const icoSizes = settings.onlyIco16
        ? [16]
        : uniqSorted(settings.icoSizes);

      const icoBytes = await buildIcoFromCanvas(master, icoSizes);
      out.push({
        name: `${safeFileName(settings.baseName || "favicon")}.ico`,
        mime: "image/x-icon",
        bytes: icoBytes,
      });

      if (platforms.web) {
        out.push(
          await canvasToPngFile(master, 32, "favicon-32x32.png"),
          await canvasToPngFile(master, 16, "favicon-16x16.png"),
          await canvasToPngFile(master, 192, "android-chrome-192x192.png"),
          await canvasToPngFile(master, 512, "android-chrome-512x512.png"),
          await canvasToPngFile(master, 180, "apple-touch-icon.png"),
        );
      }

      if (platforms.android) {
        out.push(
          await canvasToPngFile(master, 48, "android-icon-48x48.png"),
          await canvasToPngFile(master, 72, "android-icon-72x72.png"),
          await canvasToPngFile(master, 96, "android-icon-96x96.png"),
          await canvasToPngFile(master, 144, "android-icon-144x144.png"),
          await canvasToPngFile(master, 192, "android-icon-192x192.png"),
          await canvasToPngFile(master, 512, "android-icon-512x512.png"),
        );
      }

      if (platforms.ios) {
        out.push(
          await canvasToPngFile(master, 180, "apple-touch-icon-180x180.png"),
          await canvasToPngFile(master, 152, "apple-touch-icon-152x152.png"),
          await canvasToPngFile(master, 167, "apple-touch-icon-167x167.png"),
          await canvasToPngFile(master, 120, "apple-touch-icon-120x120.png"),
          await canvasToPngFile(master, 76, "apple-touch-icon-76x76.png"),
          await canvasToPngFile(master, 60, "apple-touch-icon-60x60.png"),
        );
      }

      if (platforms.microsoft) {
        out.push(
          await canvasToPngFile(master, 144, "mstile-144x144.png"),
          await canvasToPngFile(master, 150, "mstile-150x150.png"),
          await canvasToPngFile(master, 310, "mstile-310x310.png"),
          await canvasToPngFile(master, 70, "mstile-70x70.png"),
        );
      }

      // optional: generate manifest + browserconfig files into the ZIP too
      if (settings.includeManifest) {
        const manifest = buildManifest({
          appName: settings.appName,
          themeColor: settings.themeColor,
          icons: out
            .filter((f) => f.name.endsWith(".png"))
            .map((f) => ({
              src: `/${f.name}`,
              sizes: guessPngSizes(f.name),
              type: "image/png",
            }))
            .filter((x) => x.sizes),
        });
        out.push({
          name: "site.webmanifest",
          mime: "application/manifest+json",
          bytes: strToU8(JSON.stringify(manifest, null, 2)),
        });
      }

      if (settings.includeMsConfig) {
        const xml = buildBrowserConfig({
          tileColor: settings.msTileColor,
          tiles: out.filter(
            (f) => f.name.startsWith("mstile-") && f.name.endsWith(".png"),
          ),
        });
        out.push({
          name: "browserconfig.xml",
          mime: "application/xml",
          bytes: strToU8(xml),
        });
      }

      const snippet = buildHtmlSnippet({
        baseName: safeFileName(settings.baseName || "favicon"),
        platforms,
        themeColor: settings.themeColor,
        msTileColor: settings.msTileColor,
        includeManifest: settings.includeManifest,
        includeMsConfig: settings.includeMsConfig,
      });

      setFiles(out);
      setHtmlSnippet(snippet);
      showToast("Icons ready");
    } catch (e: any) {
      setErr(e?.message || "Generation failed.");
      setFiles(null);
      setHtmlSnippet("");
      setResultPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
    } finally {
      setIsWorking(false);
    }
  }

  function downloadIcoOnly() {
    const ico = files?.find((f) => f.name.endsWith(".ico"));
    if (!ico) {
      setErr("No .ico file found. Click Generate first.");
      return;
    }
    downloadBytes(ico.bytes, ico.name, ico.mime);
    showToast("Downloaded");
  }

  function downloadAllIndividually() {
    if (!files?.length) {
      setErr("Nothing to download. Click Generate first.");
      return;
    }
    for (const f of files) downloadBytes(f.bytes, f.name, f.mime);
    showToast("Downloaded");
  }

  function downloadZip() {
    if (!files?.length) {
      setErr("Nothing to download. Click Generate first.");
      return;
    }

    // zip on the client after conversion
    const zipInput: Record<string, Uint8Array> = {};
    for (const f of files) zipInput[f.name] = f.bytes;

    const zipBytes = zipSync(zipInput, { level: 6 });
    const base = safeFileName(settings.baseName || "favicon");
    downloadBytes(zipBytes, `${base}-icons.zip`, "application/zip");
    showToast("ZIP downloaded");
  }

  function copySnippet() {
    if (!htmlSnippet.trim()) return;
    navigator.clipboard
      .writeText(htmlSnippet)
      .then(() => showToast("Copied"))
      .catch(() => setErr("Clipboard copy failed (browser blocked it)."));
  }

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Favicon Generator", href: "/svg-favicon-generator" },
  ];

  return (
    <>
      <SiteHeader />

      <main
        className="min-h-[100dvh] bg-slate-50 text-slate-900"
        onPaste={onPaste}
      >
        <div className="max-w-[1180px] mx-auto px-4 pt-6 pb-12">
          <Breadcrumbs crumbs={crumbs} />

          <header className="text-center mb-4">
            <h1 className="inline-flex items-center gap-2 text-[34px] font-extrabold leading-none m-0">
              <span>Favicon</span>
              <span className="text-slate-400">•</span>
              <span className="text-[#0b2dff]">Generator</span>
            </h1>
            <p className="mt-2 text-slate-600">
              Upload an image and generate <b>favicon.ico</b> plus full{" "}
              <b>app icons</b>. No uploads.
            </p>
          </header>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* INPUT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="m-0 font-bold text-lg text-slate-900">Input</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={loadExample}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900"
                  >
                    Load example
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {!file && !srcImageUrl && !srcSvgText.trim() ? (
                <div
                  role="button"
                  tabIndex={0}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => document.getElementById("ico-inp")?.click()}
                  className="mt-3 border border-dashed border-[#c8d3ea] rounded-2xl p-4 text-center cursor-pointer min-h-[10em] flex justify-center items-center bg-[#f9fbff] hover:bg-[#f2f6ff] focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <div className="text-sm text-slate-600">
                    Click, drag & drop, or paste an image (SVG/PNG/JPG/WEBP)
                  </div>
                  <input
                    id="ico-inp"
                    type="file"
                    accept="image/svg+xml,image/png,image/jpeg,image/webp,.svg,.png,.jpg,.jpeg,.webp"
                    onChange={onPick}
                    className="hidden"
                  />
                </div>
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
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                </>
              )}

              {previewUrl && (
                <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                    Preview (uploaded)
                  </div>
                  <div className="p-3">
                    <img
                      src={previewUrl}
                      alt="Input preview"
                      className="w-full h-auto block"
                    />
                  </div>
                </div>
              )}

              {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}
            </div>

            {/* SETTINGS + OUTPUT */}
            <div className="bg-sky-50/10 border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0 overflow-hidden">
              <h2 className="m-0 font-bold mb-3 text-lg text-slate-900">
                Output Settings
              </h2>

              <div className="bg-white border border-slate-200 rounded-2xl p-3 overflow-hidden">
                <div className="grid gap-2 min-w-0">
                  <Field label="Output intent">
                    <div className="flex flex-col gap-2 w-full">
                      <ToggleRow
                        checked={settings.generateAllPlatforms}
                        onChange={toggleAllPlatforms}
                        label="Generate icons for Web, Android, Microsoft, and iOS"
                      />
                      <ToggleRow
                        checked={settings.onlyIco16}
                        onChange={(v) =>
                          setSettings((s) => ({
                            ...s,
                            onlyIco16: v,
                            generateAllPlatforms: v
                              ? false
                              : s.generateAllPlatforms,
                          }))
                        }
                        label="Generate only 16×16 favicon.ico"
                      />
                    </div>
                  </Field>

                  {!settings.generateAllPlatforms && !settings.onlyIco16 && (
                    <Field label="Platforms">
                      <div className="flex flex-col gap-2 w-full">
                        <ToggleRow
                          checked={settings.platforms.web}
                          onChange={(v) =>
                            setSettings((s) => ({
                              ...s,
                              platforms: { ...s.platforms, web: v },
                            }))
                          }
                          label="Web (favicon + Apple touch + Chrome icons)"
                        />
                        <ToggleRow
                          checked={settings.platforms.android}
                          onChange={(v) =>
                            setSettings((s) => ({
                              ...s,
                              platforms: { ...s.platforms, android: v },
                            }))
                          }
                          label="Android (launcher icons)"
                        />
                        <ToggleRow
                          checked={settings.platforms.ios}
                          onChange={(v) =>
                            setSettings((s) => ({
                              ...s,
                              platforms: { ...s.platforms, ios: v },
                            }))
                          }
                          label="iOS (Apple touch icons)"
                        />
                        <ToggleRow
                          checked={settings.platforms.microsoft}
                          onChange={(v) =>
                            setSettings((s) => ({
                              ...s,
                              platforms: { ...s.platforms, microsoft: v },
                            }))
                          }
                          label="Microsoft (tiles/browserconfig)"
                        />
                      </div>
                    </Field>
                  )}

                  <Field label="Maintain dimensions">
                    <input
                      type="checkbox"
                      checked={settings.maintainAspect}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          maintainAspect: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      Keep aspect ratio (don’t stretch)
                    </span>
                  </Field>

                  {settings.maintainAspect && (
                    <Field label="Pad to square">
                      <input
                        type="checkbox"
                        checked={settings.padToSquare}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            padToSquare: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-[#0b2dff] shrink-0"
                      />
                      <span className="text-[13px] text-slate-700 min-w-0">
                        Add padding instead of cropping
                      </span>
                    </Field>
                  )}

                  <Field label="Background">
                    <select
                      value={settings.background}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          background: e.target.value as any,
                        }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 truncate"
                    >
                      <option value="transparent">Transparent</option>
                      <option value="white">White</option>
                      <option value="custom">Custom</option>
                    </select>

                    {settings.background === "custom" && (
                      <input
                        value={settings.backgroundCustom}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            backgroundCustom: e.target.value,
                          }))
                        }
                        className="w-[140px] min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                        placeholder="#ffffff"
                      />
                    )}
                  </Field>

                  <Field label="Master size">
                    <NumInt
                      value={settings.pngMasterSize}
                      min={64}
                      max={2048}
                      step={64}
                      onChange={(v) =>
                        setSettings((s) => ({ ...s, pngMasterSize: v }))
                      }
                    />
                    <span className="text-[12px] text-slate-500 shrink-0">
                      Downscale source
                    </span>
                  </Field>

                  {!settings.onlyIco16 && (
                    <Field label="ICO sizes">
                      <input
                        value={settings.icoSizes.join(",")}
                        onChange={(e) => {
                          const sizes = parseSizeList(e.target.value);
                          setSettings((s) => ({ ...s, icoSizes: sizes }));
                        }}
                        className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                        placeholder="16,24,32,48,64,128,256"
                      />
                    </Field>
                  )}

                  <Field label="App name">
                    <input
                      value={settings.appName}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, appName: e.target.value }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    />
                  </Field>

                  <Field label="Theme color">
                    <input
                      value={settings.themeColor}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          themeColor: e.target.value,
                        }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    />
                  </Field>

                  <Field label="Microsoft tile color">
                    <input
                      value={settings.msTileColor}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          msTileColor: e.target.value,
                        }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    />
                  </Field>

                  <Field label="Output base name">
                    <input
                      value={settings.baseName}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, baseName: e.target.value }))
                      }
                      className="w-full min-w-0 px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
                    />
                  </Field>

                  <Field label="Manifest / msconfig">
                    <div className="flex flex-col gap-2 w-full">
                      <ToggleRow
                        checked={settings.includeManifest}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, includeManifest: v }))
                        }
                        label="Include site.webmanifest in ZIP"
                      />
                      <ToggleRow
                        checked={settings.includeMsConfig}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, includeMsConfig: v }))
                        }
                        label="Include browserconfig.xml in ZIP"
                      />
                    </div>
                  </Field>

                  <Field label="Include in gallery">
                    <input
                      type="checkbox"
                      checked={settings.includeInGallery}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          includeInGallery: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#0b2dff] shrink-0"
                    />
                    <span className="text-[13px] text-slate-700 min-w-0">
                      UI flag only unless you wire uploads
                    </span>
                  </Field>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={generateNow}
                    disabled={
                      !hydrated ||
                      (!srcImageUrl && !srcSvgText.trim()) ||
                      isWorking
                    }
                    className={[
                      "px-3.5 py-2 rounded-xl font-bold border transition-colors",
                      "text-white bg-sky-500 border-sky-600 hover:bg-sky-600",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                    ].join(" ")}
                  >
                    {isWorking ? "Generating..." : "Generate icons"}
                  </button>

                  <button
                    type="button"
                    onClick={downloadAllIndividually}
                    disabled={!hydrated || !files?.length || isWorking}
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Download all files (Recommended: Try Zip Download First)
                  </button>
                  <button
                    type="button"
                    onClick={downloadIcoOnly}
                    disabled={!hydrated || !files?.length || isWorking}
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Download .ico
                  </button>

                  <button
                    type="button"
                    onClick={downloadZip}
                    disabled={!hydrated || !files?.length || isWorking}
                    className="px-3.5 py-2 rounded-xl font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Download ZIP
                  </button>

                  {files?.length ? (
                    <span className="text-[13px] text-slate-600">
                      Generated <b>{files.length}</b> files
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  Output preview (master icon)
                </div>
                <div className="p-3">
                  {resultPreviewUrl ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-start">
                      <PreviewTile
                        label="512"
                        src={resultPreviewUrl}
                        size={512}
                      />
                      <PreviewTile
                        label="192"
                        src={resultPreviewUrl}
                        size={192}
                      />
                      <PreviewTile
                        label="180"
                        src={resultPreviewUrl}
                        size={180}
                      />
                      <PreviewTile
                        label="64"
                        src={resultPreviewUrl}
                        size={64}
                      />
                      <PreviewTile
                        label="32"
                        src={resultPreviewUrl}
                        size={32}
                      />
                      <PreviewTile
                        label="16"
                        src={resultPreviewUrl}
                        size={16}
                      />
                    </div>
                  ) : (
                    <div className="text-slate-600 text-sm">
                      Generate to see preview.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  Production HTML snippet
                </div>
                <div className="p-3">
                  {htmlSnippet ? (
                    <>
                      <textarea
                        value={htmlSnippet}
                        readOnly
                        className="w-full h-[220px] rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-900"
                        spellCheck={false}
                      />
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={copySnippet}
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900"
                        >
                          Copy snippet
                        </button>
                        <span className="text-[12px] text-slate-600">
                          Put this in your <code>&lt;head&gt;</code>.
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-600 text-sm">
                      Generate to see snippet.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-3 py-2 text-[13px] text-slate-600 border-b border-slate-200 bg-slate-50">
                  Generated files
                </div>
                <div className="p-3">
                  {files?.length ? (
                    <ul className="text-[13px] text-slate-700 grid gap-1">
                      {files.map((f) => (
                        <li
                          key={f.name}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{f.name}</span>
                          <span className="text-slate-500 shrink-0">
                            {formatBytes(f.bytes.byteLength)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-slate-600 text-sm">
                      Generate to list files.
                    </div>
                  )}
                </div>
              </div>

              {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}
            </div>
          </section>
        </div>

        {toast && (
          <div className="fixed right-4 bottom-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[1000]">
            {toast}
          </div>
        )}
      </main>

      <SeoSections />
      <JsonLdBreadcrumbs />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ========================
   SEO sections + FAQ JSON-LD
======================== */
/* ========================
   SEO sections + FAQ JSON-LD
======================== */
function SeoSections() {
  const faqs = [
    {
      q: "Does this favicon generator upload my file?",
      a: "No. Everything runs locally in your browser. Your SVG/PNG/JPG/WEBP never leaves your device.",
    },
    {
      q: "What is favicon.ico and do I still need it?",
      a: "favicon.ico is the classic favicon file many browsers and crawlers still request by default at /favicon.ico. Even if you use PNG icons, shipping a favicon.ico improves compatibility and reduces missing-icon requests.",
    },
    {
      q: "How do I add a favicon to my website?",
      a: 'Place favicon.ico at the site root (public/favicon.ico), then add <link rel="icon" href="/favicon.ico" sizes="any">. For best results also include 32×32 and 16×16 PNG links plus Apple touch icon and a manifest.',
    },
    {
      q: "Why is my favicon not updating?",
      a: "Favicons are aggressively cached. Hard refresh, clear site data, and test in a private window. Also confirm the new file path is correct and the server is returning the updated file (not a CDN-cached version).",
    },
    {
      q: "Can I generate a favicon from SVG or convert PNG/JPG/WEBP to ICO?",
      a: "Yes. Upload SVG, PNG, JPG, or WEBP. The tool outputs a multi-size favicon.ico plus optional PNG app icons for iOS, Android/Chrome, and Microsoft tiles.",
    },
    {
      q: "What sizes do I need for a favicon and app icons?",
      a: "Common web favicon sizes are 16×16 and 32×32. Many setups also include 48×48 and larger sizes inside favicon.ico. For app icons: Apple touch icon is typically 180×180 and Android/Chrome commonly uses 192×192 and 512×512.",
    },
    {
      q: "Will this reduce quality or rasterize my SVG permanently?",
      a: "SVGs are rasterized only to generate icon bitmaps. Your original SVG is not modified. The output icons are standard PNG and ICO files you can use anywhere.",
    },
  ];

  function JsonLdFaq() {
    const data = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      />
    );
  }

  return (
    <section className="bg-white border-t border-slate-200">
      <JsonLdFaq />
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="prose prose-slate max-w-none">
          <h2 className="m-0 font-bold">
            Favicon Generator (SVG to ICO, PNG to ICO) + App Icon Generator
          </h2>

          <p className="mt-3">
            This <strong>favicon generator</strong> creates a production-ready{" "}
            <strong>favicon.ico</strong> and a complete set of{" "}
            <strong>app icons</strong> from an uploaded image. Convert{" "}
            <strong>SVG to ICO</strong> (or <strong>PNG to ICO</strong>,{" "}
            <strong>JPG to ICO</strong>, <strong>WEBP to ICO</strong>) and
            export the exact sizes modern browsers and platforms expect. Preview
            the output instantly, then download individual files or a single{" "}
            <strong>ZIP</strong>. Everything runs client-side in your browser.
          </p>

          <section className="mt-10">
            <h3 className="m-0 font-bold">
              What a Favicon Is (and Why .ICO Still Matters)
            </h3>
            <p className="mt-3">
              A <strong>favicon</strong> is the small icon shown in browser
              tabs, bookmarks, and search results. Many browsers still look for{" "}
              <code>/favicon.ico</code> automatically, so shipping a real{" "}
              <strong>favicon.ico</strong> avoids missing icons and improves
              compatibility. PNG icons are also useful, especially for specific
              sizes like <strong>16×16</strong> and <strong>32×32</strong>.
            </p>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">
              App Icons, PWA Icons, and Platform Sizes
            </h3>
            <p className="mt-3">
              App icons are the larger icons used when someone saves your site
              to their home screen or installs it as a PWA. Typical requirements
              include <strong>Apple touch icons</strong> (often 180×180) and{" "}
              <strong>Android/Chrome icons</strong> (commonly 192×192 and
              512×512). This tool exports those files so you do not have to
              guess sizes or manually resize.
            </p>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">
              How to Use the Generated Files in Production
            </h3>
            <ol className="mt-3 list-decimal pl-5 grid gap-2 text-slate-700">
              <li>
                Put <code>favicon.ico</code> at your site root:{" "}
                <code>public/favicon.ico</code> (or your framework’s public
                folder).
              </li>
              <li>
                Put PNG icons in <code>public/</code> (or{" "}
                <code>public/icons/</code>) and keep the paths in the snippet
                consistent.
              </li>
              <li>
                Paste the generated <code>&lt;head&gt;</code> snippet into your
                layout (HTML template, React root, Next.js <code>app/head</code>
                , etc).
              </li>
              <li>
                If you use <code>site.webmanifest</code>, place it in{" "}
                <code>public/site.webmanifest</code> and verify it is served
                with the right content type.
              </li>
              <li>
                Hard refresh and test in a private window. Favicons are cached
                aggressively.
              </li>
            </ol>
          </section>

          <section className="mt-10">
            <h3 className="m-0 font-bold">
              Troubleshooting: “My Favicon Isn’t Changing”
            </h3>
            <ul className="mt-3 text-slate-700 list-disc pl-5">
              <li>
                Hard refresh (Ctrl+F5 / Cmd+Shift+R) and test in a private
                window.
              </li>
              <li>Clear site data for your domain, then reload.</li>
              <li>
                Confirm the browser is requesting <code>/favicon.ico</code> and
                your server is returning the new file (not an old CDN copy).
              </li>
              <li>
                If you changed filenames, update every{" "}
                <code>&lt;link rel="icon"&gt;</code> path too.
              </li>
            </ul>
          </section>

          <section className="mt-12">
            <h3 className="m-0 font-bold">FAQ</h3>
            <div className="not-prose mt-4 grid gap-3">
              {faqs.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-3">
                    <span>{f.q}</span>
                    <span className="text-slate-400 group-open:rotate-45 transition-transform select-none">
                      +
                    </span>
                  </summary>
                  <div className="pt-2 text-slate-700 text-[14px] leading-relaxed">
                    {f.a}
                  </div>
                </details>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}

/* ========================
   Core: rasterize to square canvas
======================== */
async function rasterizeToSquareCanvas(args: {
  srcKind: SourceKind | null;
  srcSvgText: string;
  srcUrl: string | null;
  size: number;
  maintainAspect: boolean;
  padToSquare: boolean;
  background: "transparent" | "white" | "custom";
  backgroundCustom: string;
}): Promise<HTMLCanvasElement> {
  const {
    srcKind,
    srcSvgText,
    srcUrl,
    size,
    maintainAspect,
    padToSquare,
    background,
    backgroundCustom,
  } = args;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d", { alpha: background === "transparent" });
  if (!ctx) throw new Error("Canvas not available.");

  if (background !== "transparent") {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle =
      background === "white"
        ? "#ffffff"
        : sanitizeCssColor(backgroundCustom, "#ffffff");
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }

  const img = await loadAsImage(srcKind, srcSvgText, srcUrl);
  const iw = img.naturalWidth || (img as any).width || size;
  const ih = img.naturalHeight || (img as any).height || size;

  let dx = 0,
    dy = 0,
    dw = size,
    dh = size;

  if (maintainAspect) {
    const s = Math.min(size / iw, size / ih);
    dw = Math.max(1, Math.round(iw * s));
    dh = Math.max(1, Math.round(ih * s));

    if (padToSquare) {
      dx = Math.round((size - dw) / 2);
      dy = Math.round((size - dh) / 2);
    }
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, dw, dh);

  return canvas;
}

async function loadAsImage(
  srcKind: SourceKind | null,
  srcSvgText: string,
  srcUrl: string | null,
): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";

  if (srcKind === "svg") {
    const svg = ensureSvgHasXmlns(srcSvgText || "");
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load SVG image."));
      img.src = url;
    });

    URL.revokeObjectURL(url);
    return img;
  }

  if (!srcUrl) throw new Error("Missing image source.");
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = srcUrl;
  });
  return img;
}

/* ========================
   ICO building (PNG entries)
======================== */
async function buildIcoFromCanvas(
  master: HTMLCanvasElement,
  sizes: number[],
): Promise<Uint8Array> {
  const uniq = uniqSorted(sizes).filter((n) => n >= 16 && n <= 256);
  if (!uniq.length)
    throw new Error("ICO sizes must include at least one size (16..256).");

  const pngs: Array<{ size: number; bytes: Uint8Array }> = [];
  for (const s of uniq) {
    const c = document.createElement("canvas");
    c.width = s;
    c.height = s;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas not available.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(master, 0, 0, s, s);
    pngs.push({ size: s, bytes: canvasToPngBytes(c) });
  }

  return encodeIcoFromPngs(pngs);
}

function encodeIcoFromPngs(
  entries: Array<{ size: number; bytes: Uint8Array }>,
) {
  const count = entries.length;
  const dirSize = 6 + count * 16;
  let dataOffset = dirSize;

  const totalSize =
    dirSize + entries.reduce((sum, e) => sum + e.bytes.byteLength, 0);

  const out = new Uint8Array(totalSize);
  const dv = new DataView(out.buffer);

  dv.setUint16(0, 0, true);
  dv.setUint16(2, 1, true);
  dv.setUint16(4, count, true);

  let dirPos = 6;

  for (const e of entries) {
    const s = e.size;
    const w = s === 256 ? 0 : s;
    const h = s === 256 ? 0 : s;

    out[dirPos + 0] = w;
    out[dirPos + 1] = h;
    out[dirPos + 2] = 0;
    out[dirPos + 3] = 0;
    dv.setUint16(dirPos + 4, 1, true);
    dv.setUint16(dirPos + 6, 32, true);
    dv.setUint32(dirPos + 8, e.bytes.byteLength, true);
    dv.setUint32(dirPos + 12, dataOffset, true);

    out.set(e.bytes, dataOffset);
    dataOffset += e.bytes.byteLength;
    dirPos += 16;
  }

  return out;
}

/* ========================
   PNG output
======================== */
async function canvasToPngFile(
  master: HTMLCanvasElement,
  size: number,
  name: string,
): Promise<GeneratedFile> {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas not available.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(master, 0, 0, size, size);

  const bytes = canvasToPngBytes(c);
  return { name, mime: "image/png", bytes };
}

function canvasToObjectUrl(canvas: HTMLCanvasElement, mime: string) {
  const bytes = canvasToPngBytes(canvas);
  return URL.createObjectURL(new Blob([bytes.buffer.slice(0)], { type: mime }));
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Uint8Array {
  const dataUrl = canvas.toDataURL("image/png");
  return dataUrlToBytes(dataUrl);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Bad data URL.");
  const b64 = m[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/* ========================
   Manifest + browserconfig
======================== */
function buildManifest(args: {
  appName: string;
  themeColor: string;
  icons: Array<{ src: string; sizes: string | null; type: string }>;
}) {
  return {
    name: args.appName || "App",
    short_name: (args.appName || "App").slice(0, 12),
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: args.themeColor || "#000000",
    icons: args.icons
      .filter((i) => i.sizes)
      .map((i) => ({ src: i.src, sizes: i.sizes!, type: i.type })),
  };
}

function buildBrowserConfig(args: {
  tileColor: string;
  tiles: GeneratedFile[];
}) {
  const tile = (n: string) => args.tiles.find((t) => t.name === n);
  const t70 = tile("mstile-70x70.png") ? "mstile-70x70.png" : "";
  const t150 = tile("mstile-150x150.png") ? "mstile-150x150.png" : "";
  const t310 = tile("mstile-310x310.png") ? "mstile-310x310.png" : "";
  const t144 = tile("mstile-144x144.png") ? "mstile-144x144.png" : "";

  return `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      ${t70 ? `<square70x70logo src="/${t70}"/>` : ""}
      ${t150 ? `<square150x150logo src="/${t150}"/>` : ""}
      ${t310 ? `<square310x310logo src="/${t310}"/>` : ""}
      ${t144 ? `<wide310x150logo src="/${t144}"/>` : ""}
      <TileColor>${escapeXml(args.tileColor || "#0b2dff")}</TileColor>
    </tile>
  </msapplication>
</browserconfig>`;
}

function escapeXml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function guessPngSizes(name: string): string | null {
  const m = name.match(/(\d{2,4})x\1/);
  if (!m) return null;
  return `${m[1]}x${m[1]}`;
}

/* ========================
   HTML snippet builder
======================== */
function buildHtmlSnippet(args: {
  baseName: string;
  platforms: PlatformPreset;
  themeColor: string;
  msTileColor: string;
  includeManifest: boolean;
  includeMsConfig: boolean;
}) {
  const {
    platforms,
    themeColor,
    msTileColor,
    includeManifest,
    includeMsConfig,
  } = args;

  const lines: string[] = [];
  lines.push(`<!-- Favicon / App Icons -->`);
  lines.push(`<link rel="icon" href="/${args.baseName}.ico" sizes="any">`);

  if (platforms.web) {
    lines.push(
      `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">`,
    );
    lines.push(
      `<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">`,
    );
    lines.push(
      `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`,
    );
  }

  if (includeManifest) {
    lines.push(
      `<meta name="theme-color" content="${escapeHtmlAttr(themeColor)}">`,
    );
    lines.push(`<link rel="manifest" href="/site.webmanifest">`);
  }

  if (includeMsConfig) {
    lines.push(
      `<meta name="msapplication-TileColor" content="${escapeHtmlAttr(
        msTileColor,
      )}">`,
    );
    lines.push(
      `<meta name="msapplication-config" content="/browserconfig.xml">`,
    );
  }

  return lines.join("\n");
}

function escapeHtmlAttr(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ========================
   Utilities
======================== */
function parseSizeList(raw: string): number[] {
  const parts = String(raw || "")
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);

  const nums = parts
    .map((p) => Number(p))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.round(Math.abs(n)));

  return nums.length ? uniqSorted(nums) : [16, 24, 32, 48, 64, 128, 256];
}

function uniqSorted(nums: number[]) {
  const s = new Set<number>();
  for (const n of nums) if (Number.isFinite(n)) s.add(Math.round(n));
  return Array.from(s).sort((a, b) => a - b);
}

function ensureSvgHasXmlns(svg: string) {
  const hasSvg = /<svg\b/i.test(svg);
  if (!hasSvg) return `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  const hasXmlns = /<svg\b[^>]*\sxmlns\s*=\s*["'][^"']+["']/i.test(svg);
  if (hasXmlns) return svg;
  return svg.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`);
}

function sanitizeCssColor(input: string, fallback: string) {
  const s = String(input || "").trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
  return fallback;
}

function stripExt(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function safeFileName(name: string) {
  return (
    String(name || "")
      .replace(/[^\w\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "favicon"
  );
}

function downloadBytes(bytes: Uint8Array, filename: string, mime: string) {
  // make a defensive copy into a standalone ArrayBuffer slice (Safari friendliness)
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  const blob = new Blob([ab], { type: mime });

  const url = URL.createObjectURL(blob);

  // MUST be synchronous and attached to DOM for some browsers
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();

  // revoke later to avoid cutting off download in slower browsers
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function formatBytes(bytes: number) {
  if (!bytes || !Number.isFinite(bytes)) return "?";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function clampNum(v: number, lo: number, hi: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
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
        className="h-4 w-4 accent-[#0b2dff] shrink-0"
      />
      <span className="text-[13px] text-slate-700 min-w-0">{label}</span>
    </label>
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

function PreviewTile({
  label,
  src,
  size,
}: {
  label: string;
  src: string;
  size: number;
}) {
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <div className="px-3 py-2 text-[12px] text-slate-600 border-b border-slate-200 bg-slate-50">
        {label}×{label}
      </div>
      <div className="p-3">
        <div
          className="rounded-xl border border-slate-200 bg-white grid place-items-center overflow-hidden"
          style={{ width: "100%", aspectRatio: "1 / 1" }}
        >
          <img
            src={src}
            alt={`Preview ${label}`}
            width={size}
            height={size}
            style={{
              width: Math.min(160, size),
              height: Math.min(160, size),
              objectFit: "contain",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ========================
   Header / Footer
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
                href="/svg-to-png-converter"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                SVG to PNG
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
                href="/svg-flip-rotate-editor"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Flip & Rotate
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
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <a href="/" className="font-extrabold tracking-tight text-slate-900">
            i<span className="text-sky-600">🩵</span>SVG
          </a>

          <nav aria-label="Footer" className="text-sm">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-600">
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

function Breadcrumbs({
  crumbs,
}: {
  crumbs: Array<{ name: string; href: string }>;
}) {
  return (
    <div className="mb-4">
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
  const baseUrl = "https://ilovesvg.com";

  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Favicon Generator",
        item: `${baseUrl}/svg-favicon-generator`,
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
