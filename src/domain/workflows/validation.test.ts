import { describe, expect, it } from "vitest";

import { validateExecutableGraph } from "./validation";
import type { WorkflowGraph } from "./types";

function validGraph(): WorkflowGraph {
  return {
    nodes: [
      {
        id: "trigger",
        type: "webhook_trigger",
        position: { x: 0, y: 0 },
        config: {},
      },
      {
        id: "log",
        type: "log",
        position: { x: 240, y: 0 },
        config: {},
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
}

function codesFor(graph: unknown) {
  return validateExecutableGraph(graph).errors.map((error) => error.code);
}

describe("validateExecutableGraph", () => {
  it("accepts a valid graph", () => {
    expect(validateExecutableGraph(validGraph())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("requires exactly one webhook trigger", () => {
    expect(
      codesFor({
        ...validGraph(),
        nodes: validGraph().nodes.filter(
          (node) => node.type !== "webhook_trigger",
        ),
      }),
    ).toContain("invalid_trigger_count");

    expect(
      codesFor({
        ...validGraph(),
        nodes: [
          ...validGraph().nodes,
          {
            id: "trigger_2",
            type: "webhook_trigger",
            position: { x: 480, y: 0 },
            config: {},
          },
        ],
      }),
    ).toContain("invalid_trigger_count");
  });

  it("rejects duplicate node IDs", () => {
    const graph = validGraph();

    expect(
      codesFor({
        ...graph,
        nodes: [...graph.nodes, { ...graph.nodes[1] }],
      }),
    ).toContain("duplicate_node_id");
  });

  it("rejects duplicate edge IDs", () => {
    const graph = validGraph();

    expect(
      codesFor({
        ...graph,
        edges: [...graph.edges, { ...graph.edges[0] }],
      }),
    ).toContain("duplicate_edge_id");
  });

  it("rejects edges with missing source or target nodes", () => {
    expect(
      codesFor({
        ...validGraph(),
        edges: [
          {
            id: "edge_missing_source",
            sourceNodeId: "missing",
            targetNodeId: "log",
          },
          {
            id: "edge_missing_target",
            sourceNodeId: "trigger",
            targetNodeId: "missing",
          },
        ],
      }),
    ).toEqual(
      expect.arrayContaining(["edge_missing_source", "edge_missing_target"]),
    );
  });

  it("rejects unsupported node types", () => {
    expect(
      codesFor({
        ...validGraph(),
        nodes: [
          ...validGraph().nodes,
          {
            id: "unsupported",
            type: "email",
            position: { x: 480, y: 0 },
            config: {},
          },
        ],
      }),
    ).toContain("unsupported_node_type");
  });

  it("rejects cycles", () => {
    expect(
      codesFor({
        ...validGraph(),
        edges: [
          ...validGraph().edges,
          {
            id: "edge_back",
            sourceNodeId: "log",
            targetNodeId: "trigger",
          },
        ],
      }),
    ).toContain("cycle_detected");
  });

  it("rejects non-trigger nodes unreachable from the trigger", () => {
    expect(
      codesFor({
        ...validGraph(),
        nodes: [
          ...validGraph().nodes,
          {
            id: "orphan",
            type: "log",
            position: { x: 480, y: 0 },
            config: {},
          },
        ],
      }),
    ).toContain("unreachable_node");
  });
});
