"use client";

import type { ReveMeta } from "@/lib/types";
import { dangerButtonCls, primaryButtonCls } from "../nodeShell";

export type RunStatus = "idle" | "running" | "success" | "error";

/** Shared run controls + status/error/credits footer used by all four
 * API-calling nodes (V2 Create, Extract Layout, Create Layout, Render
 * Layout), so run/cancel/error/credit-metadata UX stays consistent. */
export function RunFooter({
  status,
  error,
  meta,
  contentViolation,
  onRun,
  onCancel,
  runDisabled,
  runLabel = "Run",
}: {
  status: RunStatus;
  error?: string;
  meta?: ReveMeta;
  contentViolation?: boolean;
  onRun: () => void;
  onCancel?: () => void;
  runDisabled?: boolean;
  runLabel?: string;
}) {
  return (
    <div className="space-y-1 pt-2 mt-auto border-t border-white/10">
      <div className="flex gap-2">
        <button
          type="button"
          className={primaryButtonCls + " flex-1"}
          onClick={onRun}
          disabled={runDisabled || status === "running"}
        >
          {status === "running" ? "Running…" : runLabel}
        </button>
        {status === "running" && onCancel && (
          <button type="button" className={dangerButtonCls} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      {contentViolation && (
        <p className="text-amber-300">
          ⚠ Reve reported a content policy violation — no image was returned.
        </p>
      )}
      {status === "error" && error && <p className="text-red-400 break-words">{error}</p>}
      {meta && (meta.creditsUsed !== undefined || meta.requestId) && (
        <p className="text-white/40 truncate" title={meta.requestId}>
          {meta.creditsUsed !== undefined ? `credits used: ${meta.creditsUsed}` : ""}
          {meta.creditsRemaining !== undefined ? ` · ${meta.creditsRemaining} remaining` : ""}
          {meta.version ? ` · ${meta.version}` : ""}
        </p>
      )}
    </div>
  );
}
