import { useRef, useState } from "react";
import Icons from "~/client/assets/icons/Icons";

export default function DragArea({
  onPick,
  onDrop,
  MAX_UPLOAD_BYTES,
  MAX_MP,
  MAX_SIDE,
}: any) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <>
      {/* Limits helper */}
      {MAX_MP ? (
        <div className="mb-2 hidden gap-1 text-[13px] leading-5 text-slate-600 sm:flex">
          Limits: <b>{Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB</b> -{" "}
          <b>{MAX_MP} MP</b> - <b>{MAX_SIDE}px longest side</b> each max.
        </div>
      ) : (
        <div className="mt-3" />
      )}

      <div
        role="button"
        tabIndex={0}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          onDrop?.(e);
        }}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
        }}
        className={`group flex cursor-pointer items-center justify-center rounded-2xl border p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 ${
          isDragging
            ? "border-sky-400 bg-sky-100/80 shadow-[0_0_0_3px_rgba(14,165,233,0.12)]"
            : "border-sky-200 bg-sky-50/70 hover:border-sky-300 hover:bg-sky-50"
        }`}
      >
        <div
          className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-sm font-semibold text-slate-800 transition-all duration-200 sm:min-h-[7.5em] sm:px-6 sm:py-7 sm:text-lg ${
            isDragging
              ? "border-sky-500 bg-white/80"
              : "border-sky-400/80 bg-white/45 group-hover:border-sky-500 group-hover:bg-white/70"
          }`}
        >
          <span className="flex w-full items-center justify-center gap-2">
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
                isDragging
                  ? "border-sky-300 bg-sky-100 text-sky-700"
                  : "border-sky-200 bg-white text-sky-600 group-hover:border-sky-300 group-hover:bg-sky-100"
              }`}
              aria-hidden="true"
            >
              <Icons name="upload" size={28} />
            </span>
            Click or drag a file
          </span>
          <span className="mx-auto mt-2 hidden max-w-[42rem] text-center text-xs font-medium leading-5 text-slate-600 sm:flex">
            Supported image files are checked before conversion. Oversized
            uploads may be compressed on-device when possible; files are not
            stored after conversion.
          </span>

          <input
            ref={fileRef}
            id="file-inp"
            type="file"
            onChange={(e) => {
              onPick?.(e);
              // allow selecting the same file again
              e.currentTarget.value = "";
            }}
            className="hidden"
          />
        </div>
      </div>
    </>
  );
}
