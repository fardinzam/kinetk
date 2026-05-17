export type WorkflowValidationErrorCode =
  | "duplicate_node_id"
  | "duplicate_edge_id"
  | "edge_missing_source"
  | "edge_missing_target"
  | "unsupported_node_type"
  | "invalid_trigger_count"
  | "cycle_detected"
  | "unreachable_node";

export type WorkflowValidationError = {
  code: WorkflowValidationErrorCode;
  message: string;
  nodeId?: string;
  edgeId?: string;
};

export type WorkflowValidationResult = {
  valid: boolean;
  errors: WorkflowValidationError[];
};

import { workflowGraphSchema } from "./schemas";
import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from "./types";

function duplicateIds<T extends { id: string }>(items: T[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  items.forEach((item) => {
    if (seen.has(item.id)) {
      duplicates.add(item.id);
      return;
    }

    seen.add(item.id);
  });

  return duplicates;
}

function adjacencyFor(edges: WorkflowEdge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();

  edges.forEach((edge) => {
    const targets = adjacency.get(edge.sourceNodeId) ?? [];
    targets.push(edge.targetNodeId);
    adjacency.set(edge.sourceNodeId, targets);
  });

  return adjacency;
}

function hasCycle(nodeIds: string[], edges: WorkflowEdge[]): boolean {
  const adjacency = adjacencyFor(edges);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) {
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visiting.add(nodeId);

    for (const targetNodeId of adjacency.get(nodeId) ?? []) {
      if (visit(targetNodeId)) {
        return true;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  return nodeIds.some((nodeId) => visit(nodeId));
}

function reachableFrom(
  triggerNodeId: string,
  edges: WorkflowEdge[],
): Set<string> {
  const adjacency = adjacencyFor(edges);
  const reachable = new Set<string>([triggerNodeId]);
  const queue = [triggerNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (!nodeId) {
      continue;
    }

    for (const targetNodeId of adjacency.get(nodeId) ?? []) {
      if (!reachable.has(targetNodeId)) {
        reachable.add(targetNodeId);
        queue.push(targetNodeId);
      }
    }
  }

  return reachable;
}

function unsupportedNodeErrors(input: unknown): WorkflowValidationError[] {
  const nodes = (input as { nodes?: unknown }).nodes;

  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes.flatMap((node) => {
    if (!node || typeof node !== "object") {
      return [];
    }

    const candidate = node as { id?: unknown; type?: unknown };
    const supportedTypes = new Set([
      "webhook_trigger",
      "transform_json",
      "condition",
      "http_request",
      "log",
    ]);

    if (
      typeof candidate.type === "string" &&
      !supportedTypes.has(candidate.type)
    ) {
      return [
        {
          code: "unsupported_node_type" as const,
          message: `Unsupported node type: ${candidate.type}`,
          nodeId: typeof candidate.id === "string" ? candidate.id : undefined,
        },
      ];
    }

    return [];
  });
}

export function validateExecutableGraph(
  input: unknown,
): WorkflowValidationResult {
  const errors: WorkflowValidationError[] = [...unsupportedNodeErrors(input)];
  const parsed = workflowGraphSchema.safeParse(input);

  if (!parsed.success) {
    return {
      valid: false,
      errors:
        errors.length > 0
          ? errors
          : [
              {
                code: "unsupported_node_type",
                message: "Workflow graph does not match the supported schema",
              },
            ],
    };
  }

  const graph: WorkflowGraph = parsed.data;
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const duplicateNodeIds = duplicateIds(graph.nodes);
  const duplicateEdgeIds = duplicateIds(graph.edges);

  duplicateNodeIds.forEach((nodeId) => {
    errors.push({
      code: "duplicate_node_id",
      message: `Duplicate node id: ${nodeId}`,
      nodeId,
    });
  });

  duplicateEdgeIds.forEach((edgeId) => {
    errors.push({
      code: "duplicate_edge_id",
      message: `Duplicate edge id: ${edgeId}`,
      edgeId,
    });
  });

  graph.edges.forEach((edge) => {
    if (!nodeIds.has(edge.sourceNodeId)) {
      errors.push({
        code: "edge_missing_source",
        message: `Edge ${edge.id} references missing source node ${edge.sourceNodeId}`,
        edgeId: edge.id,
      });
    }

    if (!nodeIds.has(edge.targetNodeId)) {
      errors.push({
        code: "edge_missing_target",
        message: `Edge ${edge.id} references missing target node ${edge.targetNodeId}`,
        edgeId: edge.id,
      });
    }
  });

  const triggerNodes = graph.nodes.filter(
    (node): node is WorkflowNode<"webhook_trigger"> =>
      node.type === "webhook_trigger",
  );

  if (triggerNodes.length !== 1) {
    errors.push({
      code: "invalid_trigger_count",
      message: `Expected exactly one webhook trigger, found ${triggerNodes.length}`,
    });
  }

  const edgesWithExistingNodes = graph.edges.filter(
    (edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId),
  );

  if (hasCycle([...nodeIds], edgesWithExistingNodes)) {
    errors.push({
      code: "cycle_detected",
      message: "Workflow graph must be acyclic",
    });
  }

  const triggerNode = triggerNodes[0];

  if (triggerNode) {
    const reachable = reachableFrom(triggerNode.id, edgesWithExistingNodes);

    graph.nodes.forEach((node) => {
      if (node.type !== "webhook_trigger" && !reachable.has(node.id)) {
        errors.push({
          code: "unreachable_node",
          message: `Node ${node.id} is not reachable from the webhook trigger`,
          nodeId: node.id,
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
