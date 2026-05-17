import { describe, expect, it } from "vitest";

import { createRunContext, setNodeOutput } from "./run-context";
import { resolvePath } from "./path-resolver";

const payload = { amount: 100, user: { id: "u_1", name: "Alice" } };

describe("createRunContext", () => {
  it("sets initial and current payload to the same value", () => {
    const ctx = createRunContext(payload);
    expect(ctx.initialPayload).toBe(payload);
    expect(ctx.currentPayload).toBe(payload);
    expect(ctx.nodeOutputs.size).toBe(0);
  });
});

describe("setNodeOutput", () => {
  it("updates currentPayload and adds to nodeOutputs", () => {
    const ctx = createRunContext(payload);
    const output = { result: "ok" };
    const next = setNodeOutput(ctx, "node_1", output);

    expect(next.currentPayload).toBe(output);
    expect(next.nodeOutputs.get("node_1")).toBe(output);
    expect(next.initialPayload).toBe(payload);
  });

  it("does not mutate the original context", () => {
    const ctx = createRunContext(payload);
    setNodeOutput(ctx, "node_1", { result: "ok" });
    expect(ctx.nodeOutputs.size).toBe(0);
  });
});

describe("resolvePath", () => {
  it("resolves 'current' to the full current payload", () => {
    const ctx = createRunContext(payload);
    expect(resolvePath(ctx, "current")).toBe(payload);
  });

  it("resolves nested current path", () => {
    const ctx = createRunContext(payload);
    expect(resolvePath(ctx, "current.user.name")).toBe("Alice");
  });

  it("resolves 'initial' independently from current", () => {
    const ctx = setNodeOutput(createRunContext(payload), "n", { other: true });
    expect(resolvePath(ctx, "initial.amount")).toBe(100);
    expect(resolvePath(ctx, "current.other")).toBe(true);
  });

  it("resolves a node output", () => {
    const ctx = setNodeOutput(createRunContext(payload), "node_1", {
      score: 42,
    });
    expect(resolvePath(ctx, "nodes.node_1.score")).toBe(42);
  });

  it("returns context_path_not_found for a missing node", () => {
    const ctx = createRunContext(payload);
    const result = resolvePath(ctx, "nodes.missing");
    expect(result).toMatchObject({ code: "context_path_not_found" });
  });

  it("returns context_path_not_found for a missing nested field", () => {
    const ctx = createRunContext(payload);
    const result = resolvePath(ctx, "current.nonexistent.deep");
    expect(result).toMatchObject({ code: "context_path_not_found" });
  });

  it("returns context_path_not_found for unknown root", () => {
    const ctx = createRunContext(payload);
    const result = resolvePath(ctx, "unknown.field");
    expect(result).toMatchObject({ code: "context_path_not_found" });
  });
});
