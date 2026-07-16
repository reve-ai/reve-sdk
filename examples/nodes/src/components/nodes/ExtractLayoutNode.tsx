"use client";

import { NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useRef } from "react";
import { Field, NodeShell, inputCls } from "../nodeShell";
import { RunFooter, type RunStatus } from "./RunFooter";
import { useRunSignal } from "./useRunSignal";
import { useUpstream } from "./useUpstream";
import { describeApiError, isAbortError, runExtractLayout } from "@/lib/apiClient";
import { MAX_PROMPT_LENGTH } from "@/lib/types";
import type { Layout, ReveMeta } from "@/lib/types";

export interface ExtractLayoutNodeData {
  prompt?: string;
  version?: string;
  status?: RunStatus;
  error?: string;
  meta?: ReveMeta;
  contentViolation?: boolean;
  output?: { layout?: Layout; meta?: ReveMeta };
  runRequestedAt?: number;
  lastRunHandledAt?: number;
}

function ExtractLayoutNodeImpl({ id, data, selected }: NodeProps) {
  const d = data as ExtractLayoutNodeData;
  const { updateNodeData } = useReactFlow();
  const upstream = useUpstream(id, "image");
  const abortRef = useRef<AbortController | null>(null);
  const imageId = upstream?.image?.id;

  async function run() {
    if (!imageId) {
      updateNodeData(id, { status: "error", error: "Connect exactly one image input first." });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    updateNodeData(id, { status: "running", error: undefined });
    try {
      const res = await runExtractLayout(
        { image: { blobId: imageId }, prompt: d.prompt || undefined, version: d.version || undefined },
        controller.signal,
      );
      updateNodeData(id, {
        status: "success",
        error: undefined,
        meta: res.meta,
        contentViolation: res.meta.contentViolation,
        output: { layout: res.layout, meta: res.meta },
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
      title="Extract Layout"
      accent="#fb923c"
      selected={selected}
      inputs={[{ id: "image", label: "image", kind: "image" }]}
      outputs={[{ id: "layout", label: "layout", kind: "layout" }]}
    >
      <p className="text-white/50">{imageId ? "Image connected." : "Connect exactly one image input."}</p>
      <Field label="Prompt (optional transform instruction)">
        <input
          className={inputCls}
          maxLength={MAX_PROMPT_LENGTH}
          value={d.prompt ?? ""}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          placeholder="e.g. focus on the foreground subject"
        />
      </Field>
      <Field label="Version">
        <input
          className={inputCls}
          value={d.version ?? ""}
          onChange={(e) => updateNodeData(id, { version: e.target.value })}
          placeholder="latest"
        />
      </Field>
      <RunFooter
        status={d.status ?? "idle"}
        error={d.error}
        meta={d.meta}
        contentViolation={d.contentViolation}
        onRun={run}
        onCancel={() => abortRef.current?.abort()}
        runDisabled={!imageId}
      />
    </NodeShell>
  );
}

export default memo(ExtractLayoutNodeImpl);
