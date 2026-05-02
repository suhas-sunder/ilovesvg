export type SafeErrorCode =
  | "INVALID_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "IMAGE_TOO_LARGE"
  | "SVG_UNSAFE"
  | "SETTINGS_INVALID"
  | "RATE_LIMITED"
  | "SERVER_BUSY"
  | "CONVERSION_TIMEOUT"
  | "CONVERSION_FAILED";

export type BackendRateLimits = {
  perMinute: number;
  perFiveMinutes: number;
  perHour: number;
  perDay: number;
};

export const PAGE_RATE_LIMITS: BackendRateLimits = {
  perMinute: 120,
  perFiveMinutes: 400,
  perHour: 1500,
  perDay: 3000,
};

export const HEAVY_BACKEND_RATE_LIMITS: BackendRateLimits = {
  perMinute: 60,
  perFiveMinutes: 180,
  perHour: 700,
  perDay: 1500,
};

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_MULTIPART_BYTES = 16 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 1;
export const MAX_IMAGE_PIXELS = 24_000_000;
export const MAX_SVG_BYTES = 4 * 1024 * 1024;
export const MAX_SVG_ELEMENTS = 25_000;
export const MAX_SVG_PATH_COMMANDS = 250_000;
export const MAX_OUTPUT_SVG_BYTES = 8 * 1024 * 1024;

type RateLimitWindowName = "minute" | "fiveMinutes" | "hour" | "day";
type RateLimitWindowState = { count: number; resetAt: number };
type RateLimitRecord = Record<RateLimitWindowName, RateLimitWindowState>;

export type BackendRateLimitResult =
  | { allowed: true; headers: Headers }
  | {
      allowed: false;
      headers: Headers;
      retryAfterSeconds: number;
      retryAfterText: string;
    };

const WINDOW_DEFS: Array<{
  name: RateLimitWindowName;
  ms: number;
  limitKey: keyof BackendRateLimits;
  limitHeader: string;
  remainingHeader: string;
}> = [
  {
    name: "minute",
    ms: 60 * 1000,
    limitKey: "perMinute",
    limitHeader: "X-RateLimit-Limit-Minute",
    remainingHeader: "X-RateLimit-Remaining-Minute",
  },
  {
    name: "fiveMinutes",
    ms: 5 * 60 * 1000,
    limitKey: "perFiveMinutes",
    limitHeader: "X-RateLimit-Limit-Five-Minutes",
    remainingHeader: "X-RateLimit-Remaining-Five-Minutes",
  },
  {
    name: "hour",
    ms: 60 * 60 * 1000,
    limitKey: "perHour",
    limitHeader: "X-RateLimit-Limit-Hour",
    remainingHeader: "X-RateLimit-Remaining-Hour",
  },
  {
    name: "day",
    ms: 24 * 60 * 60 * 1000,
    limitKey: "perDay",
    limitHeader: "X-RateLimit-Limit-Day",
    remainingHeader: "X-RateLimit-Remaining-Day",
  },
];

function getRateLimitStore(): Map<string, RateLimitRecord> {
  const g = globalThis as any;
  if (!g.__ilovesvg_backend_rate_limits) {
    g.__ilovesvg_backend_rate_limits = new Map<string, RateLimitRecord>();
  }
  return g.__ilovesvg_backend_rate_limits as Map<string, RateLimitRecord>;
}

function createFreshRateLimitRecord(now: number): RateLimitRecord {
  return {
    minute: { count: 0, resetAt: now + 60 * 1000 },
    fiveMinutes: { count: 0, resetAt: now + 5 * 60 * 1000 },
    hour: { count: 0, resetAt: now + 60 * 60 * 1000 },
    day: { count: 0, resetAt: now + 24 * 60 * 60 * 1000 },
  };
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function normalizeKeyPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "_")
    .slice(0, 160);
}

function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

export function checkBackendConversionRateLimit(
  request: Request,
  routeSlug: string,
  actionName: string,
  limits: BackendRateLimits = PAGE_RATE_LIMITS,
): BackendRateLimitResult {
  const now = Date.now();
  const key = [
    normalizeKeyPart(getClientIp(request)),
    normalizeKeyPart(request.headers.get("user-agent") || "unknown"),
    normalizeKeyPart(routeSlug),
    normalizeKeyPart(actionName),
  ].join(":");
  const store = getRateLimitStore();
  const record = store.get(key) ?? createFreshRateLimitRecord(now);

  for (const def of WINDOW_DEFS) {
    const state = record[def.name];
    if (now >= state.resetAt) {
      state.count = 0;
      state.resetAt = now + def.ms;
    }
  }

  const headers = new Headers();
  for (const def of WINDOW_DEFS) {
    const limit = limits[def.limitKey];
    const state = record[def.name];
    headers.set(def.limitHeader, String(limit));
    headers.set(def.remainingHeader, String(Math.max(0, limit - state.count)));
  }

  const exceeded = WINDOW_DEFS.filter(
    (def) => record[def.name].count >= limits[def.limitKey],
  );
  if (exceeded.length > 0) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        Math.min(...exceeded.map((def) => record[def.name].resetAt - now)) /
          1000,
      ),
    );
    headers.set("Retry-After", String(retryAfterSeconds));
    store.set(key, record);
    return {
      allowed: false,
      headers,
      retryAfterSeconds,
      retryAfterText: formatRetryAfter(retryAfterSeconds),
    };
  }

  for (const def of WINDOW_DEFS) {
    record[def.name].count += 1;
  }
  for (const def of WINDOW_DEFS) {
    const limit = limits[def.limitKey];
    const state = record[def.name];
    headers.set(def.remainingHeader, String(Math.max(0, limit - state.count)));
  }
  store.set(key, record);
  return { allowed: true, headers };
}

export function createRateLimitedResponse(
  rateLimit: Extract<BackendRateLimitResult, { allowed: false }>,
): Response {
  const message = `Too many conversions from this connection. Please try again in ${rateLimit.retryAfterText}.`;
  return new Response(
    JSON.stringify({
      ok: false,
      code: "RATE_LIMITED",
      message,
      error: message,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      retryAfterMs: rateLimit.retryAfterSeconds * 1000,
    }),
    {
      status: 429,
      headers: withJsonHeaders(rateLimit.headers),
    },
  );
}

export function createSafeErrorResponse(
  code: SafeErrorCode,
  message: string,
  status = 400,
  headers?: HeadersInit,
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      code,
      message: safeErrorMessage(message),
      error: safeErrorMessage(message),
    }),
    {
      status,
      headers: withJsonHeaders(headers),
    },
  );
}

export function validateSameOrigin(request: Request): Response | null {
  if (request.method.toUpperCase() !== "POST") return null;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const expected = getExpectedOrigin(request);

  if (origin && !sameOrigin(origin, expected)) {
    return createSafeErrorResponse(
      "SETTINGS_INVALID",
      "This conversion request must come from the same site.",
      403,
    );
  }

  if (!origin && referer && !sameOrigin(referer, expected)) {
    return createSafeErrorResponse(
      "SETTINGS_INVALID",
      "This conversion request must come from the same site.",
      403,
    );
  }

  return null;
}

export function validateContentLength(
  request: Request,
  maxBytes: number,
  message = "Upload too large for conversion. Please resize and try again.",
): Response | null {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > maxBytes) {
    return createSafeErrorResponse("FILE_TOO_LARGE", message, 413);
  }
  return null;
}

export function safeUploadFilename(name: string, fallback = "upload"): string {
  const cleaned = String(name || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

export function getFileExtension(name: string): string {
  const safe = safeUploadFilename(name).toLowerCase();
  const dot = safe.lastIndexOf(".");
  return dot >= 0 ? safe.slice(dot + 1).replace(/[^a-z0-9]+/g, "") : "";
}

export function countUploadedFiles(form: FormData): number {
  let count = 0;
  for (const value of form.values()) {
    if (typeof value !== "string") count += 1;
  }
  return count;
}

export function validateMultipartFileCount(
  form: FormData,
  maxFiles = MAX_FILES_PER_REQUEST,
): Response | null {
  if (countUploadedFiles(form) > maxFiles) {
    return createSafeErrorResponse(
      "INVALID_FILE",
      `Please upload only ${maxFiles} file${maxFiles === 1 ? "" : "s"} at a time.`,
      400,
    );
  }
  return null;
}

export function validateUploadedFileBasics(
  file: File,
  options: {
    allowedMimeTypes: Iterable<string>;
    allowedExtensions?: Iterable<string>;
    maxBytes: number;
    label?: string;
  },
): Response | null {
  const allowedMimeTypes = new Set(
    [...options.allowedMimeTypes].map((type) => type.toLowerCase()),
  );
  const allowedExtensions = new Set(
    options.allowedExtensions
      ? [...options.allowedExtensions].map((ext) =>
          ext.toLowerCase().replace(/^\./, ""),
        )
      : mimeTypesToExtensions(allowedMimeTypes),
  );
  const label = options.label || "supported image";
  const size = Number(file.size || 0);
  const type = String(file.type || "").toLowerCase();
  const extension = getFileExtension(file.name || "");

  if (!size) {
    return createSafeErrorResponse("INVALID_FILE", "The uploaded file is empty.", 400);
  }
  if (size > options.maxBytes) {
    return createSafeErrorResponse(
      "FILE_TOO_LARGE",
      `File too large. Max ${Math.round(options.maxBytes / (1024 * 1024))} MB per file.`,
      413,
    );
  }
  if (!type || !allowedMimeTypes.has(type)) {
    return createSafeErrorResponse("UNSUPPORTED_TYPE", `Please upload a ${label}.`, 415);
  }
  if (!extension || !allowedExtensions.has(extension)) {
    return createSafeErrorResponse("UNSUPPORTED_TYPE", `Please upload a ${label}.`, 415);
  }
  return null;
}

export function validateFileSignature(
  input: Buffer,
  file: File,
  allowedMimeTypes: Iterable<string>,
): Response | null {
  const detected = detectFileSignature(input);
  const type = String(file.type || "").toLowerCase();
  const extension = getFileExtension(file.name || "");
  const allowed = new Set([...allowedMimeTypes].map((item) => item.toLowerCase()));

  if (!detected) {
    return createSafeErrorResponse(
      "INVALID_FILE",
      "Could not read the uploaded file. Try a different file.",
      415,
    );
  }

  if (detected === "jpg") {
    if (allowed.has("image/jpeg") && ["jpg", "jpeg"].includes(extension)) return null;
  } else if (detected === "svg") {
    if (allowed.has("image/svg+xml") && extension === "svg") return null;
  } else if (allowed.has(`image/${detected}`) && extension === detected) {
    return null;
  } else if (detected === "tiff" && allowed.has("image/tiff") && ["tif", "tiff"].includes(extension)) {
    return null;
  } else if (detected === "bmp" && (allowed.has("image/bmp") || allowed.has("image/x-ms-bmp")) && extension === "bmp") {
    return null;
  }

  if (type === "image/jpg" && detected === "jpg" && ["jpg", "jpeg"].includes(extension)) {
    return null;
  }

  return createSafeErrorResponse(
    "UNSUPPORTED_TYPE",
    "The uploaded file type does not match its extension.",
    415,
  );
}

export function safeErrorMessage(message: string, fallback = "Conversion failed.") {
  return String(message || fallback)
    .replace(/[A-Z]:\\[^\s"'<>]+/g, "[path]")
    .replace(/\/(?:[^/\s"'<>]+\/){2,}[^/\s"'<>]+/g, "[path]")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function withJsonHeaders(headers?: HeadersInit): Headers {
  const next = new Headers(headers);
  next.set("Content-Type", "application/json; charset=utf-8");
  next.set("X-Content-Type-Options", "nosniff");
  return next;
}

function getExpectedOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = forwardedProto?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  const host = forwardedHost?.split(",")[0]?.trim() || request.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

function sameOrigin(value: string, expectedOrigin: string): boolean {
  try {
    return new URL(value).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}

function mimeTypesToExtensions(mimeTypes: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const type of mimeTypes) {
    if (type === "image/jpeg" || type === "image/jpg") {
      out.add("jpg");
      out.add("jpeg");
    } else if (type === "image/svg+xml") {
      out.add("svg");
    } else if (type === "image/x-ms-bmp") {
      out.add("bmp");
    } else if (type.startsWith("image/")) {
      out.add(type.slice("image/".length));
    }
  }
  return out;
}

function detectFileSignature(input: Buffer):
  | "png"
  | "jpg"
  | "webp"
  | "gif"
  | "avif"
  | "bmp"
  | "tiff"
  | "svg"
  | null {
  if (input.length < 4) return null;
  if (input[0] === 0x89 && input[1] === 0x50 && input[2] === 0x4e && input[3] === 0x47) return "png";
  if (input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) return "jpg";
  if (input.slice(0, 4).toString("ascii") === "RIFF" && input.slice(8, 12).toString("ascii") === "WEBP") return "webp";
  if (input.slice(0, 6).toString("ascii") === "GIF87a" || input.slice(0, 6).toString("ascii") === "GIF89a") return "gif";
  if (input.slice(0, 2).toString("ascii") === "BM") return "bmp";
  if (
    (input[0] === 0x49 && input[1] === 0x49 && input[2] === 0x2a && input[3] === 0x00) ||
    (input[0] === 0x4d && input[1] === 0x4d && input[2] === 0x00 && input[3] === 0x2a)
  ) {
    return "tiff";
  }
  if (input.length >= 12 && input.slice(4, 8).toString("ascii") === "ftyp") {
    const brand = input.slice(8, 16).toString("ascii");
    if (/avi[f s]|mif1|heic/.test(brand)) return "avif";
  }
  const head = input.slice(0, Math.min(input.length, 512)).toString("utf8").trimStart();
  if (/^(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)?<svg[\s>]/i.test(head)) return "svg";
  return null;
}
