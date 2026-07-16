// Shared zod schemas for the Layout/Region/DTO shapes. Used both server-side
// (API routes, to reject malformed requests before spending a Reve credit)
// and client-side (Layout Editor / Image Editor, to validate hand-edited or
// hand-drawn JSON before it's allowed to flow downstream).

import { z } from "zod";
import { ASPECT_RATIOS, MAX_PROMPT_LENGTH, MAX_REFERENCES } from "./types";

export const bboxSchema = z.object({
  x0: z.number(),
  y0: z.number(),
  x1: z.number(),
  y1: z.number(),
});

export const regionSchema = z.object({
  label: z.string().min(1, "region label is required"),
  prompt: z.string().min(1, "region prompt is required"),
  bbox: bboxSchema,
  parent: z.string().optional(),
  region_type: z.string().optional(),
  image_index: z.number().int().nonnegative().optional(),
  image_region_index: z.number().int().nonnegative().optional(),
});

export const layoutSchema = z.object({
  prompt: z.string().optional(),
  normalized_edit_instruction: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  regions: z.array(regionSchema),
});

export const aspectRatioSchema = z.enum(ASPECT_RATIOS);

export const postprocessSchema = z.union([
  z.object({ process: z.literal("upscale"), upscale_factor: z.number().int().min(1).max(4) }),
  z.object({ process: z.literal("remove_background") }),
  z.object({
    process: z.literal("fit_image"),
    max_dim: z.number().int().positive().max(4096).optional(),
    max_width: z.number().int().positive().max(4096).optional(),
    max_height: z.number().int().positive().max(4096).optional(),
  }),
  z.object({
    process: z.literal("effect"),
    effect_name: z.string().min(1),
    effect_parameters: z.record(z.record(z.unknown())).optional(),
  }),
]);

// Loose on purpose: the command language has many op-specific shapes (see
// README "Create Layout commands"). We validate the required `op` field and
// pass the rest through — Reve's API will reject truly malformed commands
// with a structured error we surface as-is.
export const layoutCommandSchema = z.object({ op: z.string() }).passthrough();

export const imageInputDTOSchema = z.object({
  blobId: z.string().uuid("blobId must be a blob store id (see the Image node's output)"),
});

export const compoundReferenceDTOSchema = z
  .object({
    image: imageInputDTOSchema.optional(),
    layout: layoutSchema.optional(),
    prompt: z.string().optional(),
  })
  .refine((r) => r.image || r.layout || r.prompt, {
    message: "each reference must contain at least one of image, layout, or prompt",
  });

export const createRequestSchema = z.object({
  prompt: z.string().min(1, "prompt is required").max(MAX_PROMPT_LENGTH),
  references: z.array(imageInputDTOSchema).max(MAX_REFERENCES).optional(),
  aspectRatio: aspectRatioSchema.optional(),
  version: z.string().optional(),
  postprocessing: z.array(postprocessSchema).optional(),
});

export const extractLayoutRequestSchema = z.object({
  image: imageInputDTOSchema,
  prompt: z.string().max(MAX_PROMPT_LENGTH).optional(),
  version: z.string().optional(),
});

export const createLayoutRequestSchema = z
  .object({
    prompt: z.string().max(MAX_PROMPT_LENGTH).optional(),
    references: z.array(compoundReferenceDTOSchema).max(MAX_REFERENCES).optional(),
    commands: z.array(layoutCommandSchema).optional(),
    aspectRatio: aspectRatioSchema.optional(),
    version: z.string().optional(),
  })
  .refine((r) => (r.prompt && r.prompt.length > 0) || (r.references && r.references.length > 0), {
    message: "at least one of prompt or references is required",
  })
  .refine((r) => !r.commands || r.commands.length === 0 || (r.references && r.references.length > 0), {
    message: "commands require at least one reference",
  });

export const renderLayoutRequestSchema = z.object({
  layout: layoutSchema,
  references: z.array(compoundReferenceDTOSchema).max(MAX_REFERENCES).optional(),
  version: z.string().optional(),
  postprocessing: z.array(postprocessSchema).optional(),
});

export type ValidationIssue = { path: string; message: string };

export function formatZodIssues(err: z.ZodError): ValidationIssue[] {
  return err.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message }));
}
