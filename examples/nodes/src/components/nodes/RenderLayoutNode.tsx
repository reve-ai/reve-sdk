"use client";

import { NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useRef } from "react";
import { Field, NodeShell, inputCls } from "../nodeShell";
import { RunFooter, type RunStatus } from "./RunFooter";
import { useRunSignal } from "./useRunSignal";
import { useReferenceInputs, useUpstream } from "./useUpstream";
import { describeApiError, isAbortError, runRenderLayout } from "@/lib/apiClient";
import { MAX_REFERENCES } from "@/lib/types";
import type { CompoundReferenceDTO, ImageRef, Layout, ReveMeta } from "@/lib/types";

export interface RenderLayoutNodeData {
  version?: string;
  status?: RunStatus;
  error?: string;
  meta?: ReveMeta;
  contentViolation?: boolean;
  output?: { image?: ImageRef; layout?: Layout; meta?: ReveMeta };
  runRequestedAt?: number;
  lastRunHandledAt?: number;
}

function RenderLayoutNodeImpl({ id, data, selected }: NodeProps) {
  const d = data as RenderLayoutNodeData;
  const { updateNodeData } = useReactFlow();
  const layoutUpstream = useUpstream(id, "layout");
  const referenceGroups = useReferenceInputs(id, "references");
  const abortRef = useRef<AbortController | null>(null);
  const layout = layoutUpstream?.layout;

  const references: CompoundReferenceDTO[] = referenceGroups
    .map((g) => {
      const ref: CompoundReferenceDTO = {};
      if (g.output?.image) ref.image = { blobId: g.output.image.id };
      if (g.output?.layout) ref.layout = g.output.layout;
      return ref;
    })
    .filter((r) => r.image || r.layout)
    .slice(0, MAX_REFERENCES);

  async function run() {
    if (!layout) {
      updateNodeData(id, { status: "error", error: "Connect a layout input first." });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    updateNodeData(id, { status: "running", error: undefined });
    try {
      const res = await runRenderLayout(
        { layout, references: references.length ? references : undefined, version: d.version || undefined },
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
      title="Render Layout"
      accent="#38bdf8"
      selected={selected}
      inputs={[
        { id: "layout", label: "layout (required)", kind: "layout" },
        { id: "references", label: `references (${references.length}/${MAX_REFERENCES})`, kind: "any" },
      ]}
      outputs={[
        { id: "image", label: "image", kind: "image" },
        { id: "layout", label: "layout", kind: "layout" },
      ]}
    >
      <p className="text-white/50">
        {layout ? `${layout.regions.length} region(s) ready to render` : "Connect a layout upstream."}
      </p>
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
        runDisabled={!layout}
      />
    </NodeShell>
  );
}

export default memo(RenderLayoutNodeImpl);
