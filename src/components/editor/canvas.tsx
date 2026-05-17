import type { WorkflowGraph, WorkflowPosition } from "@/domain/workflows/types";

import { EdgeLayer } from "./edge-layer";
import { NodeCard } from "./node-card";

type NodeStepStatus = { status: string };

type CanvasProps = {
  connectingFromNodeId: string | null;
  graph: WorkflowGraph;
  selectedNodeId: string | null;
  nodeStatusMap?: ReadonlyMap<string, NodeStepStatus>;
  onConnectFrom(nodeId: string): void;
  onConnectTo(nodeId: string): void;
  onDeleteEdge(edgeId: string): void;
  onNodePointerDown(nodeId: string, pointer: WorkflowPosition): void;
};

export function Canvas({
  connectingFromNodeId,
  graph,
  selectedNodeId,
  nodeStatusMap,
  onConnectFrom,
  onConnectTo,
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
    </div>
  );
}
