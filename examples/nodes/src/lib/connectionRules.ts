// Pure connection-validation logic, shared by Canvas's `isValidConnection`
// and unit tests. Encodes: no self-loops, no cycles, handle-type matching,
// and "singular" target handles (image/layout) accepting at most one edge.

import { wouldCreateCycle, type GraphEdgeLike } from "./graphOrder";

export type HandleKind = "image" | "layout";
/** A target handle's accepted kind: "image" or "layout" for a plain typed
 * input, or "any" for a `references` handle that accepts either. */
export type TargetHandleKind = HandleKind | "any";

export const SINGULAR_TARGET_HANDLES = new Set(["image", "layout"]);

export interface EdgeLike {
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
}

export interface ConnectionCheck {
  sourceNodeId: string;
  sourceHandleKind: HandleKind | null;
  targetNodeId: string;
  targetHandleId: string;
  targetHandleKind: TargetHandleKind;
  existingEdges: EdgeLike[];
}

export interface ConnectionResult {
  ok: boolean;
  reason?: string;
}

export function canConnect(check: ConnectionCheck): ConnectionResult {
  const { sourceNodeId, sourceHandleKind, targetNodeId, targetHandleId, targetHandleKind, existingEdges } =
    check;

  if (sourceNodeId === targetNodeId) {
    return { ok: false, reason: "A node cannot connect to itself." };
  }

  const asGraphEdges: GraphEdgeLike[] = existingEdges.map((e) => ({
    source: e.source,
    target: e.target,
  }));
  if (wouldCreateCycle(asGraphEdges, sourceNodeId, targetNodeId)) {
    return { ok: false, reason: "This connection would create a cycle." };
  }

  if (targetHandleKind !== "any" && sourceHandleKind !== targetHandleKind) {
    return {
      ok: false,
      reason: `Cannot connect a "${sourceHandleKind ?? "unknown"}" output to a "${targetHandleKind}" input.`,
    };
  }

  if (SINGULAR_TARGET_HANDLES.has(targetHandleId)) {
    const occupied = existingEdges.some(
      (e) => e.target === targetNodeId && (e.targetHandle ?? null) === targetHandleId,
    );
    if (occupied) {
      return { ok: false, reason: "This input already has a connection — remove it first." };
    }
  }

  return { ok: true };
}
