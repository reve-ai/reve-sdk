import { describe, expect, it } from "vitest";
import { computeTopologicalWaves, wouldCreateCycle } from "./graphOrder";

describe("computeTopologicalWaves", () => {
  it("orders a linear chain into one node per wave", () => {
    const { waves, cyclic } = computeTopologicalWaves(
      ["A", "B", "C"],
      [
        { source: "A", target: "B" },
        { source: "B", target: "C" },
      ],
    );
    expect(waves).toEqual([["A"], ["B"], ["C"]]);
    expect(cyclic).toEqual([]);
  });

  it("groups independent branches of a diamond into the same wave", () => {
    const { waves, cyclic } = computeTopologicalWaves(
      ["A", "B", "C", "D"],
      [
        { source: "A", target: "B" },
        { source: "A", target: "C" },
        { source: "B", target: "D" },
        { source: "C", target: "D" },
      ],
    );
    expect(waves[0]).toEqual(["A"]);
    expect(new Set(waves[1])).toEqual(new Set(["B", "C"]));
    expect(waves[2]).toEqual(["D"]);
    expect(cyclic).toEqual([]);
  });

  it("excludes nodes on a cycle from waves instead of hanging", () => {
    const { waves, cyclic } = computeTopologicalWaves(
      ["A", "B", "C"],
      [
        { source: "A", target: "B" },
        { source: "B", target: "A" },
        { source: "A", target: "C" },
      ],
    );
    // A and B form a cycle; C depends on A, which never becomes ready, so C
    // never fires either.
    expect(cyclic.sort()).toEqual(["A", "B", "C"]);
    expect(waves.flat()).toEqual([]);
  });

  it("treats disconnected nodes as immediately ready", () => {
    const { waves } = computeTopologicalWaves(["A", "B"], []);
    expect(new Set(waves[0])).toEqual(new Set(["A", "B"]));
  });

  it("ignores edges referencing ids outside the given node set", () => {
    const { waves, cyclic } = computeTopologicalWaves(
      ["A", "B"],
      [{ source: "A", target: "OUTSIDE" }],
    );
    expect(new Set(waves[0])).toEqual(new Set(["A", "B"]));
    expect(cyclic).toEqual([]);
  });
});

describe("wouldCreateCycle", () => {
  it("flags a self-loop", () => {
    expect(wouldCreateCycle([], "A", "A")).toBe(true);
  });

  it("flags an edge that would close an existing chain into a cycle", () => {
    const edges = [
      { source: "A", target: "B" },
      { source: "B", target: "C" },
    ];
    // C -> A would close the loop A->B->C->A.
    expect(wouldCreateCycle(edges, "C", "A")).toBe(true);
  });

  it("allows an edge that does not create a cycle", () => {
    const edges = [{ source: "A", target: "B" }];
    expect(wouldCreateCycle(edges, "A", "C")).toBe(false);
  });
});
