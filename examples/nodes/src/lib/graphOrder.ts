// Pure graph-ordering helpers — no React Flow / DOM dependency — so they can
// be unit tested directly and reused by both "Run node" (single-node,
// trivial) and "Run all" (whole-graph, wave-based) execution paths.

export interface GraphEdgeLike {
  source: string;
  target: string;
}

export interface TopologicalWaves {
  /** Each wave is a list of node ids whose dependencies are all satisfied by
   * strictly earlier waves; waves run in order, nodes within a wave can run
   * concurrently. */
  waves: string[][];
  /** Node ids that never became ready because they sit on a cycle (or depend
   * on one). Excluded from `waves` so a cycle can't hang a run. */
  cyclic: string[];
}

/** Kahn's algorithm over the given node id set and edge set (edges outside
 * the id set are ignored, so callers can scope this to a subgraph). */
export function computeTopologicalWaves(
  nodeIds: string[],
  edges: GraphEdgeLike[],
): TopologicalWaves {
  const idSet = new Set(nodeIds);
  const relevantEdges = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target));

  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) {
    indegree.set(id, 0);
    adjacency.set(id, []);
  }
  for (const e of relevantEdges) {
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
    adjacency.get(e.source)!.push(e.target);
  }

  const remaining = new Map(indegree);
  const visited = new Set<string>();
  const waves: string[][] = [];
  let frontier = nodeIds.filter((id) => (indegree.get(id) ?? 0) === 0);

  while (frontier.length > 0) {
    waves.push(frontier);
    const next: string[] = [];
    for (const id of frontier) {
      visited.add(id);
      for (const dep of adjacency.get(id) ?? []) {
        const cur = (remaining.get(dep) ?? 0) - 1;
        remaining.set(dep, cur);
        if (cur === 0) next.push(dep);
      }
    }
    frontier = next;
  }

  const cyclic = nodeIds.filter((id) => !visited.has(id));
  return { waves, cyclic };
}

/** Returns true if adding an edge `newSource -> newTarget` to the existing
 * edge set would create a cycle (i.e. `newTarget` can already reach
 * `newSource`). Used by connection validation to reject cyclic wiring before
 * it ever lands in the graph. */
export function wouldCreateCycle(
  edges: GraphEdgeLike[],
  newSource: string,
  newTarget: string,
): boolean {
  if (newSource === newTarget) return true;
  const stack = [newTarget];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    if (cur === newSource) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const e of edges) {
      if (e.source === cur) stack.push(e.target);
    }
  }
  return false;
}
