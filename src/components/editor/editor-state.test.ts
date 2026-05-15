import { describe, expect, it } from "vitest";

import {
  deleteSelectedNode,
  moveNode,
  panViewport,
  selectNode,
  zoomViewport,
} from "./editor-state";
import type { WorkflowGraph } from "@/domain/workflows/types";

const graph: WorkflowGraph = {
  nodes: [
    {
      id: "trigger",
      type: "webhook_trigger",
      position: { x: 40, y: 80 },
      config: {},
    },
    {
      id: "log",
      type: "log",
      position: { x: 320, y: 80 },
      config: { label: "Write log" },
    },
  ],
  edges: [
    {
      id: "edge_1",
      sourceNodeId: "trigger",
      targetNodeId: "log",
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

describe("editor state", () => {
  it("selects a node without mutating graph state", () => {
    const state = selectNode({ graph, selectedNodeId: null }, "trigger");

    expect(state.selectedNodeId).toBe("trigger");
    expect(state.graph).toBe(graph);
  });

  it("moves one node in memory", () => {
    const state = moveNode(
      { graph, selectedNodeId: "trigger" },
      "log",
      { x: 420, y: 140 },
    );

    expect(state.graph.nodes).toEqual([
      expect.objectContaining({ id: "trigger", position: { x: 40, y: 80 } }),
      expect.objectContaining({ id: "log", position: { x: 420, y: 140 } }),
    ]);
    expect(graph.nodes[1]?.position).toEqual({ x: 320, y: 80 });
  });

  it("deletes the selected node and connected edges", () => {
    const state = deleteSelectedNode({ graph, selectedNodeId: "trigger" });

    expect(state.selectedNodeId).toBeNull();
    expect(state.graph.nodes).toEqual([
      expect.objectContaining({ id: "log" }),
    ]);
    expect(state.graph.edges).toEqual([]);
  });

  it("pans and zooms the viewport", () => {
    const panned = panViewport({ graph, selectedNodeId: null }, { x: 20, y: -10 });
    const zoomed = zoomViewport(panned, 1.5);

    expect(zoomed.graph.viewport).toEqual({ x: 20, y: -10, zoom: 1.5 });
  });
});
