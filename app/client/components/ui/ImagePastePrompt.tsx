import { useRef, useState, type ClipboardEvent } from "react";

/** Scoped to the input panel: never read the clipboard or intercept editor text. */
export function useImagePaste({
  onFile,
  onError,
  maxBytes,
}: {
  onFile: (file: File) => void | Promise<void>;
  onError: (message: string) => void;
  maxBytes: number;
}) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  function onPaste(event: ClipboardEvent<HTMLElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest(
      'textarea, select, input:not([type="file"]):not([type="button"]), [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
    )) return;
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    // Ordinary text paste and clipboard formats without a file stay native.
    if (!files.length) return;
    panelRef.current = event.currentTarget;
    event.preventDefault();
    setPendingFile(null);
    if (files.length !== 1) {
      onError("Paste one image at a time, or choose files for a batch after conversion.");
      return;
    }
    const file = files[0];
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      onError("Clipboard images must be PNG, JPG, or WebP. Export other formats to one of these, then choose the file.");
      return;
    }
    if (!file.size || file.size > maxBytes) {
      onError(`Paste a non-empty image up to ${Math.round(maxBytes / 1024 / 1024)} MB, or choose a smaller file.`);
      return;
    }
    setPendingFile(file);
  }
  return {
    pendingFile,
    onPaste,
    clear: () => setPendingFile(null),
    discard: () => {
      panelRef.current?.focus();
      setPendingFile(null);
    },
    confirm: () => {
      if (!pendingFile) return;
      const file = pendingFile;
      panelRef.current?.focus();
      setPendingFile(null);
      void onFile(file);
    },
  };
}

export function ImagePastePrompt({
  paste,
  requiresManualConversion = false,
}: {
  paste: ReturnType<typeof useImagePaste>;
  requiresManualConversion?: boolean;
}) {
  return paste.pendingFile ? (
    <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-slate-800">
      <p role="status" className="m-0 leading-5">
        Image pasted ({Math.max(1, Math.round(paste.pendingFile.size / 1024))} KB).
        {" "}
        {requiresManualConversion
          ? "Use the pasted image, then click Convert to SVG when you’re ready."
          : "Your current settings will be used after you confirm."}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={paste.confirm} className="min-h-11 rounded-lg bg-sky-700 px-3 py-2 font-semibold text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
          {requiresManualConversion ? "Use pasted image" : "Convert pasted image"}
        </button>
        <button type="button" onClick={paste.discard} className="min-h-11 rounded-lg border border-sky-200 bg-white px-3 py-2 font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
          Discard pasted image
        </button>
      </div>
    </div>
  ) : (
    <p className="mt-2 mb-0 text-center text-xs leading-5 text-slate-600">
      Or focus this tool and paste a PNG, JPG, or WebP image (Ctrl+V / ⌘V).
      Clipboard image support varies by browser; you can always choose a file.
    </p>
  );
}
