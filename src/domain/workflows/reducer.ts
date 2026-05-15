import type { WorkflowEvent } from "./events";
import { nodeConfigSchema, workflowNodeSchema } from "./schemas";
import type { WorkflowGraph } from "./types";

export type WorkflowState = {
  name: string;
  graph: WorkflowGraph;
};

export function applyWorkflowEvent(
  state: WorkflowState,
  event: WorkflowEvent,
): WorkflowState {
  switch (event.type) {
    case "workflow_renamed":
      return {
        ...state,
        name: event.payload.name,
      };
    case "node_added":
      return {
        ...state,
        graph: {
          ...state.graph,
          nodes: [...state.graph.nodes, workflowNodeSchema.parse(event.payload.node)],
        },
      };
    case "node_updated":
      return {
        ...state,
        graph: {
          ...state.graph,
          nodes: state.graph.nodes.map((node) => {
            if (node.id !== event.payload.nodeId) {
              return node;
            }

            const parsed = nodeConfigSchema.parse({
              type: node.type,
              config: event.payload.config,
            });

            return {
              ...node,
              config: parsed.config,
            };
          }),
        },
      };
    case "node_moved":
      return {
        ...state,
        graph: {
          ...state.graph,
          nodes: state.graph.nodes.map((node) =>
            node.id === event.payload.nodeId
              ? { ...node, position: { ...event.payload.position } }
              : node,
          ),
        },
      };
    case "node_deleted":
      return {
        ...state,
        graph: {
          ...state.graph,
          nodes: state.graph.nodes.filter(
            (node) => node.id !== event.payload.nodeId,
          ),
          edges: state.graph.edges.filter(
            (edge) =>
              edge.sourceNodeId !== event.payload.nodeId &&
              edge.targetNodeId !== event.payload.nodeId,
          ),
        },
      };
    case "edge_added":
      return {
        ...state,
        graph: {
          ...state.graph,
          edges: [...state.graph.edges, event.payload.edge],
        },
      };
    case "edge_deleted":
      return {
        ...state,
        graph: {
          ...state.graph,
          edges: state.graph.edges.filter(
            (edge) => edge.id !== event.payload.edgeId,
          ),
        },
      };
  }
}
