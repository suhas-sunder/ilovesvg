import * as React from "react";
import { Link } from "react-router";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import { OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import {
  buildSvgSprite,
  SPRITE_LIMITS,
  SpriteInputError,
  spriteUseSnippet,
  type SpriteIcon,
  type SpriteResult,
} from "~/client/lib/converter/svgSprite";

const title = "SVG Sprite Generator - Combine SVG Icons | iLoveSVG";
const description = "Combine SVG icon files into one reusable symbol sprite. Preview each icon, download sprite.svg, and copy a use snippet. Files stay in your browser.";
const canonical = "https://www.ilovesvg.com/svg-sprite-generator";

export function meta() {
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
  ];
}

const button = "inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700";
const primary = `${button} bg-sky-800 text-white hover:bg-sky-900 disabled:bg-slate-300 disabled:text-slate-800`;
const secondary = `${button} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:text-slate-500`;
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";
const exampleGradient = (first: string, second: string) =>
  `<defs><linearGradient id="paint" x2="100%" y2="100%"><stop offset="0" stop-color="${first}"/><stop offset="1" stop-color="${second}"/></linearGradient></defs>`;
const EXAMPLES = [
  {
    name: "sunrise.svg",
    text: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -16 32 32"><title>Sunrise</title>${exampleGradient("#ffd166", "#e85d04")}<path fill="url(#paint)" d="M-14 4H14V12H-14Z M-9 1A9 9 0 0 1 9 1Z"/></svg>`,
  },
  {
    name: "mountains.svg",
    text: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="24"><title>Mountains</title>${exampleGradient("#9bf6d1", "#126978")}<path fill="url(#paint)" d="M1 22 13 4 23 16 29 9 39 22Z"/></svg>`,
  },
];

type State =
  | { kind: "empty" }
  | { kind: "reading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; sprite: SpriteResult; files: File[] };

function useObjectUrl(markup: string) {
  const [value, setValue] = React.useState<{ markup: string; url: string } | null>(null);
  React.useEffect(() => {
    if (!markup) {
      setValue(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
    setValue({ markup, url });
    return () => URL.revokeObjectURL(url);
  }, [markup]);
  return value?.markup === markup ? value.url : undefined;
}

export default function SvgSpriteGenerator() {
  const [state, setState] = React.useState<State>({ kind: "empty" });
  const [decorative, setDecorative] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const chooser = React.useRef<HTMLInputElement>(null);
  const snippetField = React.useRef<HTMLTextAreaElement>(null);
  const markupField = React.useRef<HTMLTextAreaElement>(null);
  const errorText = React.useRef<HTMLParagraphElement>(null);
  const operation = React.useRef(0);
  const copyOperation = React.useRef(0);
  const sprite = state.kind === "ready" ? state.sprite : null;
  const download = useObjectUrl(sprite?.markup || "");
  const selected = sprite?.icons.find((item) => item.id === selectedId) || sprite?.icons[0];
  const snippet = selected ? spriteUseSnippet(selected, decorative) : "";
  React.useLayoutEffect(() => () => { operation.current++; copyOperation.current++; }, []);
  React.useEffect(() => {
    if (state.kind === "error") errorText.current?.focus();
  }, [state]);

  function invalidate() {
    copyOperation.current++;
    setNotice("");
    setSelectedId("");
    return ++operation.current;
  }

  async function loadFiles(selection: File[] | FileList) {
    const current = invalidate();
    if (!selection.length) {
      setState({ kind: "empty" });
      return;
    }
    if (selection.length > SPRITE_LIMITS.files) {
      setState({ kind: "error", message: "Choose no more than 12 SVG files." });
      return;
    }
    const files = [...selection];
    setState({ kind: "reading" });
    try {
      let total = 0;
      for (const [index, file] of files.entries()) {
        if (!/\.svg$/i.test(file.name)) throw new SpriteInputError("Choose a file ending in .svg.", index);
        if (file.size > SPRITE_LIMITS.fileBytes) throw new SpriteInputError("This file exceeds 128 KiB.", index);
        total += file.size;
      }
      if (total > SPRITE_LIMITS.batchBytes) throw new SpriteInputError("The selected SVGs exceed 512 KiB in total.");
      const decoder = new TextDecoder("utf-8", { fatal: true });
      const sources = [];
      for (const [index, file] of files.entries()) {
        try {
          const buffer = await file.arrayBuffer();
          if (operation.current !== current) return;
          sources.push({ name: file.name, text: decoder.decode(buffer) });
        } catch {
          throw new SpriteInputError("This file could not be read as UTF-8 SVG. Re-export it as UTF-8 and try again.", index);
        }
      }
      if (operation.current === current) setState({ kind: "ready", sprite: buildSvgSprite(sources), files });
    } catch (error) {
      if (operation.current !== current) return;
      if (error instanceof SpriteInputError) {
        const file = error.fileIndex === undefined ? undefined : files[error.fileIndex];
        const fileName = file?.name.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ").slice(0, 100);
        setState({ kind: "error", message: fileName ? `File ${(error.fileIndex ?? 0) + 1} (${fileName}): ${error.message}` : error.message });
      } else {
        setState({ kind: "error", message: "Could not generate a sprite. Try fewer SVGs or reload this page." });
      }
    }
  }

  function loadExamples() {
    const files = EXAMPLES.map(({ name, text }) => new File([text], name, { type: "image/svg+xml" }));
    void loadFiles(files);
  }

  function clear() {
    invalidate();
    setState({ kind: "empty" });
    setDecorative(false);
    chooser.current?.focus();
  }

  function remove(index: number) {
    if (state.kind !== "ready") return;
    chooser.current?.focus();
    void loadFiles(state.files.filter((_, i) => i !== index));
  }

  async function copyText(text: string, label: string, field: React.RefObject<HTMLTextAreaElement | null>) {
    if (!text) return;
    const current = ++copyOperation.current;
    try {
      await navigator.clipboard.writeText(text);
      if (copyOperation.current === current) setNotice(`${label} copied.`);
    } catch {
      if (copyOperation.current !== current) return;
      const target = field.current;
      const details = target?.closest("details");
      if (details) details.open = true;
      target?.focus();
      target?.select();
      setNotice(`${label} selected. Use your device’s copy command.`);
    }
  }

  function updateSnippet() {
    copyOperation.current++;
    setNotice("");
  }

  return (
    <>
      <main className="mx-auto max-w-[1180px] px-4 py-8 sm:py-12">
        <header className="mb-7 max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-sky-950 sm:text-5xl">SVG Sprite Generator</h1>
          <p className="mt-3 text-base leading-7 text-slate-700">
            Combine SVG icons into one file of reusable symbols. Preview the icons, download the sprite, and copy the HTML for the icon you want to use.
          </p>
        </header>

        {/* PostHog autocapture and replay both honor this class. The editor contains private filenames and previews. */}
        <div className="ph-no-capture grid min-w-0 gap-5">
          <section aria-labelledby="sprite-input" className={card}>
            <h2 id="sprite-input" className="text-xl font-bold text-slate-900">Choose SVG files</h2>
            <p id="sprite-limits" className="mt-2 text-sm leading-6 text-slate-700">
              Choose 1–12 files, up to 128 KiB each and 512 KiB total. Your files stay in this browser.
            </p>
            <div
              className={`mt-4 rounded-xl border-2 border-dashed p-4 sm:p-6 ${dragging ? "border-sky-700 bg-sky-100" : "border-sky-300 bg-sky-50"}`}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("Files")) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  setDragging(true);
                }
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                if (event.dataTransfer.files.length) void loadFiles(event.dataTransfer.files);
              }}
            >
              <label htmlFor="sprite-files" className="mb-2 block text-sm font-semibold text-slate-900">Select SVG icon files or drop them here</label>
              <input
                ref={chooser}
                id="sprite-files"
                type="file"
                accept=".svg,image/svg+xml"
                multiple
                aria-describedby={state.kind === "error" ? "sprite-limits sprite-error" : "sprite-limits"}
                aria-invalid={state.kind === "error" || undefined}
                className="block w-full max-w-full rounded-lg text-sm text-slate-800 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-sky-800 file:px-3 file:py-2 file:font-semibold file:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                onChange={(event) => {
                  const files = event.currentTarget.files;
                  if (files?.length) void loadFiles(files);
                  event.currentTarget.value = "";
                }}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={secondary} onClick={loadExamples}>Try two examples</button>
              {state.kind !== "empty" && <button type="button" className={secondary} onClick={clear}>Clear selection</button>}
            </div>
            <div role="status" className="mt-3 text-sm text-slate-700">
              {state.kind === "reading" && "Reading SVG files…"}
              {sprite && `${sprite.icons.length} ${sprite.icons.length === 1 ? "symbol" : "symbols"} ready · ${(sprite.bytes / 1024).toFixed(1)} KiB`}
            </div>
            {state.kind === "error" && <p id="sprite-error" ref={errorText} tabIndex={-1} className="mt-3 break-words rounded-lg border border-red-300 bg-red-50 p-3 text-sm leading-6 text-red-900">{state.message}</p>}
          </section>

          {sprite && state.kind === "ready" && (
            <section aria-labelledby="sprite-output" className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="sprite-output" className="text-xl font-bold text-slate-900">Your sprite</h2>
                {download && <a className={primary} href={download} download="sprite.svg">Download sprite.svg</a>}
              </div>
              <ul className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sprite.icons.map((icon, index) => <IconPreview key={icon.id} icon={icon} onRemove={() => remove(index)} />)}
              </ul>
              <div className="mt-6 border-t border-slate-200 pt-5">
                <h3 className="text-lg font-bold text-slate-900">Use the sprite in HTML</h3>
                <p id="sprite-snippet-help" className="mt-1 text-sm leading-6 text-slate-700">
                  Paste the sprite markup once into the HTML body, then paste an icon snippet wherever you need it. Keeping the definitions in the same document preserves gradients across browsers. Combine all the icons for a page in one sprite to avoid duplicate IDs. The downloaded file contains only definitions, so it appears blank on its own.
                </p>
                <button type="button" className={`${secondary} mt-3`} onClick={() => void copyText(sprite.markup, "Sprite markup", markupField)}>Copy sprite markup</button>
                <details className="mt-2">
                  <summary className="min-h-11 w-fit cursor-pointer content-center rounded text-sm font-semibold text-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">Show sprite markup</summary>
                  <label htmlFor="sprite-markup" className="sr-only">Sprite markup</label>
                  <textarea
                    ref={markupField}
                    id="sprite-markup"
                    readOnly
                    spellCheck={false}
                    rows={4}
                    value={sprite.markup}
                    className="mt-1 w-full rounded-lg border border-slate-400 bg-slate-50 p-3 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-700"
                  />
                </details>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div className="grid min-w-0 gap-1 text-sm font-semibold text-slate-800">
                    <label htmlFor="sprite-symbol">Symbol</label>
                    <select
                      id="sprite-symbol"
                      value={selected?.id}
                      className="min-h-11 max-w-full rounded-lg border border-slate-400 bg-white px-3"
                      onChange={(event) => { setSelectedId(event.currentTarget.value); updateSnippet(); }}
                    >
                      {sprite.icons.map((icon) => <option key={icon.id} value={icon.id}>#{icon.id}</option>)}
                    </select>
                  </div>
                  <label className="inline-flex min-h-11 items-center gap-2 self-end text-sm text-slate-800">
                    <input type="checkbox" className="size-4 accent-sky-800" checked={decorative} onChange={(event) => { setDecorative(event.currentTarget.checked); updateSnippet(); }} />
                    Decorative icon
                  </label>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  For a meaningful icon, edit the label in your page to describe its purpose. Choose decorative when nearby text already describes the same thing.
                </p>
                <label htmlFor="sprite-snippet" className="mt-3 block text-sm font-semibold text-slate-800">HTML snippet</label>
                <textarea
                  ref={snippetField}
                  id="sprite-snippet"
                  readOnly
                  spellCheck={false}
                  rows={4}
                  value={snippet}
                  aria-describedby="sprite-snippet-help"
                  className="mt-1 w-full rounded-lg border border-slate-400 bg-slate-50 p-3 font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-700"
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button type="button" className={secondary} onClick={() => void copyText(snippet, "Snippet", snippetField)}>Copy HTML snippet</button>
                  <span role="status" className="text-sm text-slate-700">{notice}</span>
                </div>
              </div>
            </section>
          )}
        </div>

        <section aria-labelledby="sprite-support" className="mt-8 max-w-3xl">
          <h2 id="sprite-support" className="text-xl font-bold text-slate-900">Which SVGs can I combine?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Use UTF-8 SVG icons made from paths, basic shapes and groups, with color attributes or gradients defined in the same file. Each file needs a <code>viewBox</code> or explicit pixel dimensions. The tool keeps the viewBox and gives every symbol and internal reference a unique ID. Symbols clip artwork to that viewBox, so include the whole icon inside its bounds before export.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Styles, dashed strokes, fonts and text artwork, embedded images, external links, masks, clip paths, filters, animation and reused artwork with <code>&lt;use&gt;</code> are unsupported. In your design tool, convert text and dashed strokes to outlines and flatten effects before export. If a file fails, fix it or select the batch again without it.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Need to inspect a file first? Open the <Link to="/svg-preview-viewer" className="font-semibold text-sky-800 underline">SVG viewer</Link>. For an HTML or CSS snippet from a single file, try the <Link to="/svg-embed-code-generator" className="font-semibold text-sky-800 underline">SVG embed code generator</Link>.
          </p>
        </section>
      </main>
      <OtherToolsLinks />
      <SiteFooter />
    </>
  );
}

function IconPreview({ icon, onRemove }: { icon: SpriteIcon; onRemove: () => void }) {
  const preview = useObjectUrl(icon.preview);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [preview]);
  return (
    <li className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="grid min-h-28 place-items-center rounded-lg border border-slate-200 bg-white">
        {preview && !failed && <img src={preview} alt={icon.label} width={96} height={96} onError={() => setFailed(true)} />}
        {failed && <span className="p-2 text-sm text-slate-700">This browser could not show the preview.</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <code className="min-w-0 break-all text-sm font-semibold text-slate-900">#{icon.id}</code>
        <button type="button" aria-label={`Remove ${icon.id}`} className={secondary} onClick={onRemove}>Remove</button>
      </div>
      <p className="mt-1 break-all text-xs text-slate-700">viewBox: {icon.viewBox}</p>
    </li>
  );
}
