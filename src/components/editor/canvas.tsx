import type { PresenceUser } from "@/client/realtime/use-workflow-presence";
import type { WorkflowGraph, WorkflowPosition } from "@/domain/workflows/types";

import { EdgeLayer } from "./edge-layer";
import { NodeCard } from "./node-card";

type NodeStepStatus = { status: string };

type CanvasProps = {
  connectingFromNodeId: string | null;
  graph: WorkflowGraph;
  presenceUsers?: PresenceUser[];
  selectedNodeId: string | null;
  nodeStatusMap?: ReadonlyMap<string, NodeStepStatus>;
  onConnectFrom(nodeId: string): void;
  onConnectTo(nodeId: string): void;
  onCursorMove?: (x: number, y: number) => void;
  onDeleteEdge(edgeId: string): void;
  onNodePointerDown(nodeId: string, pointer: WorkflowPosition): void;
};

export function Canvas({
  connectingFromNodeId,
  graph,
  presenceUsers,
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
      {presenceUsers && presenceUsers.length > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
          }}
        >
          {presenceUsers.map((u) => (
            <div
              key={u.userId}
              style={{
                position: "absolute",
                left: u.x * graph.viewport.zoom + graph.viewport.x,
                top: u.y * graph.viewport.zoom + graph.viewport.y,
                transform: "translate(-2px, -2px)",
                pointerEvents: "none",
              }}
            >
              <svg
                fill={u.color}
                height="16"
                viewBox="0 0 16 16"
                width="16"
              >
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
      )}
    </div>
  );
}
