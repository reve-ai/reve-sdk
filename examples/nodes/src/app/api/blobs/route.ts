import { NextRequest, NextResponse } from "next/server";
import { saveBlob, saveBlobFromBase64 } from "@/lib/blobStore";
import { handleRouteError, errorResponse } from "@/lib/apiError";

export const maxDuration = 60;

/**
 * Upload boundary for images entering the app. Accepts either a browser
 * `multipart/form-data` upload (the Image node's file picker / drag-drop
 * path) or a JSON `{ data: base64 }` body (useful for scripts/tests). Bytes
 * are validated by magic number and size before being written to the local
 * blob store — see `lib/blobStore.ts`.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return errorResponse(400, "Expected a `file` field in the multipart form.");
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      const saved = await saveBlob(bytes, file.type);
      return NextResponse.json(saved);
    }

    const json = await req.json();
    if (typeof json?.data !== "string") {
      return errorResponse(
        400,
        "Expected multipart/form-data with a `file` field, or JSON { data: <base64> }.",
      );
    }
    const saved = await saveBlobFromBase64(json.data, json.mediaType);
    return NextResponse.json(saved);
  } catch (err) {
    return handleRouteError(err);
  }
}
