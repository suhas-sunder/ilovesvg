export default function DragArea({ onPick, onDrop, MAX_UPLOAD_BYTES, MAX_MP, MAX_SIDE }: any) {
  return (
    <>
      {/* Limits helper */}
      <div className="text-[13px] text-slate-600 mb-2 hidden sm:flex gap-1">
        Limits: <b>{MAX_UPLOAD_BYTES / (1024 * 1024)} MB</b> •{" "}
        <b>{MAX_MP} MP</b> • <b>{MAX_SIDE}px longest side</b> each max.
      </div>
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => document.getElementById("file-inp")?.click()}
        className="border border-dashed border-[#c8d3ea] rounded-xl p-4 text-center cursor-pointer sm:min-h-[8em] flex justify-center items-center bg-[#f9fbff] hover:bg-[#f2f6ff] focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <div className="text-sm sm:text-lg text-slate-600 font-semibold">
          Click, drag & drop, or paste a PNG/JPEG
          <div className="text-sky-700 my-2 text-center text-xs hidden sm:flex">
            Live preview: fast ≤10 MB, throttled ≤25 MB. Files over 30 MB are
            auto-compressed on-device (if possible).
          </div>
        </div>
        <input
          id="file-inp"
          type="file"
          accept="image/png,image/jpeg"
          onChange={onPick}
          className="hidden"
        />
      </div>
    </>
  );
}
