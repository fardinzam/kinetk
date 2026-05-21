import { useEffect, useRef } from "react";

import type { PresenceUser } from "@/client/realtime/use-workflow-presence";
import type {
  WorkflowGraph,
  WorkflowPosition,
  WorkflowViewport,
} from "@/domain/workflows/types";

import { EdgeLayer } from "./edge-layer";
import { NodeCard } from "./node-card";

type NodeStepStatus = { status: string };

type CanvasProps = {
  connectingFromNodeId: string | null;
  graph: WorkflowGraph;
  presenceUsers?: PresenceUser[];
  cursorPositionsRef?: React.RefObject<Map<string, { x: number; y: number }>>;
  selectedNodeId: string | null;
  nodeStatusMap?: ReadonlyMap<string, NodeStepStatus>;
  onConnectFrom(nodeId: string, sourceHandle?: string): void;
  onConnectTo(nodeId: string): void;
  onCursorMove?: (x: number, y: number) => void;
  onDeleteEdge(edgeId: string): void;
  onNodePointerDown(
    nodeId: string,
    pointer: WorkflowPosition,
    nodeEl: HTMLElement,
  ): void;
};

type CursorOverlayProps = {
  presenceUsers: PresenceUser[];
  cursorPositionsRef: React.RefObject<Map<string, { x: number; y: number }>>;
  viewport: WorkflowViewport;
};

function CursorOverlay({
  presenceUsers,
  cursorPositionsRef,
  viewport,
}: CursorOverlayProps) {
  const domRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const viewportRef = useRef(viewport);
  // Keep viewportRef current on every render so the RAF loop always reads the
  // latest pan/zoom without needing to restart.
  useEffect(() => {
    viewportRef.current = viewport;
  });

  useEffect(() => {
    if (presenceUsers.length === 0) return;

    let rafId: number;

    function tick() {
      const vp = viewportRef.current;
      for (const { sessionId } of presenceUsers) {
        const pos = cursorPositionsRef.current?.get(sessionId);
        const el = domRefs.current.get(sessionId);
        if (!pos || !el) continue;
        el.style.transform = `translate(${pos.x * vp.zoom + vp.x - 2}px, ${pos.y * vp.zoom + vp.y - 2}px)`;
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [presenceUsers, cursorPositionsRef]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {presenceUsers.map((u) => (
        <div
          key={u.sessionId}
          ref={(el) => {
            if (el) domRefs.current.set(u.sessionId, el);
            else domRefs.current.delete(u.sessionId);
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            // GPU-composited interpolation between 20fps broadcast updates
            transition: "transform 50ms linear",
          }}
        >
          <svg fill={u.color} height="16" viewBox="0 0 16 16" width="16">
            <path d="M0 0 L0 12 L4 8 L8 16 L10 15 L6 7 L12 7 Z" />
          </svg>
          <span
            style={{
              background: u.color,
              borderRadius: 3,
              color: "#fff",
              fontSize: 11,
              padding: "1px 4px",
              whiteSpace: "nowrap",
            }}
          >
            {u.displayName}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Canvas({
  connectingFromNodeId,
  graph,
  presenceUsers,
  cursorPositionsRef,
  selectedNodeId,
  nodeStatusMap,
  onConnectFrom,
  onConnectTo,
  onCursorMove,
  onDeleteEdge,
  onNodePointerDown,
}: CanvasProps) {
  return (
    <div
      aria-label="Workflow canvas"
      style={{
        backgroundColor: "#f8fafc",
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        height: 560,
        marginTop: 16,
        overflow: "hidden",
        position: "relative",
      }}
      onPointerMove={
        onCursorMove
          ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const graphX =
                (e.clientX - rect.left - graph.viewport.x) /
                graph.viewport.zoom;
              const graphY =
                (e.clientY - rect.top - graph.viewport.y) / graph.viewport.zoom;
              onCursorMove(graphX, graphY);
            }
          : undefined
      }
    >
      <div
        style={{
          position: "absolute",
          transform: `translate(${graph.viewport.x}px, ${graph.viewport.y}px) scale(${graph.viewport.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <EdgeLayer
          edges={graph.edges}
          nodes={graph.nodes}
          onDeleteEdge={onDeleteEdge}
        />
        {graph.nodes.map((node) => (
          <NodeCard
            isConnectingFrom={node.id === connectingFromNodeId}
            isSelected={node.id === selectedNodeId}
            key={node.id}
            node={node}
            stepStatus={
              nodeStatusMap?.get(node.id)?.status as Parameters<
                typeof NodeCard
              >[0]["stepStatus"]
            }
            onConnectFrom={onConnectFrom}
            onConnectTo={onConnectTo}
            onPointerDown={onNodePointerDown}
          />
        ))}
      </div>
      {presenceUsers &&
        presenceUsers.length > 0 &&
        cursorPositionsRef !== undefined && (
          <CursorOverlay
            presenceUsers={presenceUsers}
            cursorPositionsRef={cursorPositionsRef}
            viewport={graph.viewport}
          />
        )}
    </div>
  );
}
