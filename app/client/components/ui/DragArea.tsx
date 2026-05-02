import { useRef } from "react";
import Icons from "~/client/assets/icons/Icons";

export default function DragArea({
  onPick,
  onDrop,
  MAX_UPLOAD_BYTES,
  MAX_MP,
  MAX_SIDE,
}: any) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      {/* Limits helper */}
      {MAX_MP ? (
        <div className="mb-2 hidden gap-1 text-[13px] leading-5 text-slate-600 sm:flex">
          Limits: <b>{Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB</b> •{" "}
          <b>{MAX_MP} MP</b> • <b>{MAX_SIDE}px longest side</b> each max.
        </div>
      ) : (
        <div className="mt-3" />
      )}

      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onDrop?.(e);
        }}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
        }}
        className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-sky-200 bg-sky-50/60 p-4 text-center transition-colors hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-200 sm:min-h-[7.5em]"
      >
        <div className="text-sm font-semibold text-slate-700 sm:text-lg">
          <span className="flex w-full items-center justify-center gap-2">
            <Icons name="upload" size={30} className="text-sky-600" />
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
