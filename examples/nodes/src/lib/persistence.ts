// Local persistence for the graph. Safe to use localStorage (rather than
// IndexedDB) precisely because node data never holds base64 image bytes —
// only small `{id, mediaType}` blob references — so the serialized graph
// stays well under localStorage's per-origin quota regardless of how many
// (or how large) images the workflow has produced.

import type { Edge, Node } from "@xyflow/react";

const STORAGE_KEY = "reve-nodes:workflow:v1";

export interface PersistedGraph {
  nodes: Node[];
  edges: Edge[];
  savedAt: number;
}

export function saveGraph(nodes: Node[], edges: Edge[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedGraph = { nodes, edges, savedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[reve-nodes] failed to save graph:", err);
  }
}

export function loadGraph(): PersistedGraph | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedGraph;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[reve-nodes] failed to load graph:", err);
    return null;
  }
}

export function clearGraph(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
