// The illustrative seven-node workflow shown on first launch (and via
// "Reset workflow"). It mirrors the complete create → edit layout → render
// flow while remaining portable: generated outputs, request metadata, credit
// balances, and machine-local image blob ids are intentionally not seeded.
// Running the graph repopulates those values from the configured API key.

import type { Edge, Node } from "@xyflow/react";

export function seedWorkflow(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: "seed-create",
      type: "v2Create",
      position: { x: -2, y: 236 },
      data: {
        prompt:
          "A cozy reading nook by a rain-streaked window at dusk, warm lamplight, a tabby cat curled on a knit blanket, photorealistic.",
        aspectRatio: "auto",
      },
    },
    {
      id: "seed-image-1",
      type: "image",
      position: { x: 1047, y: -104 },
      width: 337,
      height: 407,
      data: {},
    },
    {
      id: "seed-layout-editor-1",
      type: "layoutEditor",
      position: { x: 555, y: 378 },
      data: {},
    },
    {
      id: "seed-create-layout",
      type: "createLayout",
      position: { x: 1022, y: 382 },
      data: {
        prompt: "Change the cat into a white puppy.",
        aspectRatio: "auto",
      },
    },
    {
      id: "seed-layout-editor-2",
      type: "layoutEditor",
      position: { x: 1449, y: 387 },
      data: {},
    },
    {
      id: "seed-render",
      type: "renderLayout",
      position: { x: 1959, y: 468 },
      data: {},
    },
    {
      id: "seed-image-2",
      type: "image",
      position: { x: 2334, y: 432 },
      data: {},
    },
  ];

  const edges: Edge[] = [
    {
      id: "seed-e1",
      source: "seed-create",
      sourceHandle: "image",
      target: "seed-image-1",
      targetHandle: "image",
    },
    {
      id: "seed-e2",
      source: "seed-create",
      sourceHandle: "layout",
      target: "seed-layout-editor-1",
      targetHandle: "layout",
    },
    {
      id: "seed-e3",
      source: "seed-layout-editor-1",
      sourceHandle: "layout",
      target: "seed-create-layout",
      targetHandle: "references",
    },
    {
      id: "seed-e4",
      source: "seed-create-layout",
      sourceHandle: "layout",
      target: "seed-layout-editor-2",
      targetHandle: "layout",
    },
    {
      id: "seed-e5",
      source: "seed-layout-editor-2",
      sourceHandle: "layout",
      target: "seed-render",
      targetHandle: "layout",
    },
    {
      id: "seed-e6",
      source: "seed-image-1",
      sourceHandle: "image",
      target: "seed-render",
      targetHandle: "references",
    },
    {
      id: "seed-e7",
      source: "seed-layout-editor-1",
      sourceHandle: "layout",
      target: "seed-image-1",
      targetHandle: "layout",
    },
    {
      id: "seed-e8",
      source: "seed-render",
      sourceHandle: "image",
      target: "seed-image-2",
      targetHandle: "image",
    },
  ];

  return { nodes, edges };
}
