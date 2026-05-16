"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { nanoid } from "nanoid";

import type { WorkflowEvent } from "@/domain/workflows/events";
import { validateExecutableGraph } from "@/domain/workflows/validation";
import type { WorkflowGraph, WorkflowPosition } from "@/domain/workflows/types";

import { Canvas } from "./canvas";
import {
  addNode,
  connectNodes,
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
import { useEditorHistory } from "./use-editor-history";

type WorkflowEditorProps = {
  initialGraph: WorkflowGraph;
  workspaceId?: string;
  onLocalEvent?(event: WorkflowEvent): void;
};

type DragState = {
  nodeId: string;
  offset: WorkflowPosition;
};

export function WorkflowEditor({
  initialGraph,
  workspaceId,
  onLocalEvent,
}: WorkflowEditorProps) {
  const {
    state,
    applyState,
    applyGraphChange,
    snapshotGraph,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditorHistory(initialGraph);
  const [connectingFromNodeId, setConnectingFromNodeId] = useState<string | null>(
    null,
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const onLocalEventRef = useRef(onLocalEvent);
  useEffect(() => { onLocalEventRef.current = onLocalEvent; });

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

    snapshotGraph();
    applyState((current) => selectNode(current, nodeId));
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
      applyState((current) =>
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
      applyState((current) => {
        const node = current.graph.nodes.find((n) => n.id === activeDrag.nodeId);
        if (node) {
          onLocalEventRef.current?.({
            clientEventId: nanoid(),
            type: "node_moved",
            eventSchemaVersion: 1,
            payload: { nodeId: node.id, position: node.position },
            createdAt: new Date().toISOString(),
          });
        }
        return current;
      });
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState]); // eslint-disable-line react-hooks/exhaustive-deps

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
        onAddNode={(type) => {
          const next = addNode(state, type);
          const addedNode = next.graph.nodes.find(
            (n) => !state.graph.nodes.some((e) => e.id === n.id),
          );
          applyGraphChange(() => next);
          if (addedNode) {
            // WorkflowNode<NodeType> is structurally correct but doesn't satisfy
            // Zod's discriminated union — cast through unknown
            onLocalEvent?.(({
              clientEventId: nanoid(),
              type: "node_added",
              eventSchemaVersion: 1,
              payload: { node: addedNode },
              createdAt: new Date().toISOString(),
            }) as unknown as WorkflowEvent);
          }
        }}
      />
      <EditorToolbar
        canDelete={state.selectedNodeId !== null}
        canRedo={canRedo}
        canUndo={canUndo}
        zoom={state.graph.viewport.zoom}
        onDeleteSelected={() => {
          if (state.selectedNodeId) {
            onLocalEvent?.({
              clientEventId: nanoid(),
              type: "node_deleted",
              eventSchemaVersion: 1,
              payload: { nodeId: state.selectedNodeId },
              createdAt: new Date().toISOString(),
            });
          }
          applyGraphChange((current) => deleteSelectedNode(current));
        }}
        onPan={(delta) => applyState((current) => panViewport(current, delta))}
        onRedo={redo}
        onUndo={undo}
        onZoom={(zoom) => applyState((current) => zoomViewport(current, zoom))}
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

          const next = connectNodes(state, connectingFromNodeId, nodeId);
          const addedEdge = next.graph.edges.find(
            (e) => !state.graph.edges.some((f) => f.id === e.id),
          );
          applyGraphChange(() => next);
          setConnectingFromNodeId(null);
          if (addedEdge) {
            onLocalEvent?.({
              clientEventId: nanoid(),
              type: "edge_added",
              eventSchemaVersion: 1,
              payload: { edge: addedEdge },
              createdAt: new Date().toISOString(),
            });
          }
        }}
        onDeleteEdge={(edgeId) => {
          onLocalEvent?.({
            clientEventId: nanoid(),
            type: "edge_deleted",
            eventSchemaVersion: 1,
            payload: { edgeId },
            createdAt: new Date().toISOString(),
          });
          applyGraphChange((current) => deleteEdge(current, edgeId));
        }}
        onNodePointerDown={handleNodePointerDown}
      />
      <NodeConfigPanel
        node={selectedNode}
        workspaceId={workspaceId}
        onChange={(config) => {
          if (!selectedNode) {
            return;
          }

          applyGraphChange((current) => updateSelectedNodeConfig(current, config));
          onLocalEvent?.({
            clientEventId: nanoid(),
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
