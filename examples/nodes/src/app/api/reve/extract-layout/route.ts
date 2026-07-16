import { NextRequest, NextResponse } from "next/server";
import { extractLayoutRequestSchema } from "@/lib/validation";
import { callReve } from "@/lib/reveClient";
import { hydrateImageInput } from "@/lib/reveHydrate";
import { handleRouteError, reveErrorToResponse } from "@/lib/apiError";
import type { ExtractLayoutResponseDTO, Layout } from "@/lib/types";

// Layout endpoints commonly take 10-40s per Reve's docs; still configure for
// >=120s per their general v2 latency guidance.
export const maxDuration = 120;

interface ExtractLayoutReveBody {
  layout?: Layout;
  content_violation?: boolean;
  request_id?: string;
  credits_used?: number;
  credits_remaining?: number;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = extractLayoutRequestSchema.parse(json);
    const image = await hydrateImageInput(parsed.image);

    const result = await callReve<ExtractLayoutReveBody>(
      "/v2/image/extract_layout",
      { image, prompt: parsed.prompt, version: parsed.version },
      req.signal,
    );

    if (!result.ok) return reveErrorToResponse(result.status, result.rawError);

    const response: ExtractLayoutResponseDTO = {
      layout: result.body?.layout,
      meta: {
        requestId: result.body?.request_id ?? result.meta.requestId,
        version: result.meta.version,
        contentViolation: result.body?.content_violation ?? result.meta.contentViolation,
        creditsUsed: result.body?.credits_used ?? result.meta.creditsUsed,
        creditsRemaining: result.body?.credits_remaining ?? result.meta.creditsRemaining,
      },
    };
    return NextResponse.json(response);
  } catch (err) {
    return handleRouteError(err);
  }
}
