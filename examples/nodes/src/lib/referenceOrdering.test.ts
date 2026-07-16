import { describe, expect, it } from "vitest";
import { orderedReferenceGroups, type EdgeLike, type PositionLookup } from "./referenceOrdering";

describe("orderedReferenceGroups", () => {
  it("orders groups by source node Y position, top to bottom", () => {
    const edges: EdgeLike[] = [
      { source: "low", sourceHandle: "image", target: "T", targetHandle: "references" },
      { source: "high", sourceHandle: "image", target: "T", targetHandle: "references" },
    ];
    const positions: PositionLookup = { low: { y: 500 }, high: { y: 10 } };
    const groups = orderedReferenceGroups(edges, "T", "references", positions);
    expect(groups.map((g) => g.sourceNodeId)).toEqual(["high", "low"]);
  });

  it("groups two edges from the same source node (image + layout handles) into one reference", () => {
    const edges: EdgeLike[] = [
      { source: "A", sourceHandle: "image", target: "T", targetHandle: "references" },
      { source: "A", sourceHandle: "layout", target: "T", targetHandle: "references" },
    ];
    const groups = orderedReferenceGroups(edges, "T", "references", {});
    expect(groups).toHaveLength(1);
    expect(groups[0].sourceHandles).toEqual(new Set(["image", "layout"]));
  });

  it("breaks Y-position ties by source node id for determinism", () => {
    const edges: EdgeLike[] = [
      { source: "b", target: "T", targetHandle: "references" },
      { source: "a", target: "T", targetHandle: "references" },
    ];
    const positions: PositionLookup = { a: { y: 100 }, b: { y: 100 } };
    const groups = orderedReferenceGroups(edges, "T", "references", positions);
    expect(groups.map((g) => g.sourceNodeId)).toEqual(["a", "b"]);
  });

  it("ignores edges targeting a different handle on the same node", () => {
    const edges: EdgeLike[] = [
      { source: "A", target: "T", targetHandle: "layout" },
      { source: "B", target: "T", targetHandle: "references" },
    ];
    const groups = orderedReferenceGroups(edges, "T", "references", {});
    expect(groups.map((g) => g.sourceNodeId)).toEqual(["B"]);
  });

  it("returns an empty array when nothing is connected", () => {
    expect(orderedReferenceGroups([], "T", "references", {})).toEqual([]);
  });
});
