// Pure helper for the "multiple reference inputs must be deterministic"
// requirement. A references-style target handle can receive edges from
// several upstream nodes (and a single upstream node may connect via both
// its `image` and `layout` source handles to contribute one *compound*
// reference). We order the resulting reference list by the source node's
// canvas Y position (top to bottom), breaking ties by node id — documented
// in the README "Multi-reference ordering" section.

export interface EdgeLike {
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
}

export interface PositionLookup {
  [nodeId: string]: { y: number } | undefined;
}

export interface ReferenceGroup {
  sourceNodeId: string;
  /** Which source handle ids connected from this node (e.g. {"image"},
   * {"layout"}, or {"image","layout"} if both were wired into the same
   * references handle). */
  sourceHandles: Set<string>;
}

export function orderedReferenceGroups(
  edges: EdgeLike[],
  targetNodeId: string,
  targetHandleId: string,
  positions: PositionLookup,
): ReferenceGroup[] {
  const incoming = edges.filter(
    (e) => e.target === targetNodeId && (e.targetHandle ?? null) === targetHandleId,
  );
  const groups = new Map<string, Set<string>>();
  for (const e of incoming) {
    const set = groups.get(e.source) ?? new Set<string>();
    if (e.sourceHandle) set.add(e.sourceHandle);
    groups.set(e.source, set);
  }
  return Array.from(groups.entries())
    .map(([sourceNodeId, sourceHandles]) => ({ sourceNodeId, sourceHandles }))
    .sort((a, b) => {
      const ay = positions[a.sourceNodeId]?.y ?? 0;
      const by = positions[b.sourceNodeId]?.y ?? 0;
      if (ay !== by) return ay - by;
      return a.sourceNodeId.localeCompare(b.sourceNodeId);
    });
}
