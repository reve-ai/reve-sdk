import { describe, expect, it } from "vitest";
import { blobDownloadPageSrc, blobDownloadSrc, blobSrc } from "./blobSrc";

const image = {
  id: "11111111-1111-1111-1111-111111111111",
  mediaType: "image/png",
};

describe("blobSrc", () => {
  it("builds the original and thumbnail URLs", () => {
    expect(blobSrc(image)).toBe(`/api/blobs/${image.id}`);
    expect(blobSrc(image, 480)).toBe(`/api/blobs/${image.id}?w=480`);
  });

  it("returns undefined without an image id", () => {
    expect(blobSrc(undefined)).toBeUndefined();
    expect(blobDownloadSrc(null)).toBeUndefined();
    expect(blobDownloadPageSrc(null)).toBeUndefined();
  });
});

describe("download URLs", () => {
  it("builds the attachment and sandbox-escape handoff URLs", () => {
    expect(blobDownloadSrc(image)).toBe(`/api/blobs/${image.id}?download=1`);
    expect(blobDownloadPageSrc(image)).toBe(`/download/${image.id}`);
  });
});
