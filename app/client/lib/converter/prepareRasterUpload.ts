/** Header-only admission checks: never decode a raster just to discover its size. */
export type RasterHeader = { width: number; height: number; mime: string; hasExif?: true };
const MIB = 1024 * 1024;
const HEADER_BYTES = 256 * 1024;
const MAX_ORIGINAL_BYTES = 64 * MIB;
const UNSUPPORTED = "Choose a PNG, JPEG, or WebP image. For iPhone HEIC or ProRAW/DNG photos, export a JPEG or PNG first.";
let normalizationInProgress = false;

export function parseRasterHeader(bytes: Uint8Array): RasterHeader {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  let width = 0, height = 0, mime = "", hasExif = false;
  if (bytes.length >= 24 && text(0, 8) === "\x89PNG\r\n\x1a\n" && text(12, 16) === "IHDR") {
    width = view.getUint32(16); height = view.getUint32(20); mime = "image/png";
  } else if (bytes.length >= 12 && text(0, 4) === "RIFF" && text(8, 12) === "WEBP") {
    mime = "image/webp";
    const kind = text(12, 16);
    const u24 = (offset: number) => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
    if (kind === "VP8X" && bytes.length >= 30) {
      width = u24(24) + 1; height = u24(27) + 1;
      hasExif = Boolean(bytes[20] & 0x08);
    } else if (kind === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
    } else if (kind === "VP8 " && bytes.length >= 30 && text(23, 26) === "\x9d\x01\x2a") {
      width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff;
    }
  } else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    mime = "image/jpeg";
    let orientation = 1;
    for (let offset = 2; offset + 4 <= bytes.length;) {
      if (bytes[offset] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (marker === 0xe1 && length >= 16 && text(offset + 2, offset + 8) === "Exif\0\0") {
        const tiff = offset + 8;
        const little = text(tiff, tiff + 2) === "II";
        if ((little || text(tiff, tiff + 2) === "MM") && view.getUint16(tiff + 2, little) === 42) {
          const directory = tiff + view.getUint32(tiff + 4, little);
          if (directory >= tiff + 8 && directory + 2 <= offset + length) {
            const count = Math.min(view.getUint16(directory, little), 256);
            for (let i = 0; i < count; i++) {
              const entry = directory + 2 + i * 12;
              if (entry + 12 > offset + length) break;
              if (view.getUint16(entry, little) === 0x112 && view.getUint16(entry + 2, little) === 3 && view.getUint32(entry + 4, little) === 1) {
                orientation = view.getUint16(entry + 8, little);
              }
            }
          }
        }
      }
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) {
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5);
        break;
      }
      offset += length;
    }
    if (orientation >= 5 && orientation <= 8) [width, height] = [height, width];
  } else {
    throw new Error(UNSUPPORTED);
  }
  if (!width || !height || !Number.isSafeInteger(width * height)) {
    throw new Error("Could not safely read image dimensions. Export a fresh PNG or JPEG and try again.");
  }
  return { width, height, mime, ...(hasExif ? { hasExif: true as const } : {}) };
}

export async function readRasterHeader(file: Blob): Promise<RasterHeader> {
  if (!file.size || file.size > MAX_ORIGINAL_BYTES) {
    throw new Error("This image is too large to prepare safely. Resize or export it below 64 MB before uploading.");
  }
  const prefix = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  if (prefix[0] === 0xff && prefix[1] === 0xd8) {
    return readJpegHeader(file, prefix);
  }
  return parseRasterHeader(prefix);
}

async function readJpegHeader(file: Blob, prefix: Uint8Array): Promise<RasterHeader> {
  // JPEG metadata can precede dimensions by megabytes. Skip its payload by
  // declared segment length; charge only bytes actually read to the header budget.
  let bytesRead = prefix.byteLength;
  let reads = 0;
  const read = async (offset: number, length: number) => {
    if (++reads > 2048) throw new Error("This image has too much metadata to inspect safely. Export a fresh PNG or JPEG and try again.");
    if (offset < 0 || length < 0 || offset + length > file.size) {
      throw new Error("Could not safely read image dimensions. Export a fresh PNG or JPEG and try again.");
    }
    if (offset + length <= prefix.byteLength) return prefix.subarray(offset, offset + length);
    if (bytesRead + length > HEADER_BYTES) {
      throw new Error("This image has too much metadata to inspect safely. Export a fresh PNG or JPEG and try again.");
    }
    bytesRead += length;
    return new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
  };
  const exif: Uint8Array[] = [];
  let dimensions: Uint8Array | null = null;
  let offset = 2;
  let fillBytes = 0;
  for (let segment = 0; segment < 512 && offset + 2 <= file.size; segment++) {
    let marker = await read(offset, 2);
    if (marker[0] !== 0xff) break;
    // Legal fill bytes must also be bounded independently of source file size.
    while (marker[1] === 0xff) {
      if (++fillBytes > 512) throw new Error("This image has too much metadata to inspect safely. Export a fresh PNG or JPEG and try again.");
      marker = await read(++offset, 2);
    }
    const kind = marker[1];
    if (kind === 0xda || kind === 0xd9) break;
    if (kind === 0x01 || (kind >= 0xd0 && kind <= 0xd7)) { offset += 2; continue; }
    const sizeBytes = await read(offset + 2, 2);
    const size = sizeBytes[0] * 256 + sizeBytes[1];
    if (size < 2 || offset + 2 + size > file.size) break;
    if (kind === 0xe1 && size >= 8) {
      const signature = await read(offset + 4, 6);
      if (String.fromCharCode(...signature) === "Exif\0\0") exif.push(await read(offset, size + 2));
    }
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(kind)) {
      if (dimensions) break;
      dimensions = await read(offset, size + 2);
    }
    offset += size + 2;
  }
  if (!dimensions) throw new Error("Could not safely read image dimensions. Export a fresh PNG or JPEG and try again.");
  // Reuse the bounds-checked EXIF/dimension parser without retaining metadata in
  // the returned result or changing the original image. EXIF after SOF is honored.
  const segments = [new Uint8Array([0xff, 0xd8]), ...exif, dimensions];
  const header = new Uint8Array(segments.reduce((sum, part) => sum + part.byteLength, 0));
  let cursor = 0;
  for (const part of segments) { header.set(part, cursor); cursor += part.byteLength; }
  return parseRasterHeader(header);
}

export function planRasterNormalization(header: RasterHeader, bytes: number, mobile: boolean) {
  const { width, height } = header;
  if (bytes > MAX_ORIGINAL_BYTES || bytes <= 0) throw new Error("Resize the original image below 64 MB before uploading.");
  if (bytes <= 30 * MIB && width <= 8000 && height <= 8000 && width * height <= 30_000_000) return null;
  const targetPixels = mobile ? 6_000_000 : 12_000_000;
  const scale = Math.min(1, 8000 / Math.max(width, height), Math.sqrt(targetPixels / (width * height)));
  const target = { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
  // A bitmap, canvas, encoder working copy, and compressed input may coexist.
  // Resize options do not guarantee bounded decode memory on Safari, so charge the full source.
  const estimatedBytes = width * height * 4 + target.width * target.height * 8 + bytes * 2;
  if (width * height > (mobile ? 32_000_000 : 48_000_000) || Math.max(width, height) > 32767 || estimatedBytes > (mobile ? 192 : 384) * MIB) {
    throw new Error("This image needs too much memory to resize safely on this device. Resize it in your photo editor, then upload the smaller PNG or JPEG.");
  }
  return target;
}

export async function prepareRasterUpload(file: File, onPreparing?: () => void): Promise<{ file: File; header: RasterHeader; normalized: boolean }> {
  const header = await readRasterHeader(file);
  const mobile = typeof navigator !== "undefined" && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const target = planRasterNormalization(header, file.size, mobile);
  if (!target) return { file, header, normalized: false };
  if (header.mime === "image/webp" && header.hasExif) {
    // Browsers can ignore WebP EXIF orientation. Re-encoding would discard that
    // metadata and silently change its meaning; leave ordinary inputs intact.
    throw new Error("This WebP contains metadata that cannot be preserved safely while resizing in your browser. Export it as PNG or JPEG with the correct orientation, then upload it again.");
  }
  if (normalizationInProgress) throw new Error("Another large image is being prepared. Wait for it to finish, then select this image again.");
  const canvas = document.createElement("canvas");
  normalizationInProgress = true;
  let image: ImageBitmap | HTMLImageElement | null = null;
  let url: string | null = null;
  try {
    onPreparing?.();
    if (typeof createImageBitmap === "function") {
      image = await createImageBitmap(file, { imageOrientation: "from-image" });
    } else {
      url = URL.createObjectURL(file);
      const element = new Image();
      element.src = url;
      await element.decode();
      image = element;
    }
    const actualWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
    const actualHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
    if (actualWidth !== header.width || actualHeight !== header.height) throw new Error("The browser decoded different image dimensions. Export a PNG or JPEG and try again.");
    // PNG keeps transparency and avoids adding JPEG artifacts. Never flatten alpha to black.
    for (let attempt = 0; attempt < 4; attempt++) {
      canvas.width = Math.max(1, Math.floor(target.width * 0.75 ** attempt));
      canvas.height = Math.max(1, Math.floor(target.height * 0.75 ** attempt));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image resizing is unavailable. Resize the image in your photo editor and try again.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not prepare the image. Resize it in your photo editor and try again.")), "image/png"));
      if (blob.size <= 30 * MIB) {
        const normalizedFile = new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "image"}.png`, { type: "image/png", lastModified: file.lastModified });
        return { file: normalizedFile, header: { width: canvas.width, height: canvas.height, mime: "image/png" }, normalized: true };
      }
    }
    throw new Error("The prepared image is still too large. Resize it in your photo editor and try again.");
  } finally {
    if (image && "close" in image) image.close();
    if (image instanceof HTMLImageElement) image.src = "";
    if (url) URL.revokeObjectURL(url);
    canvas.width = canvas.height = 0;
    normalizationInProgress = false;
  }
}
