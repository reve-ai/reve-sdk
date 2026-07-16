// Declarative registry of the 7 node types: palette entries, default data,
// and each handle's value-kind (used by Canvas's `isValidConnection`).
//
// NOTE on duplication: each node component also declares its own `inputs`/
// `outputs` PortSpec arrays for NodeShell (needed there because labels are
// often dynamic, e.g. "references (2/8)"). This registry is the source of
// truth for *validation* (kind matching); the per-node arrays are the source
// of truth for *rendering*. Both are small and static (7 node types) — if
// you add a port to a node, update both places.

import type { HandleKind, TargetHandleKind } from "./connectionRules";

export type ReactFlowNodeType =
  | "v2Create"
  | "extractLayout"
  | "createLayout"
  | "renderLayout"
  | "layoutEditor"
  | "imageEditor"
  | "image";

export interface SourcePortDef {
  id: string;
  kind: HandleKind;
}
export interface TargetPortDef {
  id: string;
  kind: TargetHandleKind;
}

export interface NodeTypeDef {
  type: ReactFlowNodeType;
  label: string;
  description: string;
  inputs: TargetPortDef[];
  outputs: SourcePortDef[];
  defaultData: Record<string, unknown>;
}

export const NODE_REGISTRY: NodeTypeDef[] = [
  {
    type: "v2Create",
    label: "V2 Create",
    description: "Generate an image (plus a description layout) from a prompt and optional raw reference images.",
    inputs: [{ id: "references", kind: "image" }],
    outputs: [
      { id: "image", kind: "image" },
      { id: "layout", kind: "layout" },
    ],
    defaultData: { aspectRatio: "auto" },
  },
  {
    type: "extractLayout",
    label: "Extract Layout",
    description: "Extract a structured layout from a single image, optionally guided by a prompt.",
    inputs: [{ id: "image", kind: "image" }],
    outputs: [{ id: "layout", kind: "layout" }],
    defaultData: {},
  },
  {
    type: "createLayout",
    label: "Create Layout",
    description: "Generate a layout from a prompt, ordered image/layout references, and/or imperative commands.",
    inputs: [{ id: "references", kind: "any" }],
    outputs: [{ id: "layout", kind: "layout" }],
    defaultData: { aspectRatio: "auto" },
  },
  {
    type: "renderLayout",
    label: "Render Layout",
    description: "Render a final image from a target layout and optional ordered references.",
    inputs: [
      { id: "layout", kind: "layout" },
      { id: "references", kind: "any" },
    ],
    outputs: [
      { id: "image", kind: "image" },
      { id: "layout", kind: "layout" },
    ],
    defaultData: {},
  },
  {
    type: "layoutEditor",
    label: "Layout Editor",
    description: "Upload, drop, edit, and download layout JSON; auto-syncs from upstream until you start typing.",
    inputs: [{ id: "layout", kind: "layout" }],
    outputs: [{ id: "layout", kind: "layout" }],
    defaultData: {},
  },
  {
    type: "imageEditor",
    label: "Image Editor",
    description: "Draw, move, resize, and label regions directly on an image to build a layout.",
    inputs: [
      { id: "image", kind: "image" },
      { id: "layout", kind: "layout" },
    ],
    outputs: [
      { id: "layout", kind: "layout" },
      { id: "image", kind: "image" },
    ],
    defaultData: {},
  },
  {
    type: "image",
    label: "Image",
    description: "Upload, drop, or paste an image; preview, download, and pass it downstream.",
    inputs: [
      { id: "image", kind: "image" },
      { id: "layout", kind: "layout" },
    ],
    outputs: [{ id: "image", kind: "image" }],
    defaultData: {},
  },
];

function findDef(type: string | undefined): NodeTypeDef | undefined {
  return NODE_REGISTRY.find((n) => n.type === type);
}

/** Kind of a node's OUTPUT (source) handle. Source ports are never "any". */
export function sourcePortKind(type: string | undefined, handleId: string | null | undefined): HandleKind | null {
  const def = findDef(type);
  if (!def) return null;
  const port = def.outputs.find((p) => p.id === (handleId ?? def.outputs[0]?.id));
  return port?.kind ?? null;
}

/** Kind accepted by a node's INPUT (target) handle — may be "any". */
export function targetPortKind(type: string | undefined, handleId: string | null | undefined): TargetHandleKind | null {
  const def = findDef(type);
  if (!def) return null;
  const port = def.inputs.find((p) => p.id === (handleId ?? def.inputs[0]?.id));
  return port?.kind ?? null;
}

export function defaultDataFor(type: string): Record<string, unknown> {
  return { ...(findDef(type)?.defaultData ?? {}) };
}
