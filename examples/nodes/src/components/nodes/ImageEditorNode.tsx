"use client";

import { NodeProps, NodeResizer, useReactFlow } from "@xyflow/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { NodeShell, Field, inputCls, buttonCls, dangerButtonCls } from "../nodeShell";
import { useUpstream } from "./useUpstream";
import { blobSrc } from "@/lib/blobSrc";
import {
  addRegion,
  clampBBox,
  emptyLayout,
  moveRegion,
  removeRegion,
  resizeRegion,
  updateRegion,
} from "@/lib/layoutEditing";
import type { BBox, ImageRef, Layout, Point } from "@/lib/types";

export interface ImageEditorNodeData {
  layout?: Layout;
  output?: { layout?: Layout; image?: ImageRef };
  selectedIndex?: number | null;
  /** Freeze flag, same pattern as Layout Editor: once the user has drawn or
   * edited a region, stop auto-pulling the upstream `layout` input. */
  userEditedLayout?: boolean;
}

type Corner = "nw" | "ne" | "sw" | "se";
type DragState =
  | { kind: "draw"; start: Point; current: Point }
  | { kind: "move"; index: number; startPoint: Point; startBBox: BBox; current: Point }
  | { kind: "resize"; index: number; corner: Corner; startBBox: BBox; current: Point }
  | null;

function toNormalized(clientX: number, clientY: number, rect: DOMRect): Point {
  return {
    x: Math.min(Math.max(0, (clientX - rect.left) / rect.width), 1),
    y: Math.min(Math.max(0, (clientY - rect.top) / rect.height), 1),
  };
}

function bboxFromDrawDrag(start: Point, current: Point): BBox {
  return clampBBox({
    x0: Math.min(start.x, current.x),
    y0: Math.min(start.y, current.y),
    x1: Math.max(start.x, current.x),
    y1: Math.max(start.y, current.y),
  });
}

function bboxFromResize(start: BBox, corner: Corner, current: Point): BBox {
  const box = { ...start };
  if (corner === "nw") {
    box.x0 = current.x;
    box.y0 = current.y;
  } else if (corner === "ne") {
    box.x1 = current.x;
    box.y0 = current.y;
  } else if (corner === "sw") {
    box.x0 = current.x;
    box.y1 = current.y;
  } else {
    box.x1 = current.x;
    box.y1 = current.y;
  }
  return clampBBox(box);
}

const DISPLAY_W = 320;
const DISPLAY_H = 240;

function ImageEditorNodeImpl({ id, data, selected }: NodeProps) {
  const d = data as ImageEditorNodeData;
  const { updateNodeData } = useReactFlow();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>(null);

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [workspaceSize, setWorkspaceSize] = useState<{ w: number; h: number } | null>(null);

  const imageUpstream = useUpstream(id, "image");
  const layoutUpstream = useUpstream(id, "layout");
  const image = imageUpstream?.image;
  const upstreamLayout = layoutUpstream?.layout;

  const layout: Layout = d.layout ?? emptyLayout();
  const selectedIndex = d.selectedIndex ?? null;

  // Auto-pull the incoming layout while the user hasn't started editing.
  useEffect(() => {
    if (!upstreamLayout || d.userEditedLayout) return;
    updateNodeData(id, { layout: upstreamLayout, output: { layout: upstreamLayout, image } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upstreamLayout, d.userEditedLayout]);

  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const update = () => setWorkspaceSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keep the image passthrough current in `output` even if the layout
  // hasn't changed (e.g. the upstream image was swapped).
  useEffect(() => {
    if ((d.output?.image?.id ?? null) !== (image?.id ?? null)) {
      updateNodeData(id, { output: { layout: d.output?.layout ?? layout, image } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image?.id]);

  const commitLayout = useCallback(
    (next: Layout) => {
      updateNodeData(id, { layout: next, output: { layout: next, image }, userEditedLayout: true });
    },
    [id, image, updateNodeData],
  );

  function pointFromEvent(clientX: number, clientY: number): Point | null {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return toNormalized(clientX, clientY, rect);
  }

  function onContainerMouseDown(e: ReactMouseEvent) {
    if (!image) return;
    const point = pointFromEvent(e.clientX, e.clientY);
    if (!point) return;
    for (let i = layout.regions.length - 1; i >= 0; i--) {
      const b = layout.regions[i]?.bbox;
      if (b && point.x >= b.x0 && point.x <= b.x1 && point.y >= b.y0 && point.y <= b.y1) {
        updateNodeData(id, { selectedIndex: i });
        setDrag({ kind: "move", index: i, startPoint: point, startBBox: b, current: point });
        return;
      }
    }
    updateNodeData(id, { selectedIndex: null });
    setDrag({ kind: "draw", start: point, current: point });
  }

  function onHandleMouseDown(e: ReactMouseEvent, index: number, corner: Corner) {
    e.stopPropagation();
    const point = pointFromEvent(e.clientX, e.clientY);
    const bbox = layout.regions[index]?.bbox;
    if (!point || !bbox) return;
    setDrag({ kind: "resize", index, corner, startBBox: bbox, current: point });
  }

  // Window-level listeners while dragging, so the drag survives the pointer
  // leaving the (small) node body.
  useEffect(() => {
    if (!drag) return;
    function onMove(e: globalThis.MouseEvent) {
      const point = pointFromEvent(e.clientX, e.clientY);
      if (!point) return;
      setDrag((prev) => (prev ? ({ ...prev, current: point } as DragState) : prev));
    }
    function onUp() {
      setDrag((prev) => {
        if (!prev) return null;
        if (prev.kind === "draw") {
          const bbox = bboxFromDrawDrag(prev.start, prev.current);
          if (bbox.x1 - bbox.x0 > 0.01 && bbox.y1 - bbox.y0 > 0.01) {
            const next = addRegion(layout, bbox);
            commitLayout(next);
            updateNodeData(id, { selectedIndex: next.regions.length - 1 });
          }
        } else if (prev.kind === "move") {
          const dx = prev.current.x - prev.startPoint.x;
          const dy = prev.current.y - prev.startPoint.y;
          commitLayout(moveRegion(layout, prev.index, dx, dy));
        } else if (prev.kind === "resize") {
          commitLayout(resizeRegion(layout, prev.index, bboxFromResize(prev.startBBox, prev.corner, prev.current)));
        }
        return null;
      });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

  function liveBBoxFor(index: number): BBox {
    const region = layout.regions[index];
    if (!region) return { x0: 0, y0: 0, x1: 0, y1: 0 };
    if (drag?.kind === "move" && drag.index === index) {
      const dx = drag.current.x - drag.startPoint.x;
      const dy = drag.current.y - drag.startPoint.y;
      const width = region.bbox.x1 - region.bbox.x0;
      const height = region.bbox.y1 - region.bbox.y0;
      const x0 = Math.min(Math.max(0, region.bbox.x0 + dx), 1 - width);
      const y0 = Math.min(Math.max(0, region.bbox.y0 + dy), 1 - height);
      return { x0, y0, x1: x0 + width, y1: y0 + height };
    }
    if (drag?.kind === "resize" && drag.index === index) {
      return bboxFromResize(drag.startBBox, drag.corner, drag.current);
    }
    return region.bbox;
  }

  const selectedRegion = selectedIndex != null ? layout.regions[selectedIndex] : undefined;

  const workspaceBox = workspaceSize ?? { w: DISPLAY_W, h: DISPLAY_H };
  let renderBox = workspaceBox;
  if (imgSize) {
    const scale = Math.min(workspaceBox.w / imgSize.w, workspaceBox.h / imgSize.h);
    renderBox = {
      w: Math.max(1, imgSize.w * scale),
      h: Math.max(1, imgSize.h * scale),
    };
  }
  const thumbnailWidth = workspaceBox.w > 900 ? 1600 : workspaceBox.w > 420 ? 1024 : 480;

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={344}
        minHeight={480}
        color="#f0abfc"
      />
      <NodeShell
      title="Image Editor"
      accent="#f0abfc"
      selected={selected}
      inputs={[
        { id: "image", label: "image", kind: "image" },
        { id: "layout", label: "layout", kind: "layout" },
      ]}
      outputs={[
        { id: "layout", label: "layout", kind: "layout" },
        { id: "image", label: "image", kind: "image" },
      ]}
    >
      <div
        ref={workspaceRef}
        className="relative nodrag select-none overflow-hidden rounded bg-black flex-1 w-full min-w-[320px] min-h-[240px] flex items-center justify-center"
        data-itr8-id="image-editor-canvas"
      >
        {image ? (
          <div
            ref={containerRef}
            className="relative"
            style={{ width: renderBox.w, height: renderBox.h }}
            onMouseDown={onContainerMouseDown}
          >
            <img
              src={blobSrc(image, thumbnailWidth)}
              alt=""
              className="absolute inset-0 w-full h-full pointer-events-none"
              draggable={false}
              onLoad={(e) => setImgSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            />
            <svg
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {layout.regions.map((r, i) => {
                const b = liveBBoxFor(i);
                const isSelected = i === selectedIndex;
                return (
                  <rect
                    key={`${r.label}-${i}`}
                    x={b.x0}
                    y={b.y0}
                    width={Math.max(0, b.x1 - b.x0)}
                    height={Math.max(0, b.y1 - b.y0)}
                    fill={isSelected ? "rgba(96,165,250,0.15)" : "transparent"}
                    stroke={isSelected ? "#60a5fa" : "#22c55e"}
                    strokeWidth={isSelected ? 2 : 1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
              {drag?.kind === "draw" &&
                (() => {
                  const b = bboxFromDrawDrag(drag.start, drag.current);
                  return (
                    <rect
                      x={b.x0}
                      y={b.y0}
                      width={Math.max(0, b.x1 - b.x0)}
                      height={Math.max(0, b.y1 - b.y0)}
                      fill="rgba(96,165,250,0.15)"
                      stroke="#60a5fa"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })()}
            </svg>
            {layout.regions.map((r, i) => {
              const b = liveBBoxFor(i);
              return (
                <div
                  key={`label-${i}`}
                  className="absolute text-[9px] leading-none bg-black/70 text-white px-1 rounded pointer-events-none whitespace-nowrap"
                  style={{ left: `${b.x0 * 100}%`, top: `${Math.max(0, b.y0 * 100 - 3)}%`, transform: "translateY(-100%)" }}
                >
                  {r.label || "(untitled)"}
                </div>
              );
            })}
            {selectedRegion &&
              selectedIndex != null &&
              (() => {
                const b = liveBBoxFor(selectedIndex);
                const corners: Array<{ corner: Corner; x: number; y: number }> = [
                  { corner: "nw", x: b.x0, y: b.y0 },
                  { corner: "ne", x: b.x1, y: b.y0 },
                  { corner: "sw", x: b.x0, y: b.y1 },
                  { corner: "se", x: b.x1, y: b.y1 },
                ];
                return corners.map(({ corner, x, y }) => (
                  <div
                    key={corner}
                    className="absolute w-2.5 h-2.5 bg-blue-400 border border-black/50 rounded-sm cursor-pointer"
                    style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: "translate(-50%,-50%)" }}
                    onMouseDown={(e) => onHandleMouseDown(e, selectedIndex, corner)}
                  />
                ));
              })()}
          </div>
        ) : (
          <div
            ref={containerRef}
            className="absolute inset-0 flex items-center justify-center text-white/40 text-center px-4"
            onMouseDown={onContainerMouseDown}
          >
            Connect an image upstream
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          className={buttonCls + " flex-1"}
          onClick={() => {
            const next = addRegion(layout, { x0: 0.25, y0: 0.25, x1: 0.75, y1: 0.75 });
            commitLayout(next);
            updateNodeData(id, { selectedIndex: next.regions.length - 1 });
          }}
        >
          + Add region
        </button>
        <button
          className={buttonCls + " flex-1"}
          disabled={!upstreamLayout}
          onClick={() =>
            updateNodeData(id, {
              layout: upstreamLayout,
              output: { layout: upstreamLayout, image },
              userEditedLayout: false,
              selectedIndex: null,
            })
          }
        >
          Pull from upstream
        </button>
      </div>

      {selectedRegion && selectedIndex != null && (
        <div className="space-y-2 border-t border-white/10 pt-2">
          <Field label="Label">
            <input
              className={inputCls}
              value={selectedRegion.label}
              onChange={(e) => commitLayout(updateRegion(layout, selectedIndex, { label: e.target.value }))}
            />
          </Field>
          <Field label="Prompt">
            <input
              className={inputCls}
              value={selectedRegion.prompt}
              onChange={(e) => commitLayout(updateRegion(layout, selectedIndex, { prompt: e.target.value }))}
            />
          </Field>
          <button
            className={dangerButtonCls + " w-full"}
            onClick={() => {
              commitLayout(removeRegion(layout, selectedIndex));
              updateNodeData(id, { selectedIndex: null });
            }}
          >
            Delete region
          </button>
        </div>
      )}

      <p className="text-white/40">
        {layout.regions.length} region{layout.regions.length === 1 ? "" : "s"} · drag on the image to draw,
        drag a corner to resize
      </p>
      {d.userEditedLayout && (
        <p className="text-white/30 italic">
          Editing locally — click &quot;Pull from upstream&quot; to resync.
        </p>
      )}
      </NodeShell>
    </>
  );
}

export default memo(ImageEditorNodeImpl);
