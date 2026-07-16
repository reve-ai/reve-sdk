import { describe, expect, it } from "vitest";
import { sniffImageMediaType } from "./imageSniff";

// A real, minimal 1x1 transparent PNG (widely used as a test fixture).
const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("sniffImageMediaType", () => {
  it("recognizes a real PNG by magic number, not by a claimed type", () => {
    const bytes = Buffer.from(PNG_1X1_BASE64, "base64");
    expect(sniffImageMediaType(bytes)).toBe("image/png");
  });

  it("recognizes a JPEG signature", () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(sniffImageMediaType(bytes)).toBe("image/jpeg");
  });

  it("recognizes a WEBP signature (RIFF....WEBP)", () => {
    const bytes = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("WEBP"),
    ]);
    expect(sniffImageMediaType(bytes)).toBe("image/webp");
  });

  it("rejects bytes that don't match any accepted image format", () => {
    // A spoofed upload: claims to be an image but is actually a script.
    const bytes = Buffer.from("#!/bin/sh\necho hi\n");
    expect(sniffImageMediaType(bytes)).toBeNull();
  });

  it("rejects an empty buffer", () => {
    expect(sniffImageMediaType(Buffer.alloc(0))).toBeNull();
  });
});
