import { NextRequest, NextResponse } from "next/server";
import { createRequestSchema } from "@/lib/validation";
import { callReve } from "@/lib/reveClient";
import { hydrateRawImageInputs, persistResponseImage } from "@/lib/reveHydrate";
import { handleRouteError, reveErrorToResponse } from "@/lib/apiError";
import type { CreateResponseDTO, Layout } from "@/lib/types";

// v2/image/create commonly takes 40-80s per Reve's docs; configure Next.js
// (and any proxy/load balancer in front of it) for >=120s, matching Reve's
// documented client-timeout guidance.
export const maxDuration = 120;

interface CreateReveBody {
  image?: string;
  layout?: Layout;
  version?: string;
  content_violation?: boolean;
  request_id?: string;
  credits_used?: number;
  credits_remaining?: number;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = createRequestSchema.parse(json);
    const references = await hydrateRawImageInputs(parsed.references);

    const result = await callReve<CreateReveBody>(
      "/v2/image/create",
      {
        prompt: parsed.prompt,
        references,
        aspect_ratio: parsed.aspectRatio,
        version: parsed.version,
        postprocessing: parsed.postprocessing,
      },
      req.signal,
    );

    if (!result.ok) return reveErrorToResponse(result.status, result.rawError);

    const image = await persistResponseImage(result.body?.image);
    const response: CreateResponseDTO = {
      image,
      layout: result.body?.layout,
      meta: {
        requestId: result.body?.request_id ?? result.meta.requestId,
        version: result.body?.version ?? result.meta.version,
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
