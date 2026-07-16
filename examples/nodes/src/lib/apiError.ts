import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { formatZodIssues } from "./validation";
import { BlobError } from "./blobStore";
import { ReveConfigError } from "./reveClient";
import type { ApiErrorBody } from "./types";

export function errorResponse(status: number, error: string, extra?: Partial<ApiErrorBody>) {
  const body: ApiErrorBody = { error, ...extra };
  return NextResponse.json(body, { status });
}

/** Converts a non-ok Reve API result into our own ApiErrorBody shape,
 * forwarding the upstream status and structured error faithfully. */
export function reveErrorToResponse(
  status: number,
  rawError?: { error_code?: string; message?: string; params?: unknown },
) {
  return errorResponse(status, rawError?.message || "The Reve API returned an error.", {
    errorCode: rawError?.error_code,
    params: (rawError?.params as Record<string, unknown> | undefined) ?? undefined,
  });
}

/** Central catch-block handler for route handlers. Never logs request
 * bodies or the API key — only a short message for operator diagnostics. */
export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return errorResponse(400, "Request failed validation.", {
      errorCode: "INVALID_REQUEST",
      params: { issues: formatZodIssues(err) },
    });
  }
  if (err instanceof BlobError) {
    return errorResponse(err.status, err.message, { errorCode: "BLOB_ERROR" });
  }
  if (err instanceof ReveConfigError) {
    return errorResponse(500, err.message, { errorCode: "MISSING_API_KEY" });
  }
  if (err instanceof Error && err.name === "AbortError") {
    return errorResponse(499, "Request was cancelled.", { errorCode: "CANCELLED" });
  }
  const message = err instanceof Error ? err.message : "Unknown error.";
  // eslint-disable-next-line no-console
  console.error("[reve-nodes] unhandled route error:", message);
  return errorResponse(500, "Internal server error.", { errorCode: "INTERNAL_ERROR" });
}
