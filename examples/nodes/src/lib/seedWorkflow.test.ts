import { describe, expect, it } from "vitest";
import { seedWorkflow } from "./seedWorkflow";

describe("seedWorkflow", () => {
  it("matches the complete seven-node, eight-edge starter graph", () => {
    const { nodes, edges } = seedWorkflow();

    expect(nodes.map((node) => [node.id, node.type])).toEqual([
      ["seed-create", "v2Create"],
      ["seed-image-1", "image"],
      ["seed-layout-editor-1", "layoutEditor"],
      ["seed-create-layout", "createLayout"],
      ["seed-layout-editor-2", "layoutEditor"],
      ["seed-render", "renderLayout"],
      ["seed-image-2", "image"],
    ]);
    expect(edges.map((edge) => [
      edge.source,
      edge.sourceHandle,
      edge.target,
      edge.targetHandle,
    ])).toEqual([
      ["seed-create", "image", "seed-image-1", "image"],
      ["seed-create", "layout", "seed-layout-editor-1", "layout"],
      ["seed-layout-editor-1", "layout", "seed-create-layout", "references"],
      ["seed-create-layout", "layout", "seed-layout-editor-2", "layout"],
      ["seed-layout-editor-2", "layout", "seed-render", "layout"],
      ["seed-image-1", "image", "seed-render", "references"],
      ["seed-layout-editor-1", "layout", "seed-image-1", "layout"],
      ["seed-render", "image", "seed-image-2", "image"],
    ]);
  });

  it("keeps the starter portable by excluding generated and machine-local state", () => {
    const { nodes } = seedWorkflow();
    const serialized = JSON.stringify(nodes);

    expect(serialized).not.toContain('"output"');
    expect(serialized).not.toContain('"meta"');
    expect(serialized).not.toContain('"creditsRemaining"');
    expect(serialized).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27}/i);
    expect(nodes.find((node) => node.id === "seed-create")?.data.prompt).toContain(
      "photorealistic",
    );
    expect(nodes.find((node) => node.id === "seed-create-layout")?.data.prompt).toBe(
      "Change the cat into a white puppy.",
    );
  });

  it("returns fresh objects so reset mutations cannot alter future defaults", () => {
    const first = seedWorkflow();
    first.nodes[0].position.x = 999;
    first.edges.pop();

    const second = seedWorkflow();
    expect(second.nodes[0].position.x).toBe(-2);
    expect(second.edges).toHaveLength(8);
  });
});
