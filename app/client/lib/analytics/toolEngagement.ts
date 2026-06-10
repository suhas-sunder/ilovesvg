import posthog from "posthog-js";

type ToolEngagementProps = Record<
  string,
  string | number | boolean | null | undefined
>;

const onceKeys = new Set<string>();

function routePath() {
  if (typeof window === "undefined") return "";
  return window.location.pathname || "";
}

export function getFileEngagementProps(file: File | null | undefined) {
  if (!file) return {};

  const extension =
    file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
    "";
  const sizeMb = file.size / (1024 * 1024);

  return {
    file_type: file.type || "unknown",
    file_extension: extension,
    file_size_bucket:
      sizeMb < 1
        ? "under_1mb"
        : sizeMb < 5
          ? "1_5mb"
          : sizeMb < 15
            ? "5_15mb"
            : "15mb_plus",
  };
}

export function trackToolEngagement(
  action: string,
  props: ToolEngagementProps = {},
) {
  if (typeof window === "undefined") return;

  try {
    posthog.capture("tool_engagement", {
      route_path: routePath(),
      tool_action: action,
      ...props,
    });
  } catch {
    // Analytics should never block the utility flow.
  }
}

export function trackToolEngagementOnce(
  key: string,
  action: string,
  props: ToolEngagementProps = {},
) {
  if (typeof window === "undefined") return;

  const scopedKey = `${routePath()}:${key}`;
  if (onceKeys.has(scopedKey)) return;

  onceKeys.add(scopedKey);
  trackToolEngagement(action, props);
}
