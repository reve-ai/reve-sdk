"use client";

import {
  Background,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toolbar } from "./Toolbar";
import { Palette } from "./Palette";
import V2CreateNode from "./nodes/V2CreateNode";
import ExtractLayoutNode from "./nodes/ExtractLayoutNode";
import CreateLayoutNode from "./nodes/CreateLayoutNode";
import RenderLayoutNode from "./nodes/RenderLayoutNode";
import LayoutEditorNode from "./nodes/LayoutEditorNode";
import ImageEditorNode from "./nodes/ImageEditorNode";
import ImageNode from "./nodes/ImageNode";
import { canConnect } from "@/lib/connectionRules";
import { computeTopologicalWaves } from "@/lib/graphOrder";
import { defaultDataFor, sourcePortKind, targetPortKind } from "@/lib/nodeRegistry";
import { clearGraph, loadGraph, saveGraph } from "@/lib/persistence";
import { seedWorkflow } from "@/lib/seedWorkflow";
import { findOpenNodePosition } from "@/lib/nodePlacement";
import { classifyImportFile, importLayoutFile } from "@/lib/fileImports";
import { uploadImageFile, validateFileClientSide } from "@/lib/uploadBlob";

const nodeTypes = {
  v2Create: V2CreateNode,
  extractLayout: ExtractLayoutNode,
  createLayout: CreateLayoutNode,
  renderLayout: RenderLayoutNode,
  layoutEditor: LayoutEditorNode,
  imageEditor: ImageEditorNode,
  image: ImageNode,
};

type Itr8Bridge = { updateModelContext?: (ctx: Record<string, unknown>) => void };

function stripTransientRunFields(node: Node): Node {
  const data = { ...(node.data as Record<string, unknown>) };
  delete data.status;
  delete data.runRequestedAt;
  delete data.lastRunHandledAt;
  return { ...node, selected: false, data };
}

async function waitForWave(
  nodeIds: string[],
  ts: number,
  getNodes: () => Node[],
  timeoutMs = 120_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const all = getNodes();
    const done = nodeIds.every((id) => {
      const n = all.find((x) => x.id === id);
      const handled = (n?.data as { lastRunHandledAt?: number } | undefined)?.lastRunHandledAt ?? 0;
      return handled >= ts;
    });
    if (done) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${nodeIds.length} node(s) to finish.`);
}

function CanvasInner() {
  const initial = useMemo(() => loadGraph() ?? seedWorkflow(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    initial.nodes.map((n) => stripTransientRunFields(n)),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const { getNodes, getEdges, screenToFlowPosition, fitView } = useReactFlow();
  const [runningAll, setRunningAll] = useState(false);
  const [runAllError, setRunAllError] = useState<string | null>(null);
  const [fileDropError, setFileDropError] = useState<string | null>(null);

  // Debounced localStorage persistence. Node data never carries base64
  // bytes (only {id, mediaType} blob refs), so this stays small regardless
  // of how many images the workflow has produced.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveGraph(nodes, edges), 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [nodes, edges]);

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const source = connection.source;
      const target = connection.target;
      if (!source || !target) return false;
      const sourceNode = getNodes().find((n) => n.id === source);
      const targetNode = getNodes().find((n) => n.id === target);
      if (!sourceNode || !targetNode) return false;
      const sourceKind = sourcePortKind(sourceNode.type, connection.sourceHandle);
      const targetKind = targetPortKind(targetNode.type, connection.targetHandle);
      if (!sourceKind || !targetKind) return false;
      const result = canConnect({
        sourceNodeId: source,
        sourceHandleKind: sourceKind,
        targetNodeId: target,
        targetHandleId: connection.targetHandle ?? "",
        targetHandleKind: targetKind,
        existingEdges: getEdges(),
      });
      return result.ok;
    },
    [getNodes, getEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, id: `e-${crypto.randomUUID().slice(0, 8)}` }, eds));
    },
    [setEdges],
  );

  const addNode = useCallback(
    (
      type: string,
      position?: { x: number; y: number },
      initialData?: Record<string, unknown>,
    ) => {
      const id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
      const addedFromPalette = position == null;
      const pos = position ?? findOpenNodePosition(getNodes());
      setNodes((nds) => [
        ...nds,
        {
          id,
          type,
          position: pos,
          data: { ...defaultDataFor(type), ...initialData },
        },
      ]);
      if (addedFromPalette) {
        requestAnimationFrame(() => {
          void fitView({ padding: 0.18, maxZoom: 0.75, duration: 250 });
        });
      }
      return id;
    },
    [fitView, getNodes, setNodes],
  );

  const patchNodeData = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ...patch } } : node,
        ),
      );
    },
    [setNodes],
  );

  const importFileAtPosition = useCallback(
    async (file: File, position: { x: number; y: number }) => {
      const kind = classifyImportFile(file);
      if (!kind) {
        setFileDropError(`Unsupported file “${file.name}”. Drop an image or a layout JSON file.`);
        return;
      }

      setFileDropError(null);
      if (kind === "image") {
        const clientError = validateFileClientSide(file);
        const id = addNode("image", position, {
          uploading: !clientError,
          error: clientError ?? undefined,
        });
        if (clientError) return;
        try {
          const uploaded = await uploadImageFile(file);
          patchNodeData(id, { uploaded, uploading: false, error: undefined });
        } catch (error) {
          patchNodeData(id, {
            uploading: false,
            error: error instanceof Error ? error.message : "Upload failed.",
          });
        }
        return;
      }

      const id = addNode("layoutEditor", position, { userEdited: true });
      const result = await importLayoutFile(file);
      if (result.ok) {
        patchNodeData(id, {
          draft: result.draft,
          output: { layout: result.layout },
          error: undefined,
          userEdited: true,
        });
      } else {
        patchNodeData(id, {
          ...(result.draft === undefined ? {} : { draft: result.draft }),
          error: result.error,
          userEdited: true,
        });
      }
    },
    [addNode, patchNodeData],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const type = event.dataTransfer.getData("application/reve-node-type");
      if (type) {
        addNode(type, position);
        return;
      }

      const files = Array.from(event.dataTransfer.files);
      files.forEach((file, index) => {
        void importFileAtPosition(file, {
          x: position.x + index * 40,
          y: position.y + index * 40,
        });
      });
    },
    [screenToFlowPosition, addNode, importFileAtPosition],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = Array.from(event.dataTransfer.types).includes("Files")
      ? "copy"
      : "move";
  }, []);

  useEffect(() => {
    if (!fileDropError) return;
    const timer = setTimeout(() => setFileDropError(null), 6000);
    return () => clearTimeout(timer);
  }, [fileDropError]);

  const duplicateSelected = useCallback(() => {
    const selectedNodes = getNodes().filter((n) => n.selected);
    if (selectedNodes.length === 0) return;
    const clones = selectedNodes.map((n) => {
      const newId = `${n.type}-${crypto.randomUUID().slice(0, 8)}`;
      const rest = { ...(n.data as Record<string, unknown>) };
      delete rest.status;
      delete rest.error;
      delete rest.runRequestedAt;
      delete rest.lastRunHandledAt;
      delete rest.output;
      return {
        ...n,
        id: newId,
        selected: true,
        position: { x: n.position.x + 40, y: n.position.y + 40 },
        data: rest,
      };
    });
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...clones]);
  }, [getNodes, setNodes]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [duplicateSelected]);

  const onSelectionChange = useCallback(
    ({ nodes: selNodes }: { nodes: Node[]; edges: Edge[] }) => {
      const bridge = (window as unknown as { itr8?: Itr8Bridge }).itr8;
      bridge?.updateModelContext?.({
        screen: "Reve Nodes canvas",
        selectedNodeType: selNodes[0]?.type ?? null,
        selectedNodeId: selNodes[0]?.id ?? null,
        selectedCount: selNodes.length,
        nodeCount: getNodes().length,
        edgeCount: getEdges().length,
      });
    },
    [getNodes, getEdges],
  );

  const runAll = useCallback(async () => {
    if (runningAll) return;
    setRunningAll(true);
    setRunAllError(null);
    try {
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const nodeIds = currentNodes.map((n) => n.id);
      const edgeLikes = currentEdges.map((e) => ({ source: e.source, target: e.target }));
      const { waves, cyclic } = computeTopologicalWaves(nodeIds, edgeLikes);
      if (cyclic.length > 0) {
        setRunAllError(`${cyclic.length} node(s) are part of a cycle and were skipped.`);
      }
      for (const wave of waves) {
        const ts = Date.now();
        setNodes((nds) =>
          nds.map((n) =>
            wave.includes(n.id) ? { ...n, data: { ...n.data, runRequestedAt: ts } } : n,
          ),
        );
        await waitForWave(wave, ts, getNodes);
      }
    } catch (err) {
      setRunAllError(err instanceof Error ? err.message : "Run all failed.");
    } finally {
      setRunningAll(false);
    }
  }, [runningAll, getNodes, getEdges, setNodes]);

  const resetWorkflow = useCallback(() => {
    if (!window.confirm("Clear the entire workflow and reload the starter example? This cannot be undone.")) {
      return;
    }
    clearGraph();
    const fresh = seedWorkflow();
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setRunAllError(null);
  }, [setNodes, setEdges]);

  return (
    <div className="relative w-full h-full" data-itr8-id="canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onSelectionChange={onSelectionChange}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 0.75 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background color="#2a2a35" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable style={{ background: "#0b0b0f" }} maskColor="rgba(0,0,0,0.6)" />
      </ReactFlow>
      <Toolbar onRunAll={runAll} runningAll={runningAll} runAllError={runAllError} onReset={resetWorkflow} />
      <Palette onAddNode={(type) => addNode(type)} />
      {fileDropError && (
        <p
          role="alert"
          className="absolute bottom-4 left-1/2 z-20 max-w-lg -translate-x-1/2 rounded border border-red-400/30 bg-[#15151c]/95 px-3 py-2 text-xs text-red-300 shadow-lg"
          data-itr8-id="file-drop-error"
        >
          {fileDropError}
        </p>
      )}
    </div>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
