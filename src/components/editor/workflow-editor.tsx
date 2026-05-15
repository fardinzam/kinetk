"use client";

import { useEffect, useMemo, useState } from "react";

import type { WorkflowEvent } from "@/domain/workflows/events";
import { validateExecutableGraph } from "@/domain/workflows/validation";
import type { WorkflowGraph, WorkflowPosition } from "@/domain/workflows/types";

import { Canvas } from "./canvas";
import {
  addNode,
  connectNodes,
  createEditorState,
  deleteEdge,
  deleteSelectedNode,
  moveNode,
  panViewport,
  selectNode,
  updateSelectedNodeConfig,
  zoomViewport,
} from "./editor-state";
import { EditorToolbar } from "./editor-toolbar";
import { NodeConfigPanel } from "./node-config-panel";
import { NodePalette } from "./node-palette";

type WorkflowEditorProps = {
  initialGraph: WorkflowGraph;
  onLocalEvent?(event: WorkflowEvent): void;
};

type DragState = {
  nodeId: string;
  offset: WorkflowPosition;
};

export function WorkflowEditor({
  initialGraph,
  onLocalEvent,
}: WorkflowEditorProps) {
  const [state, setState] = useState(() => createEditorState(initialGraph));
  const [connectingFromNodeId, setConnectingFromNodeId] = useState<string | null>(
    null,
  );
  const [dragState, setDragState] = useState<DragState | null>(null);

  const nodesById = useMemo(
    () => new Map(state.graph.nodes.map((node) => [node.id, node])),
    [state.graph.nodes],
  );
  const selectedNode = state.selectedNodeId
    ? nodesById.get(state.selectedNodeId) ?? null
    : null;
  const validationResult = useMemo(
    () => validateExecutableGraph(state.graph),
    [state.graph],
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
      <section aria-label="Graph validation">
        {validationResult.valid ? (
          <p>Graph is executable.</p>
        ) : (
          <ul>
            {validationResult.errors.map((error) => (
              <li key={`${error.code}-${error.nodeId ?? error.edgeId ?? ""}`}>
                <strong>{error.code}</strong>
                <span>{error.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <NodePalette
        canAddWebhookTrigger={
          !state.graph.nodes.some((node) => node.type === "webhook_trigger")
        }
        onAddNode={(type) => setState((current) => addNode(current, type))}
      />
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
        connectingFromNodeId={connectingFromNodeId}
        graph={state.graph}
        selectedNodeId={state.selectedNodeId}
        onConnectFrom={setConnectingFromNodeId}
        onConnectTo={(nodeId) => {
          if (!connectingFromNodeId) {
            return;
          }

          setState((current) =>
            connectNodes(current, connectingFromNodeId, nodeId),
          );
          setConnectingFromNodeId(null);
        }}
        onDeleteEdge={(edgeId) =>
          setState((current) => deleteEdge(current, edgeId))
        }
        onNodePointerDown={handleNodePointerDown}
      />
      <NodeConfigPanel
        node={selectedNode}
        onChange={(config) => {
          if (!selectedNode) {
            return;
          }

          setState((current) => updateSelectedNodeConfig(current, config));
          onLocalEvent?.({
            clientEventId: `local-${Date.now()}`,
            type: "node_updated",
            eventSchemaVersion: 1,
            payload: {
              nodeId: selectedNode.id,
              config,
            },
            createdAt: new Date().toISOString(),
          });
        }}
      />
    </section>
  );
}
