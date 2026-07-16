"use client";

import { buttonCls, dangerButtonCls, primaryButtonCls } from "./nodeShell";

export function Toolbar({
  onRunAll,
  runningAll,
  runAllError,
  onReset,
  onDuplicateHint,
}: {
  onRunAll: () => void;
  runningAll: boolean;
  runAllError: string | null;
  onReset: () => void;
  onDuplicateHint?: string;
}) {
  return (
    <div
      className="absolute top-3 left-3 z-10 flex max-w-[70vw] flex-wrap items-center gap-2 rounded-lg bg-[#15151c]/95 border border-white/10 px-3 py-2 shadow-lg backdrop-blur"
      data-itr8-id="toolbar"
    >
      <span className="font-semibold text-sm pr-1">Reve Nodes</span>
      <button
        type="button"
        className={primaryButtonCls}
        onClick={onRunAll}
        disabled={runningAll}
        data-itr8-id="toolbar-run-all"
      >
        {runningAll ? "Running all…" : "▶ Run all"}
      </button>
      <button type="button" className={dangerButtonCls} onClick={onReset} data-itr8-id="toolbar-reset">
        Reset workflow
      </button>
      <span className="text-white/30 text-xs hidden sm:inline">
        Delete: Backspace · Duplicate: {onDuplicateHint ?? "⌘/Ctrl+D"}
      </span>
      {runAllError && <span className="text-red-400 text-xs">{runAllError}</span>}
    </div>
  );
}

export { buttonCls };
