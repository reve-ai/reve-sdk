"use client";

import { NODE_REGISTRY } from "@/lib/nodeRegistry";

export function Palette({ onAddNode }: { onAddNode: (type: string) => void }) {
  return (
    <div
      className="absolute top-3 right-3 z-10 w-60 rounded-lg bg-[#15151c]/95 border border-white/10 p-2 shadow-lg space-y-1 max-h-[80vh] overflow-y-auto rn-scroll"
      data-itr8-id="palette"
    >
      <p className="text-[10px] uppercase tracking-wide text-white/40 px-1 pb-1">
        Nodes — drag or click to add
      </p>
      {NODE_REGISTRY.map((def) => (
        <div
          key={def.type}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/reve-node-type", def.type);
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={() => onAddNode(def.type)}
          className="cursor-grab rounded px-2 py-1.5 text-xs bg-white/5 hover:bg-white/10 transition-colors"
          title={def.description}
          data-itr8-id={`palette-item-${def.type}`}
        >
          <div className="font-medium">{def.label}</div>
          <div className="text-white/40 text-[10px] leading-snug">{def.description}</div>
        </div>
      ))}
    </div>
  );
}
