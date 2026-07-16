import { describe, expect, it } from "vitest";
import { findOpenNodePosition } from "./nodePlacement";

describe("findOpenNodePosition", () => {
  it("uses the first teaching-grid slot for an empty graph", () => {
    expect(findOpenNodePosition([])).toEqual({ x: 40, y: 20 });
  });

  it("skips occupied columns and rows deterministically", () => {
    const nodes = [
      { position: { x: 40, y: 220 } },
      { position: { x: 460, y: 20 } },
      { position: { x: 460, y: 400 } },
      { position: { x: 830, y: 20 } },
      { position: { x: 830, y: 400 } },
    ];

    expect(findOpenNodePosition(nodes)).toEqual({ x: 40, y: 780 });
  });

  it("uses measured node dimensions when React Flow provides them", () => {
    const nodes = [
      { position: { x: 40, y: 20 }, measured: { width: 1200, height: 100 } },
    ];

    expect(findOpenNodePosition(nodes, { columns: 3 })).toEqual({ x: 40, y: 400 });
  });
});
