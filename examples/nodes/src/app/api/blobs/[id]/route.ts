import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { readBlob } from "@/lib/blobStore";

// Small in-memory LRU of resized JPEG thumbnail buffers keyed on
// `${id}|${width}`. Avoids re-encoding on every canvas re-render without
// adding a disk cache. Cleared on server restart — fine for a local demo.
const MAX_CACHE_ENTRIES = 200;
const cache = new Map<string, Buffer>();

function cacheGet(key: string): Buffer | undefined {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

function cacheSet(key: string, value: Buffer) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function extensionFor(mediaType: string): string {
  if (mediaType === "image/jpeg") return "jpg";
  return /^image\/([a-z0-9-]+)$/i.exec(mediaType)?.[1] ?? "png";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const blob = await readBlob(id);
  if (!blob) {
    return NextResponse.json({ error: "Blob not found." }, { status: 404 });
  }

  const widthParam = req.nextUrl.searchParams.get("w");
  const width = widthParam
    ? Math.max(32, Math.min(4096, Math.round(Number(widthParam))))
    : null;

  if (!width || Number.isNaN(width)) {
    const headers: Record<string, string> = {
      "Content-Type": blob.mediaType,
      "Content-Length": String(blob.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    };
    if (req.nextUrl.searchParams.get("download") === "1") {
      headers["Content-Disposition"] =
        `attachment; filename="reve-${id}.${extensionFor(blob.mediaType)}"`;
    }
    return new NextResponse(new Uint8Array(blob.bytes), { headers });
  }

  const key = `${id}|${width}`;
  const cached = cacheGet(key);
  if (cached) {
    return new NextResponse(new Uint8Array(cached), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  try {
    const resized = await sharp(blob.bytes)
      .rotate()
      .resize({ width, withoutEnlargement: true, fit: "inside" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    cacheSet(key, resized);
    return new NextResponse(new Uint8Array(resized), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[reve-nodes] thumbnail resize failed, serving original:", (err as Error).message);
    return new NextResponse(new Uint8Array(blob.bytes), {
      headers: {
        "Content-Type": blob.mediaType,
        "Cache-Control": "public, max-age=300",
      },
    });
  }
}
