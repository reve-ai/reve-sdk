import { describe, expect, it, vi } from "vitest";
import {
  MAX_LAYOUT_FILE_BYTES,
  classifyImportFile,
  importLayoutFile,
  validateLayoutFileClientSide,
  type ImportFileLike,
} from "./fileImports";

function file(
  overrides: Partial<ImportFileLike> & { text?: () => Promise<string> } = {},
): ImportFileLike {
  return {
    name: "layout.json",
    type: "application/json",
    size: 32,
    text: async () => '{"regions":[]}',
    ...overrides,
  };
}

describe("classifyImportFile", () => {
  it("recognizes layouts by extension or JSON MIME", () => {
    expect(classifyImportFile(file({ name: "scene.json", type: "" }))).toBe("layout");
    expect(classifyImportFile(file({ name: "scene", type: "application/json" }))).toBe("layout");
  });

  it("recognizes images by MIME or supported extension", () => {
    expect(classifyImportFile(file({ name: "photo", type: "image/png" }))).toBe("image");
    expect(classifyImportFile(file({ name: "photo.WEBP", type: "" }))).toBe("image");
  });

  it("rejects unrelated files", () => {
    expect(classifyImportFile(file({ name: "notes.txt", type: "text/plain" }))).toBeNull();
  });
});

describe("layout file validation and import", () => {
  it("rejects non-JSON and oversized files before reading", async () => {
    expect(validateLayoutFileClientSide(file({ name: "layout.txt", type: "text/plain" })))
      .toMatch(/JSON file/);

    const text = vi.fn(async () => '{"regions":[]}');
    const result = await importLayoutFile(
      file({ size: MAX_LAYOUT_FILE_BYTES + 1, text }),
    );
    expect(result).toEqual({
      ok: false,
      error: "Layout file is 1.0MB; the limit is 1MB.",
    });
    expect(text).not.toHaveBeenCalled();
  });

  it("imports and canonicalizes a valid layout", async () => {
    const result = await importLayoutFile(
      file({
        text: async () =>
          JSON.stringify({
            width: 1024,
            regions: [
              {
                label: "sky",
                prompt: "blue sky",
                bbox: { x0: 0, y0: 0, x1: 1, y1: 0.5 },
              },
            ],
          }),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layout.width).toBe(1024);
    expect(result.layout.regions[0]?.label).toBe("sky");
    expect(JSON.parse(result.draft)).toEqual(result.layout);
  });

  it("returns invalid content as an editable draft without producing output", async () => {
    const raw = '{"regions":[{"label":"missing fields"}]}';
    const result = await importLayoutFile(file({ text: async () => raw }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.draft).toBe(raw);
    expect(result.error).toMatch(/^Invalid layout:/);
  });

  it("returns a concise syntax error for malformed JSON", async () => {
    const result = await importLayoutFile(file({ text: async () => "{oops" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.draft).toBe("{oops");
    expect(result.error).toMatch(/^Invalid JSON:/);
  });
});
