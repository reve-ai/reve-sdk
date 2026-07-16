"use client";

import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";

/**
 * Watches the `runRequestedAt` timestamp set by Canvas's "Run all" and fires
 * the node's local `run()` exactly once per request. Records
 * `lastRunHandledAt = ts` when done (success or failure) so "Run all"'s
 * wave scheduler can detect completion. Ported near-verbatim from the m3
 * prototype's `useRunSignal` — this exact per-node "fire once per new
 * timestamp" contract is what lets whole-graph runs and individual node Run
 * buttons share one `run()` implementation safely.
 */
export function useRunSignal(
  nodeId: string,
  data: { runRequestedAt?: number; lastRunHandledAt?: number },
  run: () => Promise<void> | void,
) {
  const { updateNodeData } = useReactFlow();
  useEffect(() => {
    const ts = data.runRequestedAt;
    if (!ts) return;
    if ((data.lastRunHandledAt ?? 0) >= ts) return;
    let cancelled = false;
    (async () => {
      try {
        await Promise.resolve(run());
      } finally {
        if (!cancelled) updateNodeData(nodeId, { lastRunHandledAt: ts });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-fire on a new request timestamp; `run` is a fresh closure each
    // render but the effect body always captures the latest one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.runRequestedAt]);
}
