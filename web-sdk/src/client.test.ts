import { describe, expect, it } from "vitest";

import { imageResponseToBlob, imageResponseToObjectUrl, ReveApiError, ReveClient } from "./client.js";
import type { V2ImageInfoResponse, V2ImageResponse } from "./types.js";

interface RecordedRequest {
	url: string;
	method: string | undefined;
	headers: Record<string, string>;
	body: string | undefined;
}

/** A fetch implementation that records requests and replays canned responses. */
function fetchFixture(responses: Response[]): { fetchFn: typeof fetch; requests: RecordedRequest[] } {
	const requests: RecordedRequest[] = [];
	const fetchFn: typeof fetch = async (input, init) => {
		requests.push({
			url: String(input),
			method: init?.method,
			headers: (init?.headers ?? {}) as Record<string, string>,
			body: typeof init?.body === "string" ? init.body : undefined,
		});
		const response = responses.shift();
		if (response === undefined) {
			throw new Error("fetchFixture: no response queued");
		}
		return response;
	};
	return { fetchFn, requests };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", ...headers },
	});
}

function makeClient(responses: Response[]): { client: ReveClient; requests: RecordedRequest[] } {
	const { fetchFn, requests } = fetchFixture(responses);
	const client = new ReveClient({ apiToken: "papi.test-token", apiUrl: "https://api.test/", fetch: fetchFn });
	return { client, requests };
}

describe("ReveClient", () => {
	it("posts createImage requests with the bearer token and returns the parsed response", async () => {
		const reply: V2ImageResponse = { image: "aGk=", request_id: "req-1", credits_used: 1 };
		const { client, requests } = makeClient([jsonResponse(reply)]);

		const result = await client.createImage({ prompt: "a red fox" });

		expect(result).toEqual(reply);
		expect(requests).toHaveLength(1);
		const request = requests[0];
		expect(request?.url).toBe("https://api.test/v2/image/create");
		expect(request?.method).toBe("POST");
		expect(request?.headers.authorization).toBe("Bearer papi.test-token");
		expect(JSON.parse(request?.body ?? "")).toEqual({ prompt: "a red fox" });
	});

	it("throws ReveApiError with status, requestId, and payload on non-2xx responses", async () => {
		const payload = { message: "quota exceeded" };
		const { client } = makeClient([jsonResponse(payload, 429, { "x-reve-request-id": "req-9" })]);

		const error = await client.createImage({ prompt: "x" }).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ReveApiError);
		const apiError = error as ReveApiError;
		expect(apiError.message).toBe("Reve API error 429: quota exceeded");
		expect(apiError.status).toBe(429);
		expect(apiError.requestId).toBe("req-9");
		expect(apiError.payload).toEqual(payload);
	});

	it("routes each layout endpoint to its API path", async () => {
		const cases = [
			{
				call: (client: ReveClient): Promise<V2ImageResponse> =>
					client.extractLayout({ image: { data: "aGk=" } }),
				path: "/v2/image/extract_layout",
			},
			{
				call: (client: ReveClient): Promise<V2ImageResponse> =>
					client.createLayout({ instruction: "add a dog" }),
				path: "/v2/image/create_layout",
			},
			{
				call: (client: ReveClient): Promise<V2ImageResponse> =>
					client.renderLayout({ layout: { regions: [] } }),
				path: "/v2/image/render_layout",
			},
		];
		for (const { call, path } of cases) {
			const { client, requests } = makeClient([jsonResponse({})]);
			await call(client);
			expect(requests[0]?.url).toBe(`https://api.test${path}`);
		}
	});

	it("reports the HTTP status text when the error body is not JSON", async () => {
		const { client } = makeClient([new Response("oops", { status: 503, statusText: "Service Unavailable" })]);

		const error = await client.getImageInfo().catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ReveApiError);
		expect((error as ReveApiError).message).toBe("Reve API error 503: Service Unavailable");
	});

	it("lists effects without a query string when no source is given", async () => {
		const { client, requests } = makeClient([jsonResponse({ effects: [] })]);

		await client.listEffects();

		expect(requests[0]?.url).toBe("https://api.test/v1/image/effect");
	});

	it("lists effects with the source filter as a query parameter", async () => {
		const effects = [{ name: "glow", source: "preset" }];
		const { client, requests } = makeClient([jsonResponse({ effects })]);

		const result = await client.listEffects("preset");

		expect(result).toEqual(effects);
		expect(requests[0]?.url).toBe("https://api.test/v1/image/effect?source=preset");
		expect(requests[0]?.method).toBe("GET");
	});

	it("returns the postprocessing cost list from the image info endpoint", async () => {
		const info: V2ImageInfoResponse = {
			operations: [{ operation: "create", credits: 1 }],
			postprocessing: [{ process: "upscale", credits_base: 1, credits_per_megapixel: 2 }],
		};
		const { client, requests } = makeClient([jsonResponse(info)]);

		const result = await client.listPostprocessors();

		expect(result).toEqual(info.postprocessing);
		expect(requests[0]?.url).toBe("https://api.test/v2/image/info");
	});
});

describe("imageResponseToBlob", () => {
	it("decodes the base-64 image field into a Blob of the given type", async () => {
		const blob = imageResponseToBlob({ image: btoa("hello") }, "image/webp");

		expect(blob).not.toBeNull();
		expect(blob?.type).toBe("image/webp");
		expect(await blob?.text()).toBe("hello");
	});

	it("returns null when the response carries no image", () => {
		expect(imageResponseToBlob({})).toBeNull();
		expect(imageResponseToBlob({ image: "" })).toBeNull();
	});
});

describe("imageResponseToObjectUrl", () => {
	it("returns an object URL for a response with an image and null otherwise", () => {
		const url = imageResponseToObjectUrl({ image: btoa("hi") });
		expect(url).toMatch(/^blob:/);
		if (url !== null) {
			URL.revokeObjectURL(url);
		}

		expect(imageResponseToObjectUrl({})).toBeNull();
	});
});
