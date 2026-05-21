"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { nanoid } from "nanoid";

import type { PresenceUser } from "@/client/realtime/use-workflow-presence";
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

type NodeStepStatus = { status: string; errorJson?: unknown };

type WorkflowEditorProps = {
  initialGraph: WorkflowGraph;
  presenceUsers?: PresenceUser[];
  cursorPositionsRef?: React.RefObject<Map<string, { x: number; y: number }>>;
  workspaceId?: string;
  nodeStatusMap?: ReadonlyMap<string, NodeStepStatus>;
  onCursorMove?: (x: number, y: number) => void;
  onLocalEvent?(event: WorkflowEvent): void;
};

type DragState = {
  nodeId: string;
  nodeEl: HTMLElement;
  startPosition: WorkflowPosition;
  latestPosition: WorkflowPosition;
  offset: WorkflowPosition;
  rafId: number | null;
  dirty: boolean;
};

type ConnectingState = {
  nodeId: string;
  sourceHandle?: string;
};

export function WorkflowEditor({
  initialGraph,
  presenceUsers,
  cursorPositionsRef,
  workspaceId,
  nodeStatusMap,
  onCursorMove,
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
  const [connectingFrom, setConnectingFrom] = useState<ConnectingState | null>(
    null,
  );
  const dragStateRef = useRef<DragState | null>(null);
  const graphRef = useRef(state.graph);
  const applyGraphChangeRef = useRef(applyGraphChange);
  const onLocalEventRef = useRef(onLocalEvent);
  useEffect(() => {
    onLocalEventRef.current = onLocalEvent;
    applyGraphChangeRef.current = applyGraphChange;
    graphRef.current = state.graph;
  });

  const nodesById = useMemo(
    () => new Map(state.graph.nodes.map((node) => [node.id, node])),
    [state.graph.nodes],
  );
  const selectedNode = state.selectedNodeId
    ? (nodesById.get(state.selectedNodeId) ?? null)
    : null;
  const validationResult = useMemo(
    () => validateExecutableGraph(state.graph),
    [state.graph],
  );

  function handleNodePointerDown(
    nodeId: string,
    pointer: WorkflowPosition,
    nodeEl: HTMLElement,
  ) {
    const node = nodesById.get(nodeId);

    if (!node) {
      return;
    }

    const { zoom, x: vpX, y: vpY } = state.graph.viewport;
    snapshotGraph();
    applyState((current) => selectNode(current, nodeId));

    nodeEl.style.willChange = "transform";
    nodeEl.style.cursor = "grabbing";

    dragStateRef.current = {
      nodeId,
      nodeEl,
      startPosition: { ...node.position },
      latestPosition: { ...node.position },
      offset: {
        x: pointer.x - node.position.x * zoom - vpX,
        y: pointer.y - node.position.y * zoom - vpY,
      },
      rafId: null,
      dirty: false,
    };
  }

  useEffect(() => {
    function scheduleDragPaint(activeDrag: DragState) {
      if (activeDrag.rafId !== null) {
        return;
      }

      activeDrag.rafId = requestAnimationFrame(() => {
        activeDrag.rafId = null;

        const deltaX = activeDrag.latestPosition.x - activeDrag.startPosition.x;
        const deltaY = activeDrag.latestPosition.y - activeDrag.startPosition.y;

        activeDrag.nodeEl.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
      });
    }

    function handlePointerMove(event: PointerEvent) {
      const activeDrag = dragStateRef.current;
      if (!activeDrag) {
        return;
      }

      const viewport = graphRef.current.viewport;
      activeDrag.latestPosition = {
        x: (event.clientX - activeDrag.offset.x - viewport.x) / viewport.zoom,
        y: (event.clientY - activeDrag.offset.y - viewport.y) / viewport.zoom,
      };
      activeDrag.dirty = true;
      scheduleDragPaint(activeDrag);
    }

    function handlePointerUp() {
      const activeDrag = dragStateRef.current;
      if (!activeDrag) {
        return;
      }

      dragStateRef.current = null;

      if (activeDrag.rafId !== null) {
        cancelAnimationFrame(activeDrag.rafId);
      }

      activeDrag.nodeEl.style.transform = "";
      activeDrag.nodeEl.style.willChange = "";
      activeDrag.nodeEl.style.cursor = "";

      if (!activeDrag.dirty) {
        return;
      }

      const finalPosition = { ...activeDrag.latestPosition };
      applyGraphChangeRef.current((current) =>
        moveNode(current, activeDrag.nodeId, finalPosition),
      );
      onLocalEventRef.current?.({
        clientEventId: nanoid(),
        type: "node_moved",
        eventSchemaVersion: 1,
        payload: { nodeId: activeDrag.nodeId, position: finalPosition },
        createdAt: new Date().toISOString(),
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);

      const activeDrag = dragStateRef.current;
      if (activeDrag?.rafId !== null && activeDrag?.rafId !== undefined) {
        cancelAnimationFrame(activeDrag.rafId);
      }
      if (activeDrag) {
        activeDrag.nodeEl.style.transform = "";
        activeDrag.nodeEl.style.willChange = "";
        activeDrag.nodeEl.style.cursor = "";
      }
      dragStateRef.current = null;
    };
  }, []);

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
            onLocalEvent?.({
              clientEventId: nanoid(),
              type: "node_added",
              eventSchemaVersion: 1,
              payload: { node: addedNode },
              createdAt: new Date().toISOString(),
            } as unknown as WorkflowEvent);
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
        connectingFromNodeId={connectingFrom?.nodeId ?? null}
        graph={state.graph}
        presenceUsers={presenceUsers}
        cursorPositionsRef={cursorPositionsRef}
        selectedNodeId={state.selectedNodeId}
        nodeStatusMap={nodeStatusMap}
        onConnectFrom={(nodeId, sourceHandle) =>
          setConnectingFrom({ nodeId, sourceHandle })
        }
        onCursorMove={onCursorMove}
        onConnectTo={(nodeId) => {
          if (!connectingFrom) {
            return;
          }

          const next = connectNodes(
            state,
            connectingFrom.nodeId,
            nodeId,
            connectingFrom.sourceHandle,
          );
          const addedEdge = next.graph.edges.find(
            (e) => !state.graph.edges.some((f) => f.id === e.id),
          );
          applyGraphChange(() => next);
          setConnectingFrom(null);
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
      {nodeStatusMap && selectedNode && nodeStatusMap.has(selectedNode.id) && (
        <aside aria-label="Step detail">
          <h3>Step: {selectedNode.id}</h3>
          <p>Status: {nodeStatusMap.get(selectedNode.id)!.status}</p>
          {nodeStatusMap.get(selectedNode.id)!.errorJson !== null &&
            nodeStatusMap.get(selectedNode.id)!.errorJson !== undefined && (
              <details>
                <summary>Error</summary>
                <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(
                    nodeStatusMap.get(selectedNode.id)!.errorJson,
                    null,
                    2,
                  )}
                </pre>
              </details>
            )}
        </aside>
      )}
      <NodeConfigPanel
        node={selectedNode}
        workspaceId={workspaceId}
        onChange={(config) => {
          if (!selectedNode) {
            return;
          }

          applyGraphChange((current) =>
            updateSelectedNodeConfig(current, config),
          );
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
