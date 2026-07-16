import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/apiError";
import {
  LAYOUT_DOWNLOAD_TTL_MS,
  LayoutDownloadError,
} from "@/lib/layoutDownload";
import { putLayoutDownload } from "@/lib/layoutDownloadStore";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return errorResponse(400, "Expected a layout download payload.");
    }
    const { key, text, filename } = body as Record<string, unknown>;
    if (typeof key !== "string") {
      return errorResponse(400, "Expected a layout download key.");
    }
    const payload = putLayoutDownload(key, { text, filename });
    return NextResponse.json(
      { key, expiresAt: payload.createdAt + LAYOUT_DOWNLOAD_TTL_MS },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof LayoutDownloadError) {
      return errorResponse(error.status, error.message);
    }
    if (error instanceof SyntaxError) {
      return errorResponse(400, "Expected a JSON request body.");
    }
    return errorResponse(500, "The layout download could not be prepared.");
  }
}
