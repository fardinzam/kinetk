import type { WorkflowEdge, WorkflowNode } from "@/domain/workflows/types";

type EdgeLayerProps = {
  edges: WorkflowEdge[];
  nodes: WorkflowNode[];
  onDeleteEdge(edgeId: string): void;
};

const nodeWidth = 180;
const nodeHeight = 76;

export function EdgeLayer({ edges, nodes, onDeleteEdge }: EdgeLayerProps) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <div
      aria-label="Workflow edges"
      style={{
        inset: 0,
        position: "absolute",
      }}
    >
      <svg
        aria-hidden="true"
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
      {edges.map((edge) => {
        const source = nodesById.get(edge.sourceNodeId);
        const target = nodesById.get(edge.targetNodeId);

        if (!source || !target) {
          return null;
        }

        return (
          <button
            aria-label={`Delete edge ${edge.sourceNodeId} to ${edge.targetNodeId}`}
            key={edge.id}
            onClick={() => onDeleteEdge(edge.id)}
            style={{
              left: (source.position.x + target.position.x + nodeWidth) / 2,
              position: "absolute",
              top: (source.position.y + target.position.y + nodeHeight) / 2,
            }}
            type="button"
          >
            <span
              aria-label={`edge ${edge.sourceNodeId} to ${edge.targetNodeId}`}
            >
              Edge
            </span>
          </button>
        );
      })}
    </div>
  );
}
