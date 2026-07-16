import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the disk-backed blob store so hydrate/persist logic is tested as
// pure DTO<->wire conversion, independent of the filesystem.
vi.mock("./blobStore", () => ({
  saveBlobFromBase64: vi.fn(async (base64: string) => ({
    id: "22222222-2222-2222-2222-222222222222",
    mediaType: "image/png",
    size: base64.length,
  })),
  readBlobAsBase64: vi.fn(async (id: string) => `base64-for-${id}`),
}));

import { readBlobAsBase64, saveBlobFromBase64 } from "./blobStore";
import {
  hydrateCompoundReference,
  hydrateCompoundReferences,
  hydrateImageInput,
  hydrateRawImageInputs,
  persistResponseImage,
  sanitizeLayoutForReve,
} from "./reveHydrate";

const blobId = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hydrateImageInput", () => {
  it("converts a blobId DTO into a { data } raw image input", async () => {
    const result = await hydrateImageInput({ blobId });
    expect(result).toEqual({ data: `base64-for-${blobId}` });
    expect(readBlobAsBase64).toHaveBeenCalledWith(blobId);
  });
});

describe("hydrateRawImageInputs", () => {
  it("hydrates an array of blobId DTOs in order", async () => {
    const result = await hydrateRawImageInputs([{ blobId }, { blobId: "x" }]);
    expect(result).toEqual([{ data: `base64-for-${blobId}` }, { data: "base64-for-x" }]);
  });

  it("returns undefined for an empty/undefined list (omits `references` entirely)", async () => {
    expect(await hydrateRawImageInputs(undefined)).toBeUndefined();
    expect(await hydrateRawImageInputs([])).toBeUndefined();
  });
});

describe("sanitizeLayoutForReve", () => {
  it("drops invalid and self-referencing parents while preserving valid parents", () => {
    const layout = {
      regions: [
        { label: "table", prompt: "a table", bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
        {
          label: "cup",
          prompt: "a cup",
          parent: "table",
          bbox: { x0: 0.2, y0: 0.2, x1: 0.4, y1: 0.5 },
        },
        {
          label: "<table 1>",
          prompt: "another table",
          parent: "N/A",
          bbox: { x0: 0.5, y0: 0.1, x1: 0.9, y1: 0.8 },
        },
        {
          label: "self",
          prompt: "self reference",
          parent: "self",
          bbox: { x0: 0, y0: 0, x1: 0.1, y1: 0.1 },
        },
      ],
    };

    const result = sanitizeLayoutForReve(layout);

    expect(result.regions[1].parent).toBe("table");
    expect(result.regions[2].parent).toBeUndefined();
    expect(result.regions[3].parent).toBeUndefined();
    expect(layout.regions[2].parent).toBe("N/A");
  });
});

describe("hydrateCompoundReference", () => {
  it("includes only the fields present on the DTO", async () => {
    const promptOnly = await hydrateCompoundReference({ prompt: "a red hat" });
    expect(promptOnly).toEqual({ prompt: "a red hat" });

    const layoutOnly = await hydrateCompoundReference({ layout: { regions: [] } });
    expect(layoutOnly).toEqual({ layout: { regions: [] } });
  });

  it("hydrates the image field while preserving valid layout/prompt data", async () => {
    const result = await hydrateCompoundReference({
      image: { blobId },
      layout: { regions: [] },
      prompt: "keep this pose",
    });
    expect(result).toEqual({
      image: { data: `base64-for-${blobId}` },
      layout: { regions: [] },
      prompt: "keep this pose",
    });
  });

  it("sanitizes an invalid parent sentinel in a layout reference", async () => {
    const result = await hydrateCompoundReference({
      layout: {
        regions: [
          {
            label: "<table 1>",
            prompt: "a table",
            parent: "N/A",
            bbox: { x0: 0, y0: 0, x1: 1, y1: 1 },
          },
        ],
      },
    });

    expect(result.layout?.regions[0].parent).toBeUndefined();
  });
});

describe("hydrateCompoundReferences", () => {
  it("preserves reference order", async () => {
    const result = await hydrateCompoundReferences([{ prompt: "first" }, { prompt: "second" }]);
    expect(result?.map((r) => r.prompt)).toEqual(["first", "second"]);
  });
});

describe("persistResponseImage", () => {
  it("returns undefined for a falsy/empty base64 (e.g. a content-violation response)", async () => {
    expect(await persistResponseImage(undefined)).toBeUndefined();
    expect(await persistResponseImage(null)).toBeUndefined();
    expect(await persistResponseImage("")).toBeUndefined();
    expect(saveBlobFromBase64).not.toHaveBeenCalled();
  });

  it("persists a base64 image as PNG and returns a small {id, mediaType} ref", async () => {
    const ref = await persistResponseImage("AAAA");
    expect(saveBlobFromBase64).toHaveBeenCalledWith("AAAA", "image/png");
    expect(ref).toEqual({ id: "22222222-2222-2222-2222-222222222222", mediaType: "image/png" });
  });
});
