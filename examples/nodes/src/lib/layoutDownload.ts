export const LAYOUT_DOWNLOAD_TTL_MS = 5 * 60 * 1000;
export const MAX_LAYOUT_DOWNLOAD_BYTES = 1024 * 1024;
export const MAX_LAYOUT_DOWNLOAD_ENTRIES = 32;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface LayoutDownloadDraft {
  text: string;
  filename: string;
}

export interface LayoutDownloadPayload extends LayoutDownloadDraft {
  createdAt: number;
}

export class LayoutDownloadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "LayoutDownloadError";
  }
}

export function isLayoutDownloadKey(key: string): boolean {
  return UUID_PATTERN.test(key);
}

export function layoutDownloadByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function validateLayoutDownloadDraft(value: unknown): LayoutDownloadDraft {
  if (!value || typeof value !== "object") {
    throw new LayoutDownloadError("Expected a layout download payload.", 400);
  }
  const candidate = value as Partial<LayoutDownloadDraft>;
  if (typeof candidate.text !== "string") {
    throw new LayoutDownloadError("Expected layout JSON text.", 400);
  }
  if (layoutDownloadByteLength(candidate.text) > MAX_LAYOUT_DOWNLOAD_BYTES) {
    throw new LayoutDownloadError("Layout download exceeds the 1MB limit.", 413);
  }
  if (typeof candidate.filename !== "string" || candidate.filename.length === 0) {
    throw new LayoutDownloadError("Expected a JSON filename.", 400);
  }

  const sanitized = candidate.filename
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 120);
  const filename = sanitized.toLowerCase().endsWith(".json")
    ? sanitized
    : `${sanitized || "reve-layout"}.json`;
  return { text: candidate.text, filename };
}
