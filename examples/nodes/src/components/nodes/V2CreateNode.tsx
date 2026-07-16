"use client";

import { NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useRef } from "react";
import { Field, NodeShell, inputCls, selectCls } from "../nodeShell";
import { RunFooter, type RunStatus } from "./RunFooter";
import { useRunSignal } from "./useRunSignal";
import { useReferenceInputs } from "./useUpstream";
import { describeApiError, isAbortError, runV2Create } from "@/lib/apiClient";
import { ASPECT_RATIOS, MAX_PROMPT_LENGTH, MAX_REFERENCES } from "@/lib/types";
import type { AspectRatio, ImageRef, Layout, ReveMeta } from "@/lib/types";

export interface V2CreateNodeData {
  prompt?: string;
  aspectRatio?: AspectRatio;
  version?: string;
  status?: RunStatus;
  error?: string;
  meta?: ReveMeta;
  contentViolation?: boolean;
  output?: { image?: ImageRef; layout?: Layout; meta?: ReveMeta };
  runRequestedAt?: number;
  lastRunHandledAt?: number;
}

function V2CreateNodeImpl({ id, data, selected }: NodeProps) {
  const d = data as V2CreateNodeData;
  const { updateNodeData } = useReactFlow();
  // v2/image/create takes RAW image references (not compound) — restrict
  // this handle's `kind` to "image" so a layout-only upstream can't be
  // wired in (enforced by Canvas's isValidConnection, not just here).
  const references = useReferenceInputs(id, "references");
  const abortRef = useRef<AbortController | null>(null);

  const referenceBlobIds = references
    .map((r) => r.output?.image?.id)
    .filter((v): v is string => Boolean(v))
    .slice(0, MAX_REFERENCES);

  async function run() {
    const prompt = (d.prompt ?? "").trim();
    if (!prompt) {
      updateNodeData(id, { status: "error", error: "Prompt is required." });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    updateNodeData(id, { status: "running", error: undefined });
    try {
      const res = await runV2Create(
        {
          prompt,
          references: referenceBlobIds.length
            ? referenceBlobIds.map((blobId) => ({ blobId }))
            : undefined,
          aspectRatio: d.aspectRatio,
          version: d.version || undefined,
        },
        controller.signal,
      );
      updateNodeData(id, {
        status: "success",
        error: undefined,
        meta: res.meta,
        contentViolation: res.meta.contentViolation,
        output: { image: res.image, layout: res.layout, meta: res.meta },
      });
    } catch (err) {
      if (isAbortError(err)) {
        updateNodeData(id, { status: "idle", error: undefined });
        return;
      }
      updateNodeData(id, { status: "error", error: describeApiError(err) });
    } finally {
      abortRef.current = null;
    }
  }

  useRunSignal(id, data as { runRequestedAt?: number; lastRunHandledAt?: number }, run);

  return (
    <NodeShell
      title="V2 Create"
      accent="#34d399"
      selected={selected}
      inputs={[
        {
          id: "references",
          label: `references (${referenceBlobIds.length}/${MAX_REFERENCES}, image)`,
          kind: "image",
        },
      ]}
      outputs={[
        { id: "image", label: "image", kind: "image" },
        { id: "layout", label: "layout", kind: "layout" },
      ]}
    >
      <Field label={`Prompt (max ${MAX_PROMPT_LENGTH} chars — use <frame>N</frame> to cite reference N)`}>
        <textarea
          className={inputCls + " nowheel"}
          rows={4}
          maxLength={MAX_PROMPT_LENGTH}
          value={d.prompt ?? ""}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          placeholder="A towering stack of golden pancakes drizzled with honey syrup…"
        />
      </Field>
      <div className="flex gap-2">
        <Field label="Aspect ratio">
          <select
            className={selectCls}
            value={d.aspectRatio ?? "auto"}
            onChange={(e) => updateNodeData(id, { aspectRatio: e.target.value as AspectRatio })}
          >
            {ASPECT_RATIOS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Version">
          <input
            className={inputCls}
            value={d.version ?? ""}
            onChange={(e) => updateNodeData(id, { version: e.target.value })}
            placeholder="latest"
          />
        </Field>
      </div>
      <RunFooter
        status={d.status ?? "idle"}
        error={d.error}
        meta={d.meta}
        contentViolation={d.contentViolation}
        onRun={run}
        onCancel={() => abortRef.current?.abort()}
        runDisabled={!(d.prompt ?? "").trim()}
      />
    </NodeShell>
  );
}

export default memo(V2CreateNodeImpl);
