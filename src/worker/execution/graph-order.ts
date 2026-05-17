import type { WorkflowGraph } from "@/domain/workflows/types";

export function getNextNodeIds(
  graph: WorkflowGraph,
  nodeId: string,
  branch?: string,
): string[] {
  return graph.edges
    .filter((edge) => {
      if (edge.sourceNodeId !== nodeId) return false;
      if (branch !== undefined && edge.sourceHandle !== branch) return false;
      return true;
    })
    .map((edge) => edge.targetNodeId);
}
