import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/apiError";
import { LayoutDownloadError } from "@/lib/layoutDownload";
import {
  deleteLayoutDownload,
  getLayoutDownload,
} from "@/lib/layoutDownloadStore";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const { key } = await params;
    const payload = getLayoutDownload(key);
    if (!payload) return errorResponse(404, "Layout download not found or expired.");
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    if (error instanceof LayoutDownloadError) {
      return errorResponse(error.status, error.message);
    }
    return errorResponse(500, "The layout download could not be read.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const { key } = await params;
    deleteLayoutDownload(key);
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof LayoutDownloadError) {
      return errorResponse(error.status, error.message);
    }
    return errorResponse(500, "The layout download could not be removed.");
  }
}
