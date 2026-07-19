/**
 * Minimal fetch-based client for the Reve partner API v2.
 *
 * Wraps the API token and the `/v2/image` endpoints into simple functions.
 */

import type {
	V1EffectInfo,
	V1EffectSource,
	V1EffectsResponse,
	V2CreateLayoutRequest,
	V2ExtractLayoutRequest,
	V2ImageCreateRequest,
	V2ImageInfoResponse,
	V2ImageResponse,
	V2PostprocessCost,
	V2RenderLayoutRequest,
} from "./types.js";

const DEFAULT_API_URL = "https://api.reve.com";

/** Error thrown for non-2xx responses from the Reve API. */
export class ReveApiError extends Error {
	readonly status: number;
	readonly requestId: string | undefined;
	readonly payload: unknown;

	constructor(message: string, status: number, requestId: string | undefined, payload: unknown) {
		super(message);
		this.name = "ReveApiError";
		this.status = status;
		this.requestId = requestId;
		this.payload = payload;
	}
}

export interface ReveClientOptions {
	/** Partner API bearer token (`papi.…`). */
	apiToken: string;
	/** Base API URL; defaults to `https://api.reve.com`. */
	apiUrl?: string;
	/** Custom fetch implementation; defaults to the global `fetch`. */
	fetch?: typeof fetch;
}

/** Client for the Reve partner API v2 image endpoints. */
export class ReveClient {
	private readonly apiToken: string;
	private readonly apiUrl: string;
	private readonly fetchFn: typeof fetch;

	constructor(options: ReveClientOptions) {
		this.apiToken = options.apiToken;
		this.apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, "");
		this.fetchFn = options.fetch ?? fetch.bind(globalThis);
	}

	/** Generate an image from a text prompt (`POST /v2/image/create`). */
	async createImage(request: V2ImageCreateRequest): Promise<V2ImageResponse> {
		return await this.post("/v2/image/create", request);
	}

	/** Extract or edit a layout from one image (`POST /v2/image/extract_layout`). */
	async extractLayout(request: V2ExtractLayoutRequest): Promise<V2ImageResponse> {
		return await this.post("/v2/image/extract_layout", request);
	}

	/** Generate or edit a layout; returns no image (`POST /v2/image/create_layout`). */
	async createLayout(request: V2CreateLayoutRequest): Promise<V2ImageResponse> {
		return await this.post("/v2/image/create_layout", request);
	}

	/** Render an image from a layout (`POST /v2/image/render_layout`). */
	async renderLayout(request: V2RenderLayoutRequest): Promise<V2ImageResponse> {
		return await this.post("/v2/image/render_layout", request);
	}

	/**
	 * List available postprocessing effects (`GET /v1/image/effect`).
	 *
	 * `source` filters the list: `"project"` returns effects saved in the
	 * token's project, `"preset"` returns built-in presets, and `"all"`
	 * (the default) returns both.
	 */
	async listEffects(source?: V1EffectSource): Promise<V1EffectInfo[]> {
		const query = source === undefined ? undefined : { source };
		const response = await this.getJson<V1EffectsResponse>("/v1/image/effect", query);
		return response.effects;
	}

	/**
	 * List the available postprocessing operations and their credit costs
	 * (`GET /v2/image/info`).
	 */
	async listPostprocessors(): Promise<V2PostprocessCost[]> {
		return (await this.getImageInfo()).postprocessing;
	}

	/**
	 * Get public information about the /v2/image API, including per-operation
	 * and postprocessing credit costs (`GET /v2/image/info`).
	 */
	async getImageInfo(): Promise<V2ImageInfoResponse> {
		return await this.getJson<V2ImageInfoResponse>("/v2/image/info");
	}

	/** POST a JSON body to an API path and return the parsed JSON response. */
	async post(path: string, body: unknown): Promise<V2ImageResponse> {
		const response = await this.fetchFn(this.apiUrl + path, {
			method: "POST",
			headers: {
				authorization: `Bearer ${this.apiToken}`,
				"content-type": "application/json",
				accept: "application/json",
			},
			body: JSON.stringify(body),
		});
		return await this.parseJsonResponse<V2ImageResponse>(response);
	}

	private async getJson<T>(path: string, query?: Record<string, string>): Promise<T> {
		const search = query === undefined ? "" : `?${new URLSearchParams(query)}`;
		const response = await this.fetchFn(this.apiUrl + path + search, {
			method: "GET",
			headers: {
				authorization: `Bearer ${this.apiToken}`,
				accept: "application/json",
			},
		});
		return await this.parseJsonResponse<T>(response);
	}

	private async parseJsonResponse<T>(response: Response): Promise<T> {
		const requestId = response.headers.get("x-reve-request-id") ?? undefined;
		if (!response.ok) {
			const payload: unknown = await response.json().catch(() => undefined);
			const detail =
				typeof payload === "object" && payload !== null && "message" in payload
					? String(payload.message)
					: response.statusText;
			throw new ReveApiError(`Reve API error ${response.status}: ${detail}`, response.status, requestId, payload);
		}
		return (await response.json()) as T;
	}
}

/** Decode the base-64 `image` field of a response into a Blob, or null if absent. */
export function imageResponseToBlob(response: V2ImageResponse, mimeType = "image/png"): Blob | null {
	if (response.image === undefined || response.image === "") {
		return null;
	}
	const binary = atob(response.image);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new Blob([bytes], { type: mimeType });
}

/**
 * Decode the base-64 `image` field of a response into an object URL suitable
 * for an `<img src>`, or null if absent. Callers own the URL and should
 * release it with `URL.revokeObjectURL` when done.
 */
export function imageResponseToObjectUrl(response: V2ImageResponse, mimeType = "image/png"): string | null {
	const blob = imageResponseToBlob(response, mimeType);
	return blob === null ? null : URL.createObjectURL(blob);
}
