// Client-side wrapper for our own `/api/reve/*` proxy routes (never calls
// api.reve.com directly — the browser has no API key). Centralizes error
// shaping so every node can render upstream errors consistently.

import type {
  CreateRequestDTO,
  CreateResponseDTO,
  ExtractLayoutRequestDTO,
  ExtractLayoutResponseDTO,
  CreateLayoutRequestDTO,
  CreateLayoutResponseDTO,
  RenderLayoutRequestDTO,
  RenderLayoutResponseDTO,
  ApiErrorBody,
} from "./types";

export class ApiCallError extends Error {
  status: number;
  errorCode?: string;
  params?: Record<string, unknown>;
  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.error || `Request failed (${status}).`);
    this.name = "ApiCallError";
    this.status = status;
    this.errorCode = body.errorCode;
    this.params = body.params;
  }
}

async function post<TReq, TRes>(path: string, body: TReq, signal?: AbortSignal): Promise<TRes> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const json = await res.json().catch(() => ({}) as unknown);
  if (!res.ok) {
    throw new ApiCallError(res.status, (json ?? {}) as ApiErrorBody);
  }
  return json as TRes;
}

export function runV2Create(body: CreateRequestDTO, signal?: AbortSignal) {
  return post<CreateRequestDTO, CreateResponseDTO>("/api/reve/create", body, signal);
}
export function runExtractLayout(body: ExtractLayoutRequestDTO, signal?: AbortSignal) {
  return post<ExtractLayoutRequestDTO, ExtractLayoutResponseDTO>(
    "/api/reve/extract-layout",
    body,
    signal,
  );
}
export function runCreateLayout(body: CreateLayoutRequestDTO, signal?: AbortSignal) {
  return post<CreateLayoutRequestDTO, CreateLayoutResponseDTO>(
    "/api/reve/create-layout",
    body,
    signal,
  );
}
export function runRenderLayout(body: RenderLayoutRequestDTO, signal?: AbortSignal) {
  return post<RenderLayoutRequestDTO, RenderLayoutResponseDTO>(
    "/api/reve/render-layout",
    body,
    signal,
  );
}

/** Shared error-message formatting for node `run()` implementations —
 * surfaces Reve's `error_code` and structured `params` alongside the human
 * message. Reve frequently puts the only actionable field/path detail in
 * `params`, so dropping it turns useful 4xx responses into generic errors. */
export function describeApiError(err: unknown): string {
  if (err instanceof ApiCallError) {
    const prefix = err.errorCode ? `${err.errorCode}: ` : "";
    if (!err.params || Object.keys(err.params).length === 0) return `${prefix}${err.message}`;

    const serialized = JSON.stringify(err.params);
    const detail = serialized.length > 600 ? `${serialized.slice(0, 597)}…` : serialized;
    return `${prefix}${err.message} · ${detail}`;
  }
  if (err instanceof Error) return err.message;
  return "Request failed.";
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}
