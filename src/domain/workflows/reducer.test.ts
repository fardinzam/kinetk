import { describe, expect, it } from "vitest";

import { applyWorkflowEvent } from "./reducer";
import type { WorkflowEvent } from "./events";
import type { WorkflowState } from "./reducer";

const createdAt = "2026-05-14T20:00:00.000Z";

function baseState(): WorkflowState {
  return {
    name: "Untitled workflow",
    graph: {
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
          config: { label: "Before" },
        },
      ],
      edges: [
        {
          id: "edge_1",
          sourceNodeId: "trigger",
          sourceHandle: "success",
          targetNodeId: "log",
          targetHandle: "input",
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

function event<T extends WorkflowEvent>(event: T): T {
  return event;
}

describe("applyWorkflowEvent", () => {
  it("renames a workflow", () => {
    const state = applyWorkflowEvent(
      baseState(),
      event({
        clientEventId: "evt_1",
        type: "workflow_renamed",
        eventSchemaVersion: 1,
        payload: { name: "Production webhook" },
        createdAt,
      }),
    );

    expect(state.name).toBe("Production webhook");
  });

  it("adds, updates, and moves nodes", () => {
    const withNode = applyWorkflowEvent(
      baseState(),
      event({
        clientEventId: "evt_1",
        type: "node_added",
        eventSchemaVersion: 1,
        payload: {
          node: {
            id: "condition",
            type: "condition",
            position: { x: 480, y: 0 },
            config: {
              leftPath: "amount",
              operator: "greater_than",
              rightValue: 1000,
            },
          },
        },
        createdAt,
      }),
    );
    const updated = applyWorkflowEvent(
      withNode,
      event({
        clientEventId: "evt_2",
        type: "node_updated",
        eventSchemaVersion: 1,
        payload: {
          nodeId: "condition",
          config: {
            leftPath: "amount",
            operator: "less_than",
            rightValue: 5000,
          },
        },
        createdAt,
      }),
    );
    const moved = applyWorkflowEvent(
      updated,
      event({
        clientEventId: "evt_3",
        type: "node_moved",
        eventSchemaVersion: 1,
        payload: { nodeId: "condition", position: { x: 520, y: 80 } },
        createdAt,
      }),
    );

    expect(moved.graph.nodes).toContainEqual({
      id: "condition",
      type: "condition",
      position: { x: 520, y: 80 },
      config: { leftPath: "amount", operator: "less_than", rightValue: 5000 },
    });
  });

  it("adds and deletes edges", () => {
    const withEdge = applyWorkflowEvent(
      baseState(),
      event({
        clientEventId: "evt_1",
        type: "edge_added",
        eventSchemaVersion: 1,
        payload: {
          edge: {
            id: "edge_2",
            sourceNodeId: "log",
            targetNodeId: "trigger",
          },
        },
        createdAt,
      }),
    );
    const withoutEdge = applyWorkflowEvent(
      withEdge,
      event({
        clientEventId: "evt_2",
        type: "edge_deleted",
        eventSchemaVersion: 1,
        payload: { edgeId: "edge_2" },
        createdAt,
      }),
    );

    expect(withEdge.graph.edges.map((edgeItem) => edgeItem.id)).toContain(
      "edge_2",
    );
    expect(
      withoutEdge.graph.edges.map((edgeItem) => edgeItem.id),
    ).not.toContain("edge_2");
  });

  it("deletes nodes and connected edges", () => {
    const state = applyWorkflowEvent(
      baseState(),
      event({
        clientEventId: "evt_1",
        type: "node_deleted",
        eventSchemaVersion: 1,
        payload: { nodeId: "log" },
        createdAt,
      }),
    );

    expect(state.graph.nodes.map((node) => node.id)).not.toContain("log");
    expect(state.graph.edges).toEqual([]);
  });

  it("does not mutate the input state", () => {
    const original = baseState();
    const snapshot = structuredClone(original);

    applyWorkflowEvent(
      original,
      event({
        clientEventId: "evt_1",
        type: "node_moved",
        eventSchemaVersion: 1,
        payload: { nodeId: "log", position: { x: 999, y: 999 } },
        createdAt,
      }),
    );

    expect(original).toEqual(snapshot);
  });
});
