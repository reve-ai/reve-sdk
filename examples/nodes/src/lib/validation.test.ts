import { describe, expect, it } from "vitest";
import {
  compoundReferenceDTOSchema,
  createLayoutRequestSchema,
  createRequestSchema,
  extractLayoutRequestSchema,
  renderLayoutRequestSchema,
} from "./validation";
import { MAX_PROMPT_LENGTH, MAX_REFERENCES } from "./types";

const uuid = "11111111-1111-1111-1111-111111111111";

describe("createRequestSchema (v2/image/create request shaping)", () => {
  it("accepts a minimal valid request", () => {
    expect(() => createRequestSchema.parse({ prompt: "a cat" })).not.toThrow();
  });

  it("rejects a missing prompt", () => {
    expect(() => createRequestSchema.parse({})).toThrow();
  });

  it("rejects a prompt over the 4000-char limit", () => {
    const prompt = "a".repeat(MAX_PROMPT_LENGTH + 1);
    expect(() => createRequestSchema.parse({ prompt })).toThrow();
  });

  it("rejects more than 8 references", () => {
    const references = Array.from({ length: MAX_REFERENCES + 1 }, () => ({ blobId: uuid }));
    expect(() => createRequestSchema.parse({ prompt: "x", references })).toThrow();
  });

  it("accepts exactly 8 references", () => {
    const references = Array.from({ length: MAX_REFERENCES }, () => ({ blobId: uuid }));
    expect(() => createRequestSchema.parse({ prompt: "x", references })).not.toThrow();
  });

  it("rejects a non-UUID blobId", () => {
    expect(() => createRequestSchema.parse({ prompt: "x", references: [{ blobId: "not-a-uuid" }] })).toThrow();
  });
});

describe("extractLayoutRequestSchema", () => {
  it("requires an image", () => {
    expect(() => extractLayoutRequestSchema.parse({})).toThrow();
  });

  it("accepts image with optional prompt/version", () => {
    expect(() =>
      extractLayoutRequestSchema.parse({ image: { blobId: uuid }, prompt: "focus on the subject" }),
    ).not.toThrow();
  });
});

describe("compoundReferenceDTOSchema", () => {
  it("rejects an entirely empty reference", () => {
    expect(() => compoundReferenceDTOSchema.parse({})).toThrow();
  });

  it("accepts a prompt-only reference", () => {
    expect(() => compoundReferenceDTOSchema.parse({ prompt: "a red hat" })).not.toThrow();
  });

  it("accepts an image+layout compound reference", () => {
    expect(() =>
      compoundReferenceDTOSchema.parse({
        image: { blobId: uuid },
        layout: { regions: [] },
      }),
    ).not.toThrow();
  });
});

describe("createLayoutRequestSchema", () => {
  it("rejects when neither prompt nor references are provided", () => {
    expect(() => createLayoutRequestSchema.parse({})).toThrow();
  });

  it("accepts prompt-only", () => {
    expect(() => createLayoutRequestSchema.parse({ prompt: "a cafe scene" })).not.toThrow();
  });

  it("rejects commands without at least one reference", () => {
    expect(() =>
      createLayoutRequestSchema.parse({ prompt: "x", commands: [{ op: "add", label: "cat" }] }),
    ).toThrow();
  });

  it("accepts commands when a reference is present", () => {
    expect(() =>
      createLayoutRequestSchema.parse({
        references: [{ prompt: "a cafe" }],
        commands: [{ op: "add", label: "cat" }],
      }),
    ).not.toThrow();
  });
});

describe("renderLayoutRequestSchema", () => {
  it("requires a layout with a regions array", () => {
    expect(() => renderLayoutRequestSchema.parse({})).toThrow();
    expect(() => renderLayoutRequestSchema.parse({ layout: { regions: [] } })).not.toThrow();
  });

  it("rejects a region missing bbox", () => {
    expect(() =>
      renderLayoutRequestSchema.parse({
        layout: { regions: [{ label: "x", prompt: "y" }] },
      }),
    ).toThrow();
  });
});
