// Core domain types for Reve Nodes, mirroring the public REST API's JSON
// shapes. See README "API endpoint mapping" and
// https://api.reve.com/console/docs for the authoritative source.

/** Normalized [0,1] bounding box, top-left origin. */
export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Point {
  x: number;
  y: number;
}

export type RegionType =
  | "coarse_detail"
  | "medium_detail"
  | "fine_detail"
  | "text"
  | "hand"
  | "face";

export interface Region {
  label: string;
  prompt: string;
  bbox: BBox;
  parent?: string;
  region_type?: RegionType | string;
  image_index?: number;
  image_region_index?: number;
}

/**
 * A Reve layout. `regions` is required by the API; width/height are
 * optional multiples of 32 emitted by the layout endpoints and honored by
 * render_layout when present on input.
 */
export interface Layout {
  prompt?: string;
  normalized_edit_instruction?: string;
  width?: number;
  height?: number;
  regions: Region[];
}

export const ASPECT_RATIOS = [
  "4:1",
  "3:1",
  "21:9",
  "2:1",
  "17:9",
  "16:9",
  "3:2",
  "4:3",
  "5:4",
  "1:1",
  "4:5",
  "3:4",
  "2:3",
  "9:16",
  "1:2",
  "1:3",
  "1:4",
  "auto",
] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const MAX_REFERENCES = 8;
export const MAX_PROMPT_LENGTH = 4000;

/**
 * Client-side image reference. The browser never holds base64 image bytes in
 * graph/node state — only a small pointer to a server-side blob store entry.
 * Bytes are fetched on demand via `/api/blobs/[id]` for display/download and
 * are only re-hydrated to base64 inside a server-side API route right before
 * a Reve call.
 */
export interface ImageRef {
  id: string;
  mediaType: string;
  width?: number;
  height?: number;
}

/** Raw image input as sent to the Reve API itself: exactly one of `data`
 * (base64) or `ref` (a stored id/reference string). Our own routes only ever
 * construct the `data` variant server-side, from blob store bytes. */
export type RawImageInput = { data: string } | { ref: string };

/** Compound reference used by create_layout / render_layout. */
export interface CompoundReference {
  image?: RawImageInput;
  layout?: Layout;
  prompt?: string;
}

export interface PostprocessUpscale {
  process: "upscale";
  upscale_factor: number;
}
export interface PostprocessRemoveBackground {
  process: "remove_background";
}
export interface PostprocessFitImage {
  process: "fit_image";
  max_dim?: number;
  max_width?: number;
  max_height?: number;
}
export interface PostprocessEffect {
  process: "effect";
  effect_name: string;
  effect_parameters?: Record<string, Record<string, unknown>>;
}
export type Postprocess =
  | PostprocessUpscale
  | PostprocessRemoveBackground
  | PostprocessFitImage
  | PostprocessEffect;

/** Layout commands are a small ordered-op language; kept loosely typed
 * client-side (edited as raw JSON) and validated more strictly server-side. */
export type LayoutCommand = Record<string, unknown>;

export interface ReveMeta {
  requestId?: string;
  version?: string;
  contentViolation?: boolean;
  creditsUsed?: number;
  creditsRemaining?: number;
}

// ---- DTOs exchanged between the browser and our own /api/reve/* proxy ----
// `blobId` always points into our local blob store (see blobStore.ts) — never
// a raw Reve `ref:`/`id:` string and never inline base64. Deciding how an
// image is actually stored is entirely a server-side concern.

export interface ImageInputDTO {
  blobId: string;
}

export interface CompoundReferenceDTO {
  image?: ImageInputDTO;
  layout?: Layout;
  prompt?: string;
}

export interface CreateRequestDTO {
  prompt: string;
  references?: ImageInputDTO[];
  aspectRatio?: AspectRatio;
  version?: string;
  postprocessing?: Postprocess[];
}
export interface CreateResponseDTO {
  image?: ImageRef;
  layout?: Layout;
  meta: ReveMeta;
}

export interface ExtractLayoutRequestDTO {
  image: ImageInputDTO;
  prompt?: string;
  version?: string;
}
export interface ExtractLayoutResponseDTO {
  layout?: Layout;
  meta: ReveMeta;
}

export interface CreateLayoutRequestDTO {
  prompt?: string;
  references?: CompoundReferenceDTO[];
  commands?: LayoutCommand[];
  aspectRatio?: AspectRatio;
  version?: string;
}
export interface CreateLayoutResponseDTO {
  layout?: Layout;
  meta: ReveMeta;
}

export interface RenderLayoutRequestDTO {
  layout: Layout;
  references?: CompoundReferenceDTO[];
  version?: string;
  postprocessing?: Postprocess[];
}
export interface RenderLayoutResponseDTO {
  image?: ImageRef;
  layout?: Layout;
  meta: ReveMeta;
}

export interface ApiErrorBody {
  error: string;
  errorCode?: string;
  params?: Record<string, unknown>;
}

// ---- Node output shapes (what each node's `data.output` holds client-side) ----

export interface ImageNodeOutput {
  image?: ImageRef;
}
export interface LayoutNodeOutput {
  layout?: Layout;
}
export type NodeOutput = (ImageNodeOutput & LayoutNodeOutput) & {
  meta?: ReveMeta;
};
