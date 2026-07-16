"use client";

import { NodeProps, NodeResizer, useReactFlow } from "@xyflow/react";
import { memo, useEffect, useRef, useState } from "react";
import { NodeShell, buttonCls } from "../nodeShell";
import { useUpstream } from "./useUpstream";
import { blobDownloadPageSrc, blobDownloadSrc, blobSrc } from "@/lib/blobSrc";
import { uploadImageFile, validateFileClientSide } from "@/lib/uploadBlob";
import type { ImageRef, Layout } from "@/lib/types";

export interface ImageNodeData {
  /** Set by upload/drop/paste. Takes priority over the upstream `image`
   * passthrough handle when present. */
  uploaded?: ImageRef;
  /** Mirror of whichever image this node is currently showing — read by
   * downstream consumers via `useUpstream(id, "image")`. */
  output?: { image?: ImageRef };
  error?: string;
  uploading?: boolean;
}

/** Draws normalized [0,1] region bboxes over the image. Purely visual — an
 * overlay layout never flows into this node's own `image` output. */
function LayoutOverlay({ layout }: { layout: Layout }) {
  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none"
    >
      {layout.regions.map((r, i) => (
        <rect
          key={`${r.label}-${i}`}
          x={r.bbox.x0}
          y={r.bbox.y0}
          width={Math.max(0, r.bbox.x1 - r.bbox.x0)}
          height={Math.max(0, r.bbox.y1 - r.bbox.y0)}
          fill="none"
          stroke="#22c55e"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        >
          <title>{r.label}</title>
        </rect>
      ))}
    </svg>
  );
}

function ImageNodeImpl({ id, data, selected }: NodeProps) {
  const d = data as ImageNodeData;
  const { updateNodeData } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [previewSize, setPreviewSize] = useState<{ w: number; h: number } | null>(null);

  const upstream = useUpstream(id, "image");
  const overlay = useUpstream(id, "layout");
  const overlayLayout = overlay?.layout;

  const activeImage: ImageRef | undefined = d.uploaded ?? upstream?.image ?? undefined;
  const downloadHref = embedded ? blobDownloadPageSrc(activeImage) : blobDownloadSrc(activeImage);

  useEffect(() => {
    setEmbedded(window.self !== window.top);
  }, []);

  // Keep `output` mirroring whichever image is currently active so
  // downstream nodes see it without a manual "commit" step.
  useEffect(() => {
    if ((activeImage?.id ?? null) !== (d.output?.image?.id ?? null)) {
      updateNodeData(id, { output: { image: activeImage } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeImage?.id]);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const update = () => setPreviewSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  async function handleFiles(files: FileList | File[]) {
    const file = files[0];
    if (!file) return;
    const clientError = validateFileClientSide(file);
    if (clientError) {
      updateNodeData(id, { error: clientError });
      return;
    }
    updateNodeData(id, { uploading: true, error: undefined });
    try {
      const ref = await uploadImageFile(file);
      updateNodeData(id, { uploaded: ref, uploading: false, error: undefined });
    } catch (err) {
      updateNodeData(id, {
        uploading: false,
        error: err instanceof Error ? err.message : "Upload failed.",
      });
    }
  }

  const previewBox = previewSize ?? { w: 280, h: 160 };
  let renderBox = previewBox;
  if (imgSize) {
    const scale = Math.min(previewBox.w / imgSize.w, previewBox.h / imgSize.h);
    renderBox = {
      w: Math.max(1, imgSize.w * scale),
      h: Math.max(1, imgSize.h * scale),
    };
  }
  const previewWidth = previewSize?.w ?? 280;
  const thumbnailWidth = previewWidth > 900 ? 1600 : previewWidth > 420 ? 1024 : 480;

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={304}
        minHeight={320}
        color="#93c5fd"
      />
      <NodeShell
      title="Image"
      accent="#93c5fd"
      selected={selected}
      inputs={[
        { id: "image", label: "image (chain)", kind: "image" },
        { id: "layout", label: "overlay", kind: "layout" },
      ]}
      outputs={[{ id: "image", label: "image", kind: "image" }]}
    >
      <div
        ref={previewRef}
        className={`relative nodrag rounded border-2 border-dashed ${
          dragOver ? "border-blue-400 bg-blue-500/10" : "border-white/15"
        } flex-1 w-full min-h-[160px] flex items-center justify-center overflow-hidden`}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) {
            setDragOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onPaste={(e) => {
          if (e.clipboardData?.files?.length) void handleFiles(e.clipboardData.files);
        }}
        tabIndex={0}
        data-itr8-id="image-node-dropzone"
      >
        {activeImage ? (
          <div className="relative" style={{ width: renderBox.w, height: renderBox.h }}>
            <img
              src={blobSrc(activeImage, thumbnailWidth)}
              alt=""
              className="absolute inset-0 w-full h-full pointer-events-none"
              draggable={false}
              onLoad={(e) => setImgSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            />
            {overlayLayout && <LayoutOverlay layout={overlayLayout} />}
          </div>
        ) : (
          <button
            type="button"
            className={buttonCls}
            onClick={() => fileInputRef.current?.click()}
            disabled={d.uploading}
          >
            {d.uploading ? "Uploading…" : "Click, drop, or paste an image"}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/tiff,image/avif"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {d.error && <p className="text-red-400 break-words">{d.error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          className={buttonCls + " flex-1"}
          onClick={() => fileInputRef.current?.click()}
        >
          Replace
        </button>
        {downloadHref ? (
          <a
            className={buttonCls + " flex-1 text-center"}
            href={downloadHref}
            target={embedded ? "_blank" : undefined}
            rel={embedded ? "noopener noreferrer" : undefined}
            download={embedded ? undefined : true}
            data-itr8-id="image-node-download"
          >
            Download
          </a>
        ) : (
          <button type="button" className={buttonCls + " flex-1"} disabled>
            Download
          </button>
        )}
        <button
          type="button"
          className={buttonCls + " flex-1"}
          disabled={!activeImage}
          onClick={() => {
            const src = activeImage && blobSrc(activeImage);
            if (src) window.open(src, "_blank", "noopener,noreferrer");
          }}
        >
          Open
        </button>
      </div>
      {d.uploaded && (
        <button
          type="button"
          className={buttonCls}
          onClick={() => updateNodeData(id, { uploaded: undefined })}
        >
          Clear upload (fall back to chained input)
        </button>
      )}
      </NodeShell>
    </>
  );
}

export default memo(ImageNodeImpl);
