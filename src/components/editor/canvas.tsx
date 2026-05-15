import type { WorkflowGraph, WorkflowPosition } from "@/domain/workflows/types";

import { EdgeLayer } from "./edge-layer";
import { NodeCard } from "./node-card";

type CanvasProps = {
  graph: WorkflowGraph;
  selectedNodeId: string | null;
  onNodePointerDown(nodeId: string, pointer: WorkflowPosition): void;
};

export function Canvas({
  graph,
  selectedNodeId,
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
        <EdgeLayer edges={graph.edges} nodes={graph.nodes} />
        {graph.nodes.map((node) => (
          <NodeCard
            isSelected={node.id === selectedNodeId}
            key={node.id}
            node={node}
            onPointerDown={onNodePointerDown}
          />
        ))}
      </div>
    </div>
  );
}
