import * as React from "react";

export type FullscreenPreviewImage = {
  id: string;
  label: string;
  src?: string | null;
  svg?: string | null;
  width?: number | null;
  height?: number | null;
  kind?: string;
};

export function FullscreenPreviewButton({
  onOpen,
}: {
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      aria-label="Preview full screen"
      title="Preview full screen"
      className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur cursor-pointer transition-colors hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
    >
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 3H5a2 2 0 0 0-2 2v3" />
        <path d="M16 3h3a2 2 0 0 1 2 2v3" />
        <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
        <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      </svg>
    </button>
  );
}

export function FullscreenOutputPreview<TItem>({
  items,
  activeIndex,
  setActiveIndex,
  getPreviewImage,
}: {
  items: readonly TItem[];
  activeIndex: number | null;
  setActiveIndex: (index: number | null) => void;
  getPreviewImage: (item: TItem, index: number) => FullscreenPreviewImage;
}) {
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const open = activeIndex !== null && activeIndex >= 0 && activeIndex < items.length;
  const safeIndex = open ? activeIndex : null;
  const currentItem = safeIndex === null ? null : items[safeIndex] ?? null;
  const preview = React.useMemo(
    () =>
      currentItem && safeIndex !== null
        ? getPreviewImage(currentItem, safeIndex)
        : null,
    [currentItem, getPreviewImage, safeIndex],
  );
  const previewSrc = React.useMemo(() => {
    if (!preview) return null;
    if (preview.src) return preview.src;
    if (preview.svg) {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.svg)}`;
    }
    return null;
  }, [preview]);
  const hasMultiple = items.length > 1;

  const close = React.useCallback(() => {
    setActiveIndex(null);
  }, [setActiveIndex]);

  const goToPrevious = React.useCallback(() => {
    if (!hasMultiple || safeIndex === null) return;
    setActiveIndex((safeIndex - 1 + items.length) % items.length);
  }, [hasMultiple, items.length, safeIndex, setActiveIndex]);

  const goToNext = React.useCallback(() => {
    if (!hasMultiple || safeIndex === null) return;
    setActiveIndex((safeIndex + 1) % items.length);
  }, [hasMultiple, items.length, safeIndex, setActiveIndex]);

  React.useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.setTimeout(() => dialogRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPrevious();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNext();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, goToNext, goToPrevious, open]);

  React.useEffect(() => {
    if (activeIndex !== null && (activeIndex < 0 || activeIndex >= items.length)) {
      setActiveIndex(null);
    }
  }, [activeIndex, items.length, setActiveIndex]);

  if (!open || !preview || !previewSrc || safeIndex === null) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] bg-slate-950/90 p-3 sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Full-screen output preview"
        tabIndex={-1}
        className="flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-slate-900 text-white shadow-2xl focus-visible:outline-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {preview.label}
            </div>
            <div className="text-xs text-slate-300">
              {safeIndex + 1} of {items.length}
              {preview.width && preview.height
                ? ` · ${Math.round(preview.width)} x ${Math.round(preview.height)} px`
                : ""}
              {preview.kind ? ` · ${preview.kind}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasMultiple ? (
              <>
                <button
                  type="button"
                  onClick={goToPrevious}
                  aria-label="Previous output"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white cursor-pointer hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <ArrowIcon direction="left" />
                </button>
                <button
                  type="button"
                  onClick={goToNext}
                  aria-label="Next output"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white cursor-pointer hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <ArrowIcon direction="right" />
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={close}
              aria-label="Close full-screen preview"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white cursor-pointer hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-800 p-3 sm:p-4">
          <div className="flex min-h-full items-center justify-center rounded-lg border border-white/10 bg-white/5 p-3 transparent-checkerboard">
            <img
              src={previewSrc}
              alt={preview.label}
              className="max-h-[calc(100vh-9rem)] max-w-full object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  const path = direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6";
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}
