import { NextRequest, NextResponse } from "next/server";
import { renderLayoutRequestSchema } from "@/lib/validation";
import { callReve } from "@/lib/reveClient";
import {
  hydrateCompoundReferences,
  persistResponseImage,
  sanitizeLayoutForReve,
} from "@/lib/reveHydrate";
import { handleRouteError, reveErrorToResponse } from "@/lib/apiError";
import type { RenderLayoutResponseDTO, Layout } from "@/lib/types";

// Rendering an image from a layout is in the 40-80s bucket per Reve's docs.
export const maxDuration = 120;

interface RenderLayoutReveBody {
  image?: string;
  layout?: Layout;
  content_violation?: boolean;
  request_id?: string;
  credits_used?: number;
  credits_remaining?: number;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = renderLayoutRequestSchema.parse(json);
    const references = await hydrateCompoundReferences(parsed.references);

    const result = await callReve<RenderLayoutReveBody>(
      "/v2/image/render_layout",
      {
        layout: sanitizeLayoutForReve(parsed.layout),
        references,
        postprocessing: parsed.postprocessing,
        version: parsed.version,
      },
      req.signal,
    );

    if (!result.ok) return reveErrorToResponse(result.status, result.rawError);

    const image = await persistResponseImage(result.body?.image);
    const response: RenderLayoutResponseDTO = {
      image,
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
