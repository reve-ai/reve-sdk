"use client";

import { useStore } from "@xyflow/react";
import { shallow } from "zustand/shallow";
import { orderedReferenceGroups, type PositionLookup } from "@/lib/referenceOrdering";
import type { NodeOutput } from "@/lib/types";

type NodeDataWithOutput = { output?: NodeOutput };

/**
 * Reads the single upstream node's output connected to (nodeId, handleId).
 * Mirrors m3's dataflow model: nodes never receive values *through* an
 * edge's payload — an edge only says "this handle may read that node's
 * `data.output`". Returns null if nothing is connected.
 */
export function useUpstream(nodeId: string, handleId: string): NodeOutput | null {
  return useStore((s) => {
    const incoming = s.edges.find(
      (e) => e.target === nodeId && (e.targetHandle ?? null) === handleId,
    );
    if (!incoming) return null;
    const src = s.nodes.find((n) => n.id === incoming.source);
    const out = (src?.data as NodeDataWithOutput | undefined)?.output;
    return out ?? null;
  }, shallow);
}

export interface ReferenceInput {
  sourceNodeId: string;
  sourceHandles: Set<string>;
  output: NodeOutput | null;
}

/**
 * Reads all upstream nodes wired into a multi-input `references` handle,
 * grouped by source node and ordered by source Y-position (see
 * `orderedReferenceGroups` — this is the documented, deterministic ordering
 * rule for multi-reference inputs).
 *
 * Note: this selector allocates fresh objects each call, so `shallow`
 * equality won't dedupe re-renders across unrelated store updates on graphs
 * with many nodes. Acceptable for this demo's scale; a memoized selector
 * would be the fix if profiling ever showed it mattering.
 */
export function useReferenceInputs(nodeId: string, handleId: string): ReferenceInput[] {
  return useStore((s) => {
    const positions: PositionLookup = {};
    for (const n of s.nodes) positions[n.id] = { y: n.position.y };
    const groups = orderedReferenceGroups(s.edges, nodeId, handleId, positions);
    return groups.map((g) => {
      const src = s.nodes.find((n) => n.id === g.sourceNodeId);
      const out = (src?.data as NodeDataWithOutput | undefined)?.output ?? null;
      return { ...g, output: out };
    });
  }, shallow);
}
