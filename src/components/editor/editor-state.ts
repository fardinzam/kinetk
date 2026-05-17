import type { NodeType } from "@/domain/workflows/node-configs";
import { nodeConfigSchema } from "@/domain/workflows/schemas";
import type {
  WorkflowGraph,
  WorkflowNode,
  WorkflowPosition,
} from "@/domain/workflows/types";

export type EditorState = {
  graph: WorkflowGraph;
  selectedNodeId: string | null;
};

export function createEditorState(graph: WorkflowGraph): EditorState {
  return {
    graph,
    selectedNodeId: null,
  };
}

export function selectNode(state: EditorState, nodeId: string): EditorState {
  return {
    ...state,
    selectedNodeId: nodeId,
  };
}

export function clearSelection(state: EditorState): EditorState {
  return {
    ...state,
    selectedNodeId: null,
  };
}

function defaultConfigForType(type: NodeType): WorkflowNode["config"] {
  switch (type) {
    case "webhook_trigger":
      return {};
    case "transform_json":
      return { mappings: [] };
    case "condition":
      return {
        leftPath: "$.value",
        operator: "exists",
      };
    case "http_request":
      return {
        method: "POST",
        url: "https://example.com/webhook",
        headers: {},
        bodyMode: "current_payload",
      };
    case "log":
      return { label: "Log event" };
  }
}

function nextNodeId(graph: WorkflowGraph, type: NodeType): string {
  const existingIds = new Set(graph.nodes.map((node) => node.id));
  let index = 1;

  while (existingIds.has(`${type}_${index}`)) {
    index += 1;
  }

  return `${type}_${index}`;
}

export function addNode(state: EditorState, type: NodeType): EditorState {
  if (
    type === "webhook_trigger" &&
    state.graph.nodes.some((node) => node.type === "webhook_trigger")
  ) {
    return state;
  }

  const id = nextNodeId(state.graph, type);
  const node = {
    id,
    type,
    position: {
      x: 80 + state.graph.nodes.length * 40,
      y: 96 + state.graph.nodes.length * 32,
    },
    config: defaultConfigForType(type),
  } as WorkflowNode;

  return {
    selectedNodeId: id,
    graph: {
      ...state.graph,
      nodes: [...state.graph.nodes, node],
    },
  };
}

export function moveNode(
  state: EditorState,
  nodeId: string,
  position: WorkflowPosition,
): EditorState {
  return {
    ...state,
    graph: {
      ...state.graph,
      nodes: state.graph.nodes.map((node) =>
        node.id === nodeId ? { ...node, position: { ...position } } : node,
      ),
    },
  };
}

export function deleteSelectedNode(state: EditorState): EditorState {
  if (!state.selectedNodeId) {
    return state;
  }

  const nodeId = state.selectedNodeId;

  return {
    selectedNodeId: null,
    graph: {
      ...state.graph,
      nodes: state.graph.nodes.filter((node) => node.id !== nodeId),
      edges: state.graph.edges.filter(
        (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId,
      ),
    },
  };
}

function nextEdgeId(
  graph: WorkflowGraph,
  sourceNodeId: string,
  targetNodeId: string,
): string {
  const existingIds = new Set(graph.edges.map((edge) => edge.id));
  let index = 1;

  while (existingIds.has(`edge_${sourceNodeId}_${targetNodeId}_${index}`)) {
    index += 1;
  }

  return `edge_${sourceNodeId}_${targetNodeId}_${index}`;
}

export function connectNodes(
  state: EditorState,
  sourceNodeId: string,
  targetNodeId: string,
): EditorState {
  if (sourceNodeId === targetNodeId) {
    return state;
  }

  const nodeIds = new Set(state.graph.nodes.map((node) => node.id));

  if (!nodeIds.has(sourceNodeId) || !nodeIds.has(targetNodeId)) {
    return state;
  }

  if (
    state.graph.edges.some(
      (edge) =>
        edge.sourceNodeId === sourceNodeId &&
        edge.targetNodeId === targetNodeId,
    )
  ) {
    return state;
  }

  return {
    ...state,
    graph: {
      ...state.graph,
      edges: [
        ...state.graph.edges,
        {
          id: nextEdgeId(state.graph, sourceNodeId, targetNodeId),
          sourceNodeId,
          targetNodeId,
        },
      ],
    },
  };
}

export function deleteEdge(state: EditorState, edgeId: string): EditorState {
  return {
    ...state,
    graph: {
      ...state.graph,
      edges: state.graph.edges.filter((edge) => edge.id !== edgeId),
    },
  };
}

export function updateSelectedNodeConfig(
  state: EditorState,
  config: unknown,
): EditorState {
  if (!state.selectedNodeId) {
    return state;
  }

  return {
    ...state,
    graph: {
      ...state.graph,
      nodes: state.graph.nodes.map((node) => {
        if (node.id !== state.selectedNodeId) {
          return node;
        }

        const parsed = nodeConfigSchema.parse({
          type: node.type,
          config,
        });

        return {
          ...node,
          config: parsed.config,
        } as WorkflowNode;
      }),
    },
  };
}

export function panViewport(
  state: EditorState,
  delta: WorkflowPosition,
): EditorState {
  return {
    ...state,
    graph: {
      ...state.graph,
      viewport: {
        ...state.graph.viewport,
        x: state.graph.viewport.x + delta.x,
        y: state.graph.viewport.y + delta.y,
      },
    },
  };
}

export function zoomViewport(state: EditorState, zoom: number): EditorState {
  const nextZoom = Math.min(Math.max(zoom, 0.25), 2.5);

  return {
    ...state,
    graph: {
      ...state.graph,
      viewport: {
        ...state.graph.viewport,
        zoom: nextZoom,
      },
    },
  };
}
