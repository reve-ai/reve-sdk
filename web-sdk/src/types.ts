/**
 * Reve partner API v2 wire types.
 *
 * These are stand-alone copies of the partner API v2 interface declarations,
 * inlined here so this package has no dependency on Reve-internal packages.
 * Keep them in sync with the published API at https://api.reve.com/.
 */

/** A region's level-of-detail / special-handling hint. */
export type V2RegionType = "coarse_detail" | "medium_detail" | "fine_detail" | "text" | "hand" | "face";

/** Normalized bounding box with top-left origin; values in [0, 1]. */
export interface V2Bbox {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

/** Normalized point with top-left origin; values in [0, 1]. */
export interface V2Point {
	x: number;
	y: number;
}

/** An RGB color; channel values in [0, 255]. */
export interface V2Color {
	r: number;
	g: number;
	b: number;
}

/** A `v2_image_input`: provide exactly one of `data` or `ref`. */
export interface V2ImageInput {
	/** Base-64 encoded image data. */
	data?: string;
	/** `id:<uuid>` of a project image/generation, or `reference:@<name>`. */
	ref?: string;
}

/** A single region within a {@link V2Layout}. */
export interface V2Region {
	/** Short entity name; unique within the layout. */
	label: string;
	/** The regional prompt. */
	prompt: string;
	/** Normalized bounding box of the region. */
	bbox: V2Bbox;
	/** Index into the endpoint's ordered references. */
	image_index?: number;
	/** Index of the corresponding region within the referenced image's layout. */
	image_region_index?: number;
	/** The `label` of this region's parent region within the same layout. */
	parent?: string;
	/** Level-of-detail / special-handling hint. */
	region_type?: V2RegionType;
	/** Representative colors for the region, when reported by the API. */
	color_palette?: V2Color[];
}

/** A layout: an overall `prompt` plus a list of `regions`. */
export interface V2Layout {
	regions: V2Region[];
	/** Overall caption/prompt for the layout. */
	prompt?: string;
	/** The model's canonicalized form of an edit instruction. */
	normalized_edit_instruction?: string;
	/** Pixel width of the layout's coordinate frame (a multiple of 32). */
	width?: number;
	/** Pixel height of the layout's coordinate frame (a multiple of 32). */
	height?: number;
}

/** A reference image and/or layout, plus an optional prompt. */
export interface V2Reference {
	image?: V2ImageInput;
	prompt?: string;
	layout?: V2Layout;
}

/** The operation a {@link V2LayoutCommand} performs. */
export type V2LayoutCommandOp = "add" | "shift" | "remove" | "place" | "keep" | "change";

/** A single imperative layout-editing command for `create_layout`. */
export interface V2LayoutCommand {
	op: V2LayoutCommandOp;
	label?: string;
	description?: string;
	image_index?: number;
	at?: V2Bbox | V2Point;
	to?: V2Bbox | V2Point;
	new_description?: string;
}

/** A postprocessing operation (e.g. `{ process: "upscale" }`). */
export interface V2Postprocessing {
	process: string;
	[key: string]: unknown;
}

/** Aspect ratios accepted by the v2 endpoints (width:height), plus `"auto"`. */
export type V2AspectRatio =
	| "4:1"
	| "3:1"
	| "21:9"
	| "2:1"
	| "17:9"
	| "16:9"
	| "3:2"
	| "4:3"
	| "5:4"
	| "1:1"
	| "4:5"
	| "3:4"
	| "2:3"
	| "9:16"
	| "1:2"
	| "1:3"
	| "1:4"
	| "auto";

/** Request body for POST /v2/image/create. */
export interface V2ImageCreateRequest {
	prompt: string;
	references?: V2ImageInput[];
	aspect_ratio?: V2AspectRatio;
	postprocessing?: V2Postprocessing[];
	version?: string;
}

/** Request body for POST /v2/image/extract_layout. */
export interface V2ExtractLayoutRequest {
	image: V2ImageInput;
	prompt?: string;
	version?: string;
}

/** Request body for POST /v2/image/create_layout. */
export interface V2CreateLayoutRequest {
	prompt?: string;
	references?: V2Reference[];
	commands?: V2LayoutCommand[];
	aspect_ratio?: V2AspectRatio;
	version?: string;
}

/** Request body for POST /v2/image/render_layout. */
export interface V2RenderLayoutRequest {
	layout: V2Layout;
	references?: V2Reference[];
	postprocessing?: V2Postprocessing[];
	version?: string;
}

/** Source filter for the effects-listing endpoint. */
export type V1EffectSource = "all" | "project" | "preset";

/** A single available postprocessing effect (`v1_effect_info`). */
export interface V1EffectInfo {
	name: string;
	description?: string;
	source: V1EffectSource;
	category?: string;
}

/** Response body of GET /v1/image/effect (`v1_effects_response`). */
export interface V1EffectsResponse {
	effects: V1EffectInfo[];
}

/** The publicly billable /v2/image operations. */
export type V2Operation = "create" | "extract_layout" | "create_layout" | "render_layout";

/** The available postprocessing processes. */
export type V2ImageProcess = "upscale" | "remove_background" | "fit_image" | "effect";

/** The credit cost of one /v2/image operation. */
export interface V2OperationCost {
	operation: V2Operation;
	credits: number;
}

/**
 * The credit cost of one postprocessing operation. Exactly one cost model is
 * present: either a flat `credits` amount, or a resolution-scaled formula
 * `credits_base + credits_per_megapixel * output_megapixels` (rounded up)
 * with both of those fields present.
 */
export interface V2PostprocessCost {
	process: V2ImageProcess;
	credits?: number;
	credits_base?: number;
	credits_per_megapixel?: number;
}

/** Response body of GET /v2/image/info (`v2_image_info_response`). */
export interface V2ImageInfoResponse {
	operations: V2OperationCost[];
	postprocessing: V2PostprocessCost[];
}

/** JSON response body shared by the v2 image endpoints. */
export interface V2ImageResponse {
	/** Base-64 encoded image data; empty for layout-only endpoints. */
	image?: string;
	/** The layout the model generated, when available. */
	layout?: V2Layout;
	request_id?: string;
	credits_used?: number;
	credits_remaining?: number;
	version?: string;
	content_violation?: boolean;
}
