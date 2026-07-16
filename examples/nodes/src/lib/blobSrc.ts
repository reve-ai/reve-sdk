import type { ImageRef } from "./types";

/** Builds the `/api/blobs/[id]` URL for an image reference. Pass `width` to
 * request a resized JPEG thumbnail (see the blobs route) for cheaper canvas
 * rendering; omit it to fetch the original bytes (used for the full-size
 * modal and downloads). */
export function blobSrc(ref: ImageRef | undefined | null, width?: number): string | undefined {
  if (!ref?.id) return undefined;
  return width ? `/api/blobs/${ref.id}?w=${width}` : `/api/blobs/${ref.id}`;
}

/** Uses the blob route's attachment mode so download behavior and filename are
 * controlled by the response rather than a synthetic browser click. */
export function blobDownloadSrc(ref: ImageRef | undefined | null): string | undefined {
  if (!ref?.id) return undefined;
  return `/api/blobs/${ref.id}?download=1`;
}

/** Opens a top-level handoff page for download attempts originating inside a
 * sandboxed iframe. The page retries the attachment outside that sandbox and
 * keeps a visible manual link as a browser-policy fallback. */
export function blobDownloadPageSrc(ref: ImageRef | undefined | null): string | undefined {
  if (!ref?.id) return undefined;
  return `/download/${ref.id}`;
}
