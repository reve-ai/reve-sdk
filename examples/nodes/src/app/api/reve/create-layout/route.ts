import { NextRequest, NextResponse } from "next/server";
import { createLayoutRequestSchema } from "@/lib/validation";
import { callReve } from "@/lib/reveClient";
import { hydrateCompoundReferences } from "@/lib/reveHydrate";
import { handleRouteError, reveErrorToResponse } from "@/lib/apiError";
import type { CreateLayoutResponseDTO, Layout } from "@/lib/types";

export const maxDuration = 120;

interface CreateLayoutReveBody {
  layout?: Layout;
  content_violation?: boolean;
  request_id?: string;
  credits_used?: number;
  credits_remaining?: number;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = createLayoutRequestSchema.parse(json);
    const references = await hydrateCompoundReferences(parsed.references);

    const result = await callReve<CreateLayoutReveBody>(
      "/v2/image/create_layout",
      {
        prompt: parsed.prompt,
        references,
        commands: parsed.commands,
        aspect_ratio: parsed.aspectRatio,
        version: parsed.version,
      },
      req.signal,
    );

    if (!result.ok) return reveErrorToResponse(result.status, result.rawError);

    const response: CreateLayoutResponseDTO = {
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
