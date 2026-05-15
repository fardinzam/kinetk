import { describe, expect, it } from "vitest";

import {
  httpRequestNodeConfigSchema,
  nodeConfigSchema,
  workflowGraphSchema,
} from "./schemas";

describe("workflow schemas", () => {
  it("parses a serializable workflow graph", () => {
    const graph = workflowGraphSchema.parse({
      nodes: [
        {
          id: "node_trigger",
          type: "webhook_trigger",
          position: { x: 120, y: 180 },
          config: {},
        },
        {
          id: "node_log",
          type: "log",
          position: { x: 360, y: 180 },
          config: { label: "Audit event" },
        },
      ],
      edges: [
        {
          id: "edge_1",
          sourceNodeId: "node_trigger",
          sourceHandle: "success",
          targetNodeId: "node_log",
          targetHandle: "input",
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    });

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
  });

  it("rejects invalid node config for a node type", () => {
    expect(() =>
      nodeConfigSchema.parse({
        type: "condition",
        config: { leftPath: "amount", operator: "unsupported" },
      }),
    ).toThrow();
  });

  it("requires HTTP request secret headers to reference secret IDs", () => {
    expect(() =>
      httpRequestNodeConfigSchema.parse({
        method: "POST",
        url: "https://example.com/webhook",
        headers: {
          authorization: "Bearer plaintext-token",
        },
        bodyMode: "current_payload",
      }),
    ).toThrow();

    expect(
      httpRequestNodeConfigSchema.parse({
        method: "POST",
        url: "https://example.com/webhook",
        headers: {
          authorization: {
            secretId: "secret_123",
            injectAs: "Bearer",
          },
        },
        bodyMode: "current_payload",
      }),
    ).toMatchObject({
      headers: {
        authorization: {
          secretId: "secret_123",
        },
      },
    });
  });
});
