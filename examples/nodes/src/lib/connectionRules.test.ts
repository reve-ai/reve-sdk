import { describe, expect, it } from "vitest";
import { canConnect, type EdgeLike } from "./connectionRules";

describe("canConnect", () => {
  const base = {
    sourceNodeId: "A",
    sourceHandleKind: "image" as const,
    targetNodeId: "B",
    targetHandleId: "image",
    targetHandleKind: "image" as const,
    existingEdges: [] as EdgeLike[],
  };

  it("rejects a self-loop", () => {
    const result = canConnect({ ...base, targetNodeId: "A" });
    expect(result.ok).toBe(false);
  });

  it("rejects a connection that would create a cycle", () => {
    const existingEdges: EdgeLike[] = [{ source: "B", target: "C" }];
    const result = canConnect({ ...base, sourceNodeId: "C", targetNodeId: "A", existingEdges: [
      { source: "A", target: "B" },
      ...existingEdges,
    ] });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/cycle/i);
  });

  it("rejects a kind mismatch on a typed target", () => {
    const result = canConnect({ ...base, sourceHandleKind: "layout", targetHandleKind: "image" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/layout.*image/i);
  });

  it("accepts either kind into an 'any' (references) target", () => {
    const imageResult = canConnect({ ...base, targetHandleId: "references", targetHandleKind: "any" });
    const layoutResult = canConnect({
      ...base,
      sourceHandleKind: "layout",
      targetHandleId: "references",
      targetHandleKind: "any",
    });
    expect(imageResult.ok).toBe(true);
    expect(layoutResult.ok).toBe(true);
  });

  it("rejects a second connection into an already-occupied singular target handle", () => {
    const existingEdges: EdgeLike[] = [{ source: "X", target: "B", targetHandle: "image" }];
    const result = canConnect({ ...base, existingEdges });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/already has a connection/i);
  });

  it("allows multiple connections into a non-singular (references) target handle", () => {
    const existingEdges: EdgeLike[] = [{ source: "X", target: "B", targetHandle: "references" }];
    const result = canConnect({
      ...base,
      targetHandleId: "references",
      targetHandleKind: "any",
      existingEdges,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a valid, non-conflicting connection", () => {
    expect(canConnect(base).ok).toBe(true);
  });
});
