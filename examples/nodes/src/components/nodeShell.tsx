"use client";

import { Handle, Position } from "@xyflow/react";
import type { ReactNode } from "react";
import type { HandleKind } from "@/lib/connectionRules";

export interface PortSpec {
  /** Handle id — e.g. "image" | "layout" | "references". Must match the ids
   * used in Canvas's `isValidConnection` and in each node's upstream reader
   * (`useUpstream`/`useReferenceInputs`). This is the *wire identity*, not
   * the value type — that's `kind`. */
  id: string;
  label: string;
  /** The value type this port carries: "image" | "layout" for a plain typed
   * port, or "any" for a `references` port that accepts either. */
  kind: HandleKind | "any";
}

const PORT_COLOR: Record<PortSpec["kind"], string> = {
  image: "#60a5fa",
  layout: "#fbbf24",
  any: "#c084fc",
};

function PortRow({
  type,
  side,
  id,
  label,
  kind,
}: {
  type: "source" | "target";
  side: "left" | "right";
} & PortSpec) {
  const color = PORT_COLOR[kind];
  return (
    <div className="relative h-6 px-3 flex items-center text-[10px] font-medium uppercase tracking-wide text-white/50">
      <Handle
        type={type}
        position={side === "left" ? Position.Left : Position.Right}
        id={id}
        style={{
          background: color,
          width: 9,
          height: 9,
          border: "1px solid rgba(0,0,0,0.45)",
        }}
      />
      <span className={side === "left" ? "ml-2" : "ml-auto mr-2"}>{label}</span>
    </div>
  );
}

export function NodeShell({
  title,
  accent,
  selected,
  inputs,
  outputs,
  children,
}: {
  title: string;
  accent: string;
  selected?: boolean;
  inputs?: PortSpec[];
  outputs?: PortSpec[];
  children: ReactNode;
}) {
  return (
    <div
      className="relative rounded-lg bg-[#15151c] min-w-[280px] h-full flex flex-col transition-[box-shadow]"
      style={{
        boxShadow: selected
          ? `0 0 0 2px ${accent}, 0 8px 24px rgba(0,0,0,0.5)`
          : "0 0 0 1px rgba(255,255,255,0.1), 0 8px 24px rgba(0,0,0,0.35)",
      }}
      data-itr8-id={`node-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div
        className="px-3 py-2 text-xs font-semibold uppercase tracking-wide rounded-t-lg"
        style={{ background: accent, color: "#0b0b0f" }}
      >
        {title}
      </div>
      {((inputs?.length ?? 0) > 0 || (outputs?.length ?? 0) > 0) && (
        <div className="border-b border-white/10">
          {inputs?.map((p) => <PortRow key={`in-${p.id}`} type="target" side="left" {...p} />)}
          {outputs?.map((p) => <PortRow key={`out-${p.id}`} type="source" side="right" {...p} />)}
        </div>
      )}
      <div className="nowheel p-3 space-y-2 text-xs flex-1 flex flex-col min-h-0 overflow-x-hidden overflow-y-auto">{children}</div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-white/60 mb-1">{label}</span>
      {children}
    </label>
  );
}

// `nodrag`/`nowheel` keep React Flow from grabbing pointer/wheel events out
// from under native form controls (text selection, number-input steppers,
// textarea scrolling).
export const inputCls =
  "nodrag w-full rounded bg-black/40 border border-white/10 px-2 py-1 text-white outline-none focus:border-white/30";
export const selectCls = inputCls + " cursor-pointer";
export const buttonCls =
  "nodrag rounded bg-white/10 text-white/80 py-1 px-2 text-xs hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
export const primaryButtonCls =
  "nodrag rounded bg-emerald-500/90 text-black font-medium py-1 px-2 text-xs hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
export const dangerButtonCls =
  "nodrag rounded bg-red-500/20 text-red-300 py-1 px-2 text-xs hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
