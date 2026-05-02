type ErrorFlowKind =
  | "runtime"
  | "error-boundary"
  | "conversion"
  | "validation"
  | "async-processing"
  | "preview";

export type AppErrorLogContext = {
  flowStep: string;
  flowKind?: ErrorFlowKind;
  route?: string;
  action?: string;
  selectedFileType?: string;
  selectedFileSize?: number;
  imageDimensions?: { width?: number; height?: number } | null;
  settingsSnapshot?: unknown;
};

const TEMP_APPS_SCRIPT_LOG_URL =
  import.meta.env.VITE_ERROR_LOG_WEB_APP_URL ||
  "https://script.google.com/macros/s/AKfycbzyBTxBAgx248C4a51R-Uv0irVYI12xLdtjbm1cCg4pIKQMApYADqYC8U04GwbAzzM/exec";

// Temporary Apps Script / Google Sheets logging. This is intentionally
// best-effort, quota-conscious, and isolated so it can be replaced later.
const ERROR_LOG_SESSION_LIMIT = 20;
const ERROR_LOG_MIN_INTERVAL_MS = 30_000;
const ERROR_LOG_PER_MINUTE_LIMIT = 5;

let errorLogCountThisSession = 0;
let lastErrorLogKey = "";
let lastErrorLogAt = 0;
let recentErrorLogTimes: number[] = [];

export function logAppError(error: unknown, context: AppErrorLogContext) {
  if (typeof window === "undefined") return;
  if (!TEMP_APPS_SCRIPT_LOG_URL) return;

  const normalized = normalizeError(error);
  const flowStep = truncateText(context.flowStep || "unknown", 120);
  const errorKey = `${normalized.name}:${normalized.message}:${flowStep}`;
  if (!shouldSendErrorLog(errorKey)) return;

  const payload = {
    timestamp: new Date().toISOString(),
    environment: import.meta.env.MODE || "production",
    route: truncateText(context.route || window.location.pathname, 180),
    pageUrl: truncateText(window.location.href.replace(/[?#].*$/, ""), 240),
    flowStep,
    flowKind: context.flowKind || "runtime",
    action: truncateText(context.action || "", 80),
    errorName: truncateText(normalized.name, 80),
    errorMessage: truncateText(normalized.message, 300),
    stack: truncateText(sanitizeStack(normalized.stack), 1800),
    selectedFileType: truncateText(context.selectedFileType || "", 80),
    selectedFileSize: safeNumber(context.selectedFileSize),
    imageDimensions: sanitizeDimensions(context.imageDimensions),
    settingsSnapshot: sanitizeSettingsSnapshot(context.settingsSnapshot),
    userAgent: truncateText(window.navigator.userAgent, 260),
  };

  try {
    const body = JSON.stringify(payload);
    const blob = new Blob([body], { type: "application/json" });

    if (navigator.sendBeacon && navigator.sendBeacon(TEMP_APPS_SCRIPT_LOG_URL, blob)) {
      return;
    }

    void fetch(TEMP_APPS_SCRIPT_LOG_URL, {
      method: "POST",
      body,
      mode: "no-cors",
      keepalive: true,
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
    }).catch((logError) => {
      if (import.meta.env.DEV) {
        console.warn("Temporary error logging failed", logError);
      }
    });
  } catch (logError) {
    if (import.meta.env.DEV) {
      console.warn("Temporary error logging failed", logError);
    }
  }
}

function shouldSendErrorLog(errorKey: string) {
  const now = Date.now();

  if (errorLogCountThisSession >= ERROR_LOG_SESSION_LIMIT) return false;

  recentErrorLogTimes = recentErrorLogTimes.filter(
    (timestamp) => now - timestamp < 60_000,
  );

  if (recentErrorLogTimes.length >= ERROR_LOG_PER_MINUTE_LIMIT) return false;

  if (
    errorKey === lastErrorLogKey &&
    now - lastErrorLogAt < ERROR_LOG_MIN_INTERVAL_MS
  ) {
    return false;
  }

  lastErrorLogKey = errorKey;
  lastErrorLogAt = now;
  errorLogCountThisSession += 1;
  recentErrorLogTimes.push(now);
  return true;
}

function normalizeError(error: unknown): {
  name: string;
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "Unexpected error",
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return { name: "Error", message: error };
  }

  return {
    name: "Error",
    message: "Unexpected non-Error exception",
  };
}

function sanitizeStack(stack?: string) {
  if (!stack) return "";
  return stack
    .replace(/blob:[^\s)]+/gi, "[blob-url]")
    .replace(/data:[^\s)]+/gi, "[data-url]")
    .replace(/[A-Z]:\\[^\s)]+/gi, "[local-path]")
    .replace(/\/Users\/[^\s)]+/gi, "[local-path]")
    .replace(/\/home\/[^\s)]+/gi, "[local-path]");
}

function sanitizeSettingsSnapshot(settings: unknown) {
  if (!settings || typeof settings !== "object") return undefined;

  const safe: Record<string, unknown> = {};
  const allowedKeys = [
    "traceMode",
    "threshold",
    "turdSize",
    "optTolerance",
    "turnPolicy",
    "preprocess",
    "blurSigma",
    "edgeBoost",
    "colorLayerCount",
    "layerCount",
    "layerMaxTraceSide",
    "maxTraceSide",
    "minRegionPercent",
    "removeWhite",
    "removeTransparent",
    "transparent",
    "removeColorTolerance",
    "removeColorApplyTo",
    "backgroundAlpha",
    "fillAlpha",
    "layerAlpha",
    "outputWidth",
    "outputHeight",
    "preserveAspectRatio",
    "brightness",
    "contrast",
    "edgeThreshold",
    "edgeThickness",
    "noiseReduction",
    "gapCloseStrength",
    "minIslandPx",
    "holeFillPx",
    "colorMergeTolerance",
    "posterizeStrength",
    "sortLayersBy",
  ];

  const source = settings as Record<string, unknown>;
  for (const key of allowedKeys) {
    const value = source[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
  }

  if (Array.isArray(source.removeColors)) {
    safe.removeColorsCount = Math.min(source.removeColors.length, 12);
  }

  return truncateText(JSON.stringify(safe), 900);
}

function sanitizeDimensions(
  dimensions?: { width?: number; height?: number } | null,
) {
  if (!dimensions) return undefined;
  return {
    width: safeNumber(dimensions.width),
    height: safeNumber(dimensions.height),
  };
}

function safeNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function truncateText(value: unknown, maxLength: number) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
