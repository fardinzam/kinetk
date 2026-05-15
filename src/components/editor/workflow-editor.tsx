"use client";

import { useEffect, useMemo, useState } from "react";

import type { WorkflowGraph, WorkflowPosition } from "@/domain/workflows/types";

import { Canvas } from "./canvas";
import {
  createEditorState,
  deleteSelectedNode,
  moveNode,
  panViewport,
  selectNode,
  zoomViewport,
} from "./editor-state";
import { EditorToolbar } from "./editor-toolbar";

type WorkflowEditorProps = {
  initialGraph: WorkflowGraph;
};

type DragState = {
  nodeId: string;
  offset: WorkflowPosition;
};

export function WorkflowEditor({ initialGraph }: WorkflowEditorProps) {
  const [state, setState] = useState(() => createEditorState(initialGraph));
  const [dragState, setDragState] = useState<DragState | null>(null);

  const nodesById = useMemo(
    () => new Map(state.graph.nodes.map((node) => [node.id, node])),
    [state.graph.nodes],
  );

  function handleNodePointerDown(nodeId: string, pointer: WorkflowPosition) {
    const node = nodesById.get(nodeId);

    if (!node) {
      return;
    }

    setState((current) => selectNode(current, nodeId));
    setDragState({
      nodeId,
      offset: {
        x: pointer.x - node.position.x,
        y: pointer.y - node.position.y,
      },
    });
  }

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const activeDrag = dragState;

    function handlePointerMove(event: PointerEvent) {
      setState((current) =>
        moveNode(current, activeDrag.nodeId, {
          x:
            (event.clientX - activeDrag.offset.x - current.graph.viewport.x) /
            current.graph.viewport.zoom,
          y:
            (event.clientY - activeDrag.offset.y - current.graph.viewport.y) /
            current.graph.viewport.zoom,
        }),
      );
    }

    function handlePointerUp() {
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState]);

  return (
    <section aria-label="Workflow editor">
      <EditorToolbar
        canDelete={state.selectedNodeId !== null}
        zoom={state.graph.viewport.zoom}
        onDeleteSelected={() =>
          setState((current) => deleteSelectedNode(current))
        }
        onPan={(delta) => setState((current) => panViewport(current, delta))}
        onZoom={(zoom) => setState((current) => zoomViewport(current, zoom))}
      />
      <Canvas
        graph={state.graph}
        selectedNodeId={state.selectedNodeId}
        onNodePointerDown={handleNodePointerDown}
      />
    </section>
  );
}
