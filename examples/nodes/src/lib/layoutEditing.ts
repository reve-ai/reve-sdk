// Pure layout/region editing helpers shared by the Layout Editor (raw JSON)
// and Image Editor (direct-manipulation) nodes. Keeping these as plain
// functions — no React, no DOM — makes the actual editing math unit
// testable without rendering anything.

import { layoutSchema } from "./validation";
import type { BBox, Layout, Region } from "./types";

const LAYOUT_KEY_ORDER = ["prompt", "normalized_edit_instruction", "width", "height", "regions"];

/** Serializes a layout with a stable, human-friendly key order (overall
 * fields first, regions last) instead of whatever order the API/JSON.parse
 * happened to produce — makes hand-editing in the Layout Editor pleasant and
 * diffs readable. Unknown fields are preserved and appended at the end. */
export function stringifyLayout(layout: Layout): string {
  const ordered: Record<string, unknown> = {};
  const obj = layout as unknown as Record<string, unknown>;
  for (const k of LAYOUT_KEY_ORDER) {
    if (obj[k] !== undefined) ordered[k] = obj[k];
  }
  for (const k of Object.keys(obj)) {
    if (!(k in ordered)) ordered[k] = obj[k];
  }
  return JSON.stringify(ordered, null, 2);
}

/** Parses and validates layout JSON text, throwing a short human-readable
 * message on failure (used by the Layout Editor's error state). */
export function parseLayoutJson(text: string): Layout {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Malformed JSON.";
    throw new Error(`Invalid JSON: ${detail}`);
  }

  const result = layoutSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid layout: ${details}`);
  }
  return result.data as Layout;
}

export function emptyLayout(): Layout {
  return { regions: [] };
}

/** Clamps a bbox into [0,1] and normalizes it so x0<=x1, y0<=y1 — protects
 * against inverted drags (dragging up-left) producing an invalid box. */
export function clampBBox(b: BBox): BBox {
  const cx0 = Math.min(Math.max(0, b.x0), 1);
  const cy0 = Math.min(Math.max(0, b.y0), 1);
  const cx1 = Math.min(Math.max(0, b.x1), 1);
  const cy1 = Math.min(Math.max(0, b.y1), 1);
  return {
    x0: Math.min(cx0, cx1),
    y0: Math.min(cy0, cy1),
    x1: Math.max(cx0, cx1),
    y1: Math.max(cy0, cy1),
  };
}

export function uniqueLabel(existing: Region[], base = "region"): string {
  const labels = new Set(existing.map((r) => r.label));
  if (!labels.has(base)) return base;
  let i = 2;
  while (labels.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export function addRegion(layout: Layout, bbox: BBox): Layout {
  const region: Region = {
    label: uniqueLabel(layout.regions, "region"),
    prompt: "",
    bbox: clampBBox(bbox),
  };
  return { ...layout, regions: [...layout.regions, region] };
}

export function updateRegion(layout: Layout, index: number, patch: Partial<Region>): Layout {
  const regions = layout.regions.map((r, i) => (i === index ? { ...r, ...patch } : r));
  return { ...layout, regions };
}

/** Removes a region and clears any `parent` pointers that referenced it, so
 * we never emit a layout with a dangling parent reference. */
export function removeRegion(layout: Layout, index: number): Layout {
  const removedLabel = layout.regions[index]?.label;
  const regions = layout.regions
    .filter((_, i) => i !== index)
    .map((r) => (r.parent === removedLabel ? { ...r, parent: undefined } : r));
  return { ...layout, regions };
}

export function moveRegion(layout: Layout, index: number, dx: number, dy: number): Layout {
  const region = layout.regions[index];
  if (!region) return layout;
  const { bbox } = region;
  const width = bbox.x1 - bbox.x0;
  const height = bbox.y1 - bbox.y0;
  const x0 = Math.min(Math.max(0, bbox.x0 + dx), 1 - width);
  const y0 = Math.min(Math.max(0, bbox.y0 + dy), 1 - height);
  return updateRegion(layout, index, { bbox: { x0, y0, x1: x0 + width, y1: y0 + height } });
}

export function resizeRegion(layout: Layout, index: number, bbox: BBox): Layout {
  return updateRegion(layout, index, { bbox: clampBBox(bbox) });
}
