import type { ImageRef } from "./types";

export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/tiff",
  "image/avif",
];
export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

/** Client-side pre-check only (fast feedback) — the server independently
 * sniffs bytes and enforces the same limits authoritatively. */
export function validateFileClientSide(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is ${(file.size / (1024 * 1024)).toFixed(1)}MB; Reve's API limit is 40MB per image.`;
  }
  if (file.type && !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `Unsupported file type "${file.type}". Use PNG, JPEG, WebP, GIF, TIFF, or AVIF.`;
  }
  return null;
}

export async function uploadImageFile(file: File, signal?: AbortSignal): Promise<ImageRef> {
  const clientError = validateFileClientSide(file);
  if (clientError) throw new Error(clientError);

  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/blobs", { method: "POST", body: form, signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Upload failed (${res.status}).`);
  }
  return { id: json.id, mediaType: json.mediaType };
}
