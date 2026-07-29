const TRACE_CLIENT_RUN_QUERY_KEY = "__ilovesvg_trace_client_run_id";
const CORRELATED_JSON_HEADER = "x-ilovesvg-trace-correlation";
const MAX_CLIENT_RUN_ID_LENGTH = 160;
const CLIENT_RUN_ID_PATTERN = /^[a-z0-9:._-]+$/i;

type JsonResponder = (
  data: unknown,
  init?: number | ResponseInit,
) => Response;

export function normalizeTraceClientRunId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_CLIENT_RUN_ID_LENGTH ||
    !CLIENT_RUN_ID_PATTERN.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

export function createTraceActionUrl(
  explicitAction: string | undefined,
  currentHref: string,
  clientRunId: string,
): string {
  const normalizedClientRunId = normalizeTraceClientRunId(clientRunId);
  const currentUrl = new URL(currentHref);
  const actionUrl =
    !explicitAction || explicitAction === "."
      ? currentUrl
      : new URL(explicitAction, currentUrl);
  if (normalizedClientRunId) {
    actionUrl.searchParams.set(
      TRACE_CLIENT_RUN_QUERY_KEY,
      normalizedClientRunId,
    );
  }
  return `${actionUrl.pathname}${actionUrl.search}`;
}

export function readTraceClientRunId(request: Request): string | null {
  return normalizeTraceClientRunId(
    new URL(request.url).searchParams.get(TRACE_CLIENT_RUN_QUERY_KEY),
  );
}

export function createCorrelatedTraceJson(
  request: Request,
  json: JsonResponder,
): JsonResponder {
  const clientRunId = readTraceClientRunId(request);
  if (!clientRunId) return json;

  return (data, init) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return json(data, init);
    }
    const responseInit: ResponseInit =
      typeof init === "number" ? { status: init } : { ...init };
    const headers = new Headers(responseInit.headers);
    headers.set(CORRELATED_JSON_HEADER, "1");
    responseInit.headers = headers;
    return json(
      { ...data, clientRunId, traceResponseCorrelated: true },
      responseInit,
    );
  };
}

export function createCorrelatedTraceAction<
  TArgs extends { request: Request },
>(
  action: (args: TArgs) => Promise<Response>,
): (args: TArgs) => Promise<Response> {
  return async (args) => {
    const response = await action(args);
    const clientRunId = readTraceClientRunId(args.request);
    if (!clientRunId) return response;

    if (response.headers.get(CORRELATED_JSON_HEADER) === "1") {
      const headers = new Headers(response.headers);
      headers.delete(CORRELATED_JSON_HEADER);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    if (
      !/\bapplication\/json\b/i.test(
        response.headers.get("content-type") || "",
      )
    ) {
      return response;
    }

    const payload = await response.clone().json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return response;
    }
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(
      JSON.stringify({
        ...payload,
        clientRunId,
        traceResponseCorrelated: true,
      }),
      {
        status: response.status,
        statusText: response.statusText,
        headers,
      },
    );
  };
}
