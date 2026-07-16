// Server-only disk-backed blob store. Keeps image bytes out of graph/node
// JSON (and therefore out of localStorage and out of the React Flow state
// tree) by indirecting through a small `{id, mediaType}` reference — the
// same pattern used by the m3 prototype this app is inspired by, simplified
// to local disk with no GCS/remote-hydration path.
//
// Layout on disk: `.reve-blobs/<uuid>.bin` (raw bytes) + `.reve-blobs/<uuid>.json`
// (metadata). This is a demo-grade store: it is NOT safe for multi-instance
// or serverless-with-ephemeral-disk deployments (see README "Deployment
// caveats") and performs no garbage collection — blobs accumulate on disk
// for the life of the local checkout.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { sniffImageMediaType } from "./imageSniff";

const BLOB_DIR = path.join(process.cwd(), ".reve-blobs");

// Matches the Reve API's documented per-image limit (40MB / 33,554,432px,
// neither dimension over 8192px). We only enforce the byte-size cap locally;
// pixel-dimension limits are enforced by the API itself and surfaced via its
// error response.
export const MAX_BLOB_BYTES = 40 * 1024 * 1024;

export const ALLOWED_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/tiff",
  "image/avif",
]);

export class BlobError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function ensureDir() {
  await mkdir(BLOB_DIR, { recursive: true });
}

function isValidId(id: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(id);
}

export interface StoredBlobMeta {
  mediaType: string;
  size: number;
  createdAt: number;
}

/** Validates bytes against the allow-list (by magic number, not by trusting
 * the caller) and size limit, then persists them under a fresh id. */
export async function saveBlob(
  bytes: Buffer,
  declaredMediaType?: string | null,
): Promise<{ id: string; mediaType: string; size: number }> {
  if (bytes.byteLength === 0) {
    throw new BlobError("Uploaded file is empty.");
  }
  if (bytes.byteLength > MAX_BLOB_BYTES) {
    throw new BlobError(
      `Image is ${(bytes.byteLength / (1024 * 1024)).toFixed(1)}MB, which exceeds the 40MB limit Reve's API documents for a single image.`,
    );
  }
  const sniffed = sniffImageMediaType(bytes);
  if (!sniffed) {
    throw new BlobError(
      `Unrecognized image format. Allowed formats: ${[...ALLOWED_MEDIA_TYPES].join(", ")}.`,
    );
  }
  // Trust the sniffed type over the declared one — it's what we actually
  // send to Reve, and it can't be spoofed via a Content-Type header.
  const mediaType = sniffed;
  void declaredMediaType;

  await ensureDir();
  const id = randomUUID();
  const meta: StoredBlobMeta = { mediaType, size: bytes.byteLength, createdAt: Date.now() };
  await writeFile(path.join(BLOB_DIR, `${id}.bin`), bytes);
  await writeFile(path.join(BLOB_DIR, `${id}.json`), JSON.stringify(meta));
  return { id, mediaType, size: bytes.byteLength };
}

export async function saveBlobFromBase64(
  base64: string,
  declaredMediaType?: string | null,
) {
  return saveBlob(Buffer.from(base64, "base64"), declaredMediaType);
}

export async function readBlob(
  id: string,
): Promise<{ bytes: Buffer; mediaType: string } | null> {
  if (!isValidId(id)) return null;
  try {
    const [bytes, metaRaw] = await Promise.all([
      readFile(path.join(BLOB_DIR, `${id}.bin`)),
      readFile(path.join(BLOB_DIR, `${id}.json`), "utf8"),
    ]);
    const meta = JSON.parse(metaRaw) as Partial<StoredBlobMeta>;
    return { bytes, mediaType: meta.mediaType ?? "image/png" };
  } catch {
    return null;
  }
}

export async function blobExists(id: string): Promise<boolean> {
  if (!isValidId(id)) return false;
  try {
    await stat(path.join(BLOB_DIR, `${id}.bin`));
    return true;
  } catch {
    return false;
  }
}

/** Reads a blob and returns it as a base64 string ready for Reve's
 * `{ data: "<base64>" }` image input shape. */
export async function readBlobAsBase64(id: string): Promise<string> {
  const blob = await readBlob(id);
  if (!blob) {
    throw new BlobError(`Blob "${id}" was not found. It may have been cleared; re-upload the image.`, 404);
  }
  return blob.bytes.toString("base64");
}
