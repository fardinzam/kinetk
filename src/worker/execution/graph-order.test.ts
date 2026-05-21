import { describe, expect, it } from "vitest";

import type { WorkflowGraph } from "@/domain/workflows/types";

import { getNextNodeIds } from "./graph-order";

const graph: WorkflowGraph = {
  nodes: [
    {
      id: "condition",
      type: "condition",
      position: { x: 0, y: 0 },
      config: { leftPath: "current.value", operator: "exists" },
    },
    {
      id: "true_log",
      type: "log",
      position: { x: 200, y: 0 },
      config: { label: "true" },
    },
    {
      id: "false_log",
      type: "log",
      position: { x: 200, y: 100 },
      config: { label: "false" },
    },
    {
      id: "plain_log",
      type: "log",
      position: { x: 200, y: 200 },
      config: { label: "plain" },
    },
  ],
  edges: [
    {
      id: "edge_true",
      sourceNodeId: "condition",
      sourceHandle: "true",
      targetNodeId: "true_log",
    },
    {
      id: "edge_false",
      sourceNodeId: "condition",
      sourceHandle: "false",
      targetNodeId: "false_log",
    },
    {
      id: "edge_plain",
      sourceNodeId: "plain_log",
      targetNodeId: "true_log",
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

describe("getNextNodeIds", () => {
  it("follows only the matching condition branch", () => {
    expect(getNextNodeIds(graph, "condition", "true")).toEqual(["true_log"]);
    expect(getNextNodeIds(graph, "condition", "false")).toEqual(["false_log"]);
  });

  it("follows all non-branched outgoing edges when no branch is supplied", () => {
    expect(getNextNodeIds(graph, "plain_log")).toEqual(["true_log"]);
  });
});
