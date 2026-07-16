import { describe, expect, it } from "vitest";
import {
  addRegion,
  clampBBox,
  moveRegion,
  parseLayoutJson,
  removeRegion,
  resizeRegion,
  stringifyLayout,
  uniqueLabel,
  updateRegion,
} from "./layoutEditing";
import type { Layout } from "./types";

const sampleLayout: Layout = {
  prompt: "a mountain scene",
  width: 1024,
  height: 768,
  regions: [
    { label: "mountain", prompt: "a snow peak", bbox: { x0: 0, y0: 0, x1: 0.5, y1: 1 } },
  ],
};

describe("stringifyLayout", () => {
  it("orders known keys with prompt first and regions last", () => {
    const text = stringifyLayout(sampleLayout);
    const keys = Object.keys(JSON.parse(text));
    expect(keys).toEqual(["prompt", "width", "height", "regions"]);
  });

  it("preserves unknown top-level fields, appended after known ones", () => {
    const withExtra = { ...sampleLayout, normalized_edit_instruction: "make it snowier" } as Layout;
    const text = stringifyLayout(withExtra);
    const parsed = JSON.parse(text);
    expect(parsed.normalized_edit_instruction).toBe("make it snowier");
  });
});

describe("parseLayoutJson", () => {
  it("round-trips a valid layout", () => {
    const text = stringifyLayout(sampleLayout);
    const parsed = parseLayoutJson(text);
    expect(parsed.regions).toHaveLength(1);
    expect(parsed.regions[0].label).toBe("mountain");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseLayoutJson("{not json")).toThrow();
  });

  it("throws when a region is missing a required field", () => {
    const bad = JSON.stringify({ regions: [{ label: "x" }] });
    expect(() => parseLayoutJson(bad)).toThrow();
  });
});

describe("clampBBox", () => {
  it("clamps out-of-range coordinates into [0,1]", () => {
    expect(clampBBox({ x0: -0.5, y0: -1, x1: 1.5, y1: 2 })).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
  });

  it("normalizes an inverted box (drag up-left) so x0<=x1, y0<=y1", () => {
    expect(clampBBox({ x0: 0.8, y0: 0.9, x1: 0.2, y1: 0.1 })).toEqual({
      x0: 0.2,
      y0: 0.1,
      x1: 0.8,
      y1: 0.9,
    });
  });
});

describe("region editing helpers", () => {
  it("addRegion assigns a unique label and clamps the bbox", () => {
    const next = addRegion(sampleLayout, { x0: -1, y0: 0, x1: 2, y1: 1 });
    expect(next.regions).toHaveLength(2);
    expect(next.regions[1].label).toBe("region");
    expect(next.regions[1].bbox).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
  });

  it("uniqueLabel avoids collisions", () => {
    const layout: Layout = {
      regions: [
        { label: "region", prompt: "", bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
        { label: "region-2", prompt: "", bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
      ],
    };
    expect(uniqueLabel(layout.regions, "region")).toBe("region-3");
  });

  it("removeRegion clears dangling parent references", () => {
    const layout: Layout = {
      regions: [
        { label: "car", prompt: "a car", bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
        { label: "wheel", prompt: "a wheel", parent: "car", bbox: { x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2 } },
      ],
    };
    const next = removeRegion(layout, 0);
    expect(next.regions).toHaveLength(1);
    expect(next.regions[0].parent).toBeUndefined();
  });

  it("moveRegion translates and clamps within [0, 1-width]", () => {
    const next = moveRegion(sampleLayout, 0, 0.9, 0);
    // width is 0.5, so x0 can go up to 0.5 max.
    expect(next.regions[0].bbox.x0).toBeCloseTo(0.5);
    expect(next.regions[0].bbox.x1).toBeCloseTo(1);
  });

  it("resizeRegion applies a clamped bbox", () => {
    const next = resizeRegion(sampleLayout, 0, { x0: -1, y0: 0, x1: 0.3, y1: 0.4 });
    expect(next.regions[0].bbox).toEqual({ x0: 0, y0: 0, x1: 0.3, y1: 0.4 });
  });

  it("updateRegion preserves unrelated region fields", () => {
    const layout: Layout = {
      regions: [
        {
          label: "face",
          prompt: "a face",
          region_type: "face",
          image_index: 2,
          bbox: { x0: 0, y0: 0, x1: 1, y1: 1 },
        },
      ],
    };
    const next = updateRegion(layout, 0, { prompt: "a smiling face" });
    expect(next.regions[0].region_type).toBe("face");
    expect(next.regions[0].image_index).toBe(2);
    expect(next.regions[0].prompt).toBe("a smiling face");
  });
});
