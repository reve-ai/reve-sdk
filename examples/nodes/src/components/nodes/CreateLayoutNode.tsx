"use client";

import { NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useRef } from "react";
import { Field, NodeShell, inputCls, selectCls } from "../nodeShell";
import { RunFooter, type RunStatus } from "./RunFooter";
import { useRunSignal } from "./useRunSignal";
import { useReferenceInputs } from "./useUpstream";
import { describeApiError, isAbortError, runCreateLayout } from "@/lib/apiClient";
import { ASPECT_RATIOS, MAX_PROMPT_LENGTH, MAX_REFERENCES } from "@/lib/types";
import type { AspectRatio, CompoundReferenceDTO, Layout, LayoutCommand, ReveMeta } from "@/lib/types";

export interface CreateLayoutNodeData {
  prompt?: string;
  /** Raw JSON text for the optional `commands` array — kept as a textarea
   * per the simplification agreed for this demo, rather than a full visual
   * command builder. */
  commandsDraft?: string;
  commandsError?: string;
  aspectRatio?: AspectRatio;
  version?: string;
  status?: RunStatus;
  error?: string;
  meta?: ReveMeta;
  contentViolation?: boolean;
  output?: { layout?: Layout; meta?: ReveMeta };
  runRequestedAt?: number;
  lastRunHandledAt?: number;
}

function parseCommandsDraft(draft: string): { commands?: LayoutCommand[]; error?: string } {
  const trimmed = draft.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return { error: "Commands must be a JSON array of {op: ...} objects." };
    return { commands: parsed as LayoutCommand[] };
  } catch (err) {
    return { error: err instanceof Error ? `Invalid commands JSON: ${err.message}` : "Invalid commands JSON." };
  }
}

function CreateLayoutNodeImpl({ id, data, selected }: NodeProps) {
  const d = data as CreateLayoutNodeData;
  const { updateNodeData } = useReactFlow();
  // create_layout takes COMPOUND references (image and/or layout), so this
  // handle accepts either source kind ("any").
  const referenceGroups = useReferenceInputs(id, "references");
  const abortRef = useRef<AbortController | null>(null);

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
    const prompt = (d.prompt ?? "").trim();
    const { commands, error: commandsError } = parseCommandsDraft(d.commandsDraft ?? "");
    if (commandsError) {
      updateNodeData(id, { commandsError });
      return;
    }
    if (!prompt && references.length === 0) {
      updateNodeData(id, { status: "error", error: "Provide a prompt, at least one reference, or both." });
      return;
    }
    if (commands && commands.length > 0 && references.length === 0) {
      updateNodeData(id, { status: "error", error: "Commands require at least one reference." });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    updateNodeData(id, { status: "running", error: undefined, commandsError: undefined });
    try {
      const res = await runCreateLayout(
        {
          prompt: prompt || undefined,
          references: references.length ? references : undefined,
          commands,
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
      title="Create Layout"
      accent="#facc15"
      selected={selected}
      inputs={[
        { id: "references", label: `references (${references.length}/${MAX_REFERENCES})`, kind: "any" },
      ]}
      outputs={[{ id: "layout", label: "layout", kind: "layout" }]}
    >
      <Field label={`Prompt (max ${MAX_PROMPT_LENGTH} chars — prompt or references required)`}>
        <textarea
          className={inputCls + " nowheel"}
          rows={3}
          maxLength={MAX_PROMPT_LENGTH}
          value={d.prompt ?? ""}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          placeholder="A person at a cafe, a woman in a red coat on the left"
        />
      </Field>
      <Field label="Commands (JSON array, optional — requires ≥1 reference)">
        <textarea
          className={inputCls + " nowheel font-mono text-[11px]"}
          rows={4}
          spellCheck={false}
          value={d.commandsDraft ?? ""}
          onChange={(e) => updateNodeData(id, { commandsDraft: e.target.value, commandsError: undefined })}
          placeholder='[{"op":"shift","label":"person","to":{"x":0.7,"y":0.5}}]'
        />
      </Field>
      {d.commandsError && <p className="text-red-400 break-words">{d.commandsError}</p>}
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
        runDisabled={!(d.prompt ?? "").trim() && references.length === 0}
      />
    </NodeShell>
  );
}

export default memo(CreateLayoutNodeImpl);
