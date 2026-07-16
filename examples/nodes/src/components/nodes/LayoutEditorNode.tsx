"use client";

import { NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useEffect, useRef, useState } from "react";
import { NodeShell, inputCls, buttonCls } from "../nodeShell";
import { useUpstream } from "./useUpstream";
import { stringifyLayout, parseLayoutJson } from "@/lib/layoutEditing";
import { importLayoutFile } from "@/lib/fileImports";
import { saveJsonAtTopLevel } from "@/lib/fileSave";
import type { Layout } from "@/lib/types";

export interface LayoutEditorNodeData {
  draft?: string;
  output?: { layout?: Layout };
  error?: string;
  /** True once the user has typed into the textarea. While false, the node
   * mirrors the connected upstream layout automatically. The "Pull from
   * upstream" button resets it to false. */
  userEdited?: boolean;
}

function LayoutEditorNodeImpl({ id, data, selected }: NodeProps) {
  const d = data as LayoutEditorNodeData;
  const { updateNodeData } = useReactFlow();
  const upstream = useUpstream(id, "layout");
  const upstreamLayout = upstream?.layout;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [downloadError, setDownloadError] = useState<string>();

  useEffect(() => {
    setEmbedded(window.self !== window.top);
  }, []);

  // Auto-pull from upstream whenever it changes, as long as the user hasn't
  // typed into the textarea. Lets edits propagate through a chain of Layout
  // Editors without any manual clicks.
  useEffect(() => {
    if (!upstreamLayout) return;
    if (d.userEdited) return;
    const text = stringifyLayout(upstreamLayout);
    if (d.draft === text) return;
    updateNodeData(id, { draft: text, output: { layout: upstreamLayout }, error: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upstreamLayout, d.userEdited]);

  // Debounced parse/validate of the draft into `output`. Invalid JSON
  // surfaces an error but leaves the last good `output` untouched so
  // downstream nodes don't see a half-typed value.
  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (d.draft === undefined) return;
    if (parseTimer.current) clearTimeout(parseTimer.current);
    parseTimer.current = setTimeout(() => {
      try {
        const parsed = parseLayoutJson(d.draft ?? "{}");
        updateNodeData(id, { output: { layout: parsed }, error: undefined });
      } catch (error) {
        updateNodeData(id, {
          error: error instanceof Error ? error.message : "Invalid layout JSON.",
        });
      }
    }, 250);
    return () => {
      if (parseTimer.current) clearTimeout(parseTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.draft]);

  const pullFromUpstream = () => {
    if (!upstreamLayout) return;
    setDownloadError(undefined);
    updateNodeData(id, {
      draft: stringifyLayout(upstreamLayout),
      output: { layout: upstreamLayout },
      error: undefined,
      userEdited: false,
    });
  };

  async function handleLayoutFiles(files: FileList | File[]) {
    const file = files[0];
    if (!file) return;
    const result = await importLayoutFile(file);
    setDownloadError(undefined);
    if (result.ok) {
      updateNodeData(id, {
        draft: result.draft,
        output: { layout: result.layout },
        error: undefined,
        userEdited: true,
      });
      return;
    }
    updateNodeData(id, {
      ...(result.draft === undefined ? {} : { draft: result.draft }),
      error: result.error,
      userEdited: true,
    });
  }

  const output = d.output?.layout;
  const canDownload = Boolean(output) && !d.error;

  async function downloadLayout() {
    if (!output || d.error) return;
    setDownloadError(undefined);
    const text = stringifyLayout(output);
    const filename = `reve-layout-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}.json`;

    try {
      if (embedded) {
        const key = crypto.randomUUID();
        // Open synchronously from the click so popup blockers see genuine user
        // activation. The page polls briefly while this window publishes the
        // payload over HTTP; unlike localStorage, this crosses Chrome's
        // third-party iframe storage partition safely.
        const popup = window.open(`/download/layout/${encodeURIComponent(key)}`, "_blank");
        if (!popup) {
          throw new Error("The layout download popup was blocked. Allow popups and try again.");
        }
        popup.opener = null;
        const response = await fetch("/api/layout-downloads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, text, filename }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "The layout download could not be prepared.");
        }
        return;
      }
      await saveJsonAtTopLevel(text, filename);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setDownloadError(error instanceof Error ? error.message : "The layout could not be saved.");
    }
  }

  return (
    <NodeShell
      title="Layout Editor"
      accent="#fcd34d"
      selected={selected}
      inputs={[{ id: "layout", label: "layout", kind: "layout" }]}
      outputs={[{ id: "layout", label: "layout", kind: "layout" }]}
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={pullFromUpstream}
          disabled={!upstreamLayout}
          className={buttonCls + " flex-1"}
        >
          Pull upstream
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={buttonCls + " flex-1"}
          data-itr8-id="layout-node-upload"
        >
          Upload JSON
        </button>
        <button
          type="button"
          onClick={() => void downloadLayout()}
          disabled={!canDownload}
          className={buttonCls + " flex-1"}
          data-itr8-id="layout-node-download"
        >
          Download
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Upload layout JSON"
          onChange={(event) => {
            if (event.target.files) void handleLayoutFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      <div
        className={`relative rounded ${dragOver ? "ring-2 ring-amber-300/80" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) {
            setDragOver(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragOver(false);
          void handleLayoutFiles(event.dataTransfer.files);
        }}
        data-itr8-id="layout-node-dropzone"
      >
        <textarea
          className={`${inputCls} nowheel font-mono text-[11px] leading-snug`}
          rows={16}
          spellCheck={false}
          value={d.draft ?? ""}
          onChange={(event) =>
            updateNodeData(id, { draft: event.target.value, userEdited: true })
          }
          placeholder={
            upstreamLayout
              ? ""
              : 'Drop or upload layout JSON, or write it here, e.g. {"regions": []}'
          }
          style={{ minWidth: 360, resize: "both" }}
          aria-label="Layout JSON"
        />
        {dragOver && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-amber-300/15 text-xs font-medium text-amber-100">
            Drop layout JSON to replace
          </span>
        )}
      </div>
      {d.error && <p className="text-red-400 break-words">{d.error}</p>}
      {downloadError && <p className="text-red-400 break-words">{downloadError}</p>}
      {output && !d.error && (
        <p className="text-white/50">
          regions: {output.regions?.length ?? 0}
          {output.width && output.height ? ` · ${output.width}×${output.height}` : ""}
        </p>
      )}
      {d.userEdited && (
        <p className="text-white/30 italic">
          Editing locally — click &quot;Pull upstream&quot; to resync.
        </p>
      )}
    </NodeShell>
  );
}

export default memo(LayoutEditorNodeImpl);
