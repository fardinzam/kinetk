import type { WorkflowGraph, WorkflowPosition } from "@/domain/workflows/types";

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
        (edge) =>
          edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId,
      ),
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
