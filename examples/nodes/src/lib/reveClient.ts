// Server-only thin client for the Reve public REST API. Never imported from
// client components — only from `src/app/api/reve/**/route.ts` handlers.
// Owns: base URL resolution, Bearer auth header injection, and normalizing
// Reve's response headers/body into a shape our routes can act on.
//
// Security note: this file reads `REVE_API_KEY` from `process.env` and never
// logs it, never includes it in a returned object, and never forwards it to
// anything but api.reve.com (or REVE_API_BASE_URL, if a developer explicitly
// overrides it for local testing against a mock).

const DEFAULT_BASE_URL = "https://api.reve.com";

export class ReveConfigError extends Error {}

function baseUrl(): string {
  return process.env.REVE_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

function apiKey(): string {
  const key = process.env.REVE_API_KEY?.trim();
  if (!key) {
    throw new ReveConfigError(
      "REVE_API_KEY is not set on the server. Copy .env.example to .env.local, add your key from https://api.reve.com/console, and restart the dev server.",
    );
  }
  return key;
}

export interface ReveResponseMeta {
  requestId?: string;
  version?: string;
  contentViolation?: boolean;
  creditsUsed?: number;
  creditsRemaining?: number;
  errorCode?: string;
}

export interface ReveCallResult<T> {
  status: number;
  ok: boolean;
  body: T | null;
  meta: ReveResponseMeta;
  rawError?: { error_code?: string; message?: string; params?: unknown };
}

function numOrUndef(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * POSTs JSON to a Reve v2 endpoint and normalizes the result. Always
 * requests `Accept: application/json` (base64 image, if any, comes back
 * inline) — our routes persist that base64 to the local blob store and
 * strip it out before responding to the browser.
 */
export async function callReve<T>(
  path: string,
  jsonBody: unknown,
  signal?: AbortSignal,
): Promise<ReveCallResult<T>> {
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(jsonBody),
    signal,
  });

  const meta: ReveResponseMeta = {
    requestId: res.headers.get("x-reve-request-id") ?? undefined,
    version: res.headers.get("x-reve-version") ?? undefined,
    contentViolation: res.headers.get("x-reve-content-violation") === "true",
    creditsUsed: numOrUndef(res.headers.get("x-reve-credits-used")),
    creditsRemaining: numOrUndef(res.headers.get("x-reve-credits-remaining")),
    errorCode: res.headers.get("x-reve-error-code") ?? undefined,
  };

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON body; leave json null. Handled by caller via `ok`/`status`.
  }

  if (!res.ok) {
    const errBody = (json ?? {}) as { error_code?: string; message?: string; params?: unknown };
    return { status: res.status, ok: false, body: null, meta, rawError: errBody };
  }

  // Reve also surfaces content-policy violations as a *200* with
  // content_violation: true and an empty/omitted image — treat that as a
  // successful call whose body the route layer should interpret specially,
  // not as a transport error.
  return { status: res.status, ok: true, body: json as T, meta };
}
