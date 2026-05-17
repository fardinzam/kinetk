import { describe, expect, it } from "vitest";

import {
  addNode,
  connectNodes,
  deleteSelectedNode,
  deleteEdge,
  moveNode,
  panViewport,
  selectNode,
  updateSelectedNodeConfig,
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
  it("adds MVP node types with default config", () => {
    const state = addNode(
      {
        graph: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
        selectedNodeId: null,
      },
      "transform_json",
    );

    expect(state.selectedNodeId).toBe("transform_json_1");
    expect(state.graph.nodes).toEqual([
      expect.objectContaining({
        id: "transform_json_1",
        type: "transform_json",
        config: { mappings: [] },
      }),
    ]);
  });

  it("does not add a second webhook trigger", () => {
    const state = addNode({ graph, selectedNodeId: null }, "webhook_trigger");

    expect(
      state.graph.nodes.filter((node) => node.type === "webhook_trigger"),
    ).toHaveLength(1);
    expect(state.selectedNodeId).toBeNull();
  });

  it("selects a node without mutating graph state", () => {
    const state = selectNode({ graph, selectedNodeId: null }, "trigger");

    expect(state.selectedNodeId).toBe("trigger");
    expect(state.graph).toBe(graph);
  });

  it("moves one node in memory", () => {
    const state = moveNode({ graph, selectedNodeId: "trigger" }, "log", {
      x: 420,
      y: 140,
    });

    expect(state.graph.nodes).toEqual([
      expect.objectContaining({ id: "trigger", position: { x: 40, y: 80 } }),
      expect.objectContaining({ id: "log", position: { x: 420, y: 140 } }),
    ]);
    expect(graph.nodes[1]?.position).toEqual({ x: 320, y: 80 });
  });

  it("deletes the selected node and connected edges", () => {
    const state = deleteSelectedNode({ graph, selectedNodeId: "trigger" });

    expect(state.selectedNodeId).toBeNull();
    expect(state.graph.nodes).toEqual([expect.objectContaining({ id: "log" })]);
    expect(state.graph.edges).toEqual([]);
  });

  it("connects nodes and deletes edges", () => {
    const connected = connectNodes(
      {
        graph: { ...graph, edges: [] },
        selectedNodeId: null,
      },
      "trigger",
      "log",
    );

    expect(connected.graph.edges).toEqual([
      {
        id: "edge_trigger_log_1",
        sourceNodeId: "trigger",
        targetNodeId: "log",
      },
    ]);

    const withoutEdge = deleteEdge(connected, "edge_trigger_log_1");

    expect(withoutEdge.graph.edges).toEqual([]);
  });

  it("updates selected node config", () => {
    const state = updateSelectedNodeConfig(
      { graph, selectedNodeId: "log" },
      { label: "Updated log" },
    );

    expect(state.graph.nodes.find((node) => node.id === "log")).toMatchObject({
      config: { label: "Updated log" },
    });
  });

  it("pans and zooms the viewport", () => {
    const panned = panViewport(
      { graph, selectedNodeId: null },
      { x: 20, y: -10 },
    );
    const zoomed = zoomViewport(panned, 1.5);

    expect(zoomed.graph.viewport).toEqual({ x: 20, y: -10, zoom: 1.5 });
  });
});
