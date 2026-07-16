// Deterministic placement for nodes added by clicking the palette. Dragged
// nodes keep the exact drop position; click-added nodes use the first open
// grid slot so the demo never opens a new node on top of existing work.

export interface PlacementNode {
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  measured?: { width?: number; height?: number };
}

const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 340;
const COLUMN_STEP = 400;
const ROW_STEP = 380;
const GAP = 24;

function dimensions(node: PlacementNode): { width: number; height: number } {
  return {
    width: node.measured?.width ?? node.width ?? DEFAULT_WIDTH,
    height: node.measured?.height ?? node.height ?? DEFAULT_HEIGHT,
  };
}

function overlaps(candidate: { x: number; y: number }, node: PlacementNode): boolean {
  const size = dimensions(node);
  return (
    candidate.x < node.position.x + size.width + GAP &&
    candidate.x + DEFAULT_WIDTH + GAP > node.position.x &&
    candidate.y < node.position.y + size.height + GAP &&
    candidate.y + DEFAULT_HEIGHT + GAP > node.position.y
  );
}

export function findOpenNodePosition(
  nodes: PlacementNode[],
  { columns = 3, maxRows = 40 }: { columns?: number; maxRows?: number } = {},
): { x: number; y: number } {
  const baseX = nodes.length > 0 ? Math.min(...nodes.map((node) => node.position.x), 40) : 40;
  const baseY = nodes.length > 0 ? Math.min(...nodes.map((node) => node.position.y), 20) : 20;

  for (let row = 0; row < maxRows; row++) {
    for (let column = 0; column < columns; column++) {
      const candidate = { x: baseX + column * COLUMN_STEP, y: baseY + row * ROW_STEP };
      if (!nodes.some((node) => overlaps(candidate, node))) return candidate;
    }
  }

  return { x: baseX, y: baseY + maxRows * ROW_STEP };
}
