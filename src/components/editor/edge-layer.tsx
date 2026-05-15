import type { WorkflowEdge, WorkflowNode } from "@/domain/workflows/types";

type EdgeLayerProps = {
  edges: WorkflowEdge[];
  nodes: WorkflowNode[];
};

const nodeWidth = 180;
const nodeHeight = 76;

export function EdgeLayer({ edges, nodes }: EdgeLayerProps) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <svg
      aria-label="Workflow edges"
      style={{
        inset: 0,
        overflow: "visible",
        pointerEvents: "none",
        position: "absolute",
      }}
    >
      {edges.map((edge) => {
        const source = nodesById.get(edge.sourceNodeId);
        const target = nodesById.get(edge.targetNodeId);

        if (!source || !target) {
          return null;
        }

        const startX = source.position.x + nodeWidth;
        const startY = source.position.y + nodeHeight / 2;
        const endX = target.position.x;
        const endY = target.position.y + nodeHeight / 2;
        const controlOffset = Math.max((endX - startX) / 2, 64);

        return (
          <path
            aria-label={`edge ${edge.sourceNodeId} to ${edge.targetNodeId}`}
            d={`M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${
              endX - controlOffset
            } ${endY}, ${endX} ${endY}`}
            fill="none"
            key={edge.id}
            stroke="#64748b"
            strokeLinecap="round"
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}
