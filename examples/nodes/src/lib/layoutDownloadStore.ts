import {
  LAYOUT_DOWNLOAD_TTL_MS,
  MAX_LAYOUT_DOWNLOAD_ENTRIES,
  LayoutDownloadError,
  isLayoutDownloadKey,
  validateLayoutDownloadDraft,
  type LayoutDownloadPayload,
} from "./layoutDownload";

const globalStore = globalThis as typeof globalThis & {
  __reveLayoutDownloads?: Map<string, LayoutDownloadPayload>;
};

const downloads =
  globalStore.__reveLayoutDownloads ??
  (globalStore.__reveLayoutDownloads = new Map<string, LayoutDownloadPayload>());

function requireKey(key: string): void {
  if (!isLayoutDownloadKey(key)) {
    throw new LayoutDownloadError("Invalid layout download key.", 400);
  }
}

export function cleanupLayoutDownloads(now = Date.now()): void {
  for (const [key, payload] of downloads) {
    if (now - payload.createdAt > LAYOUT_DOWNLOAD_TTL_MS) downloads.delete(key);
  }
}

export function putLayoutDownload(
  key: string,
  value: unknown,
  now = Date.now(),
): LayoutDownloadPayload {
  requireKey(key);
  const draft = validateLayoutDownloadDraft(value);
  cleanupLayoutDownloads(now);
  downloads.delete(key);
  while (downloads.size >= MAX_LAYOUT_DOWNLOAD_ENTRIES) {
    const oldest = downloads.keys().next().value;
    if (!oldest) break;
    downloads.delete(oldest);
  }
  const payload = { ...draft, createdAt: now };
  downloads.set(key, payload);
  return payload;
}

export function getLayoutDownload(
  key: string,
  now = Date.now(),
): LayoutDownloadPayload | null {
  requireKey(key);
  cleanupLayoutDownloads(now);
  return downloads.get(key) ?? null;
}

export function deleteLayoutDownload(key: string): boolean {
  requireKey(key);
  return downloads.delete(key);
}
