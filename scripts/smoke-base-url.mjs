export const DEFAULT_SMOKE_BASE_URL = "http://localhost:3000";

export function getSmokeBaseUrl() {
  return (process.env.BASE_URL || DEFAULT_SMOKE_BASE_URL).replace(/\/$/, "");
}
