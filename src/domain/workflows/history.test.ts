import { describe, expect, it } from "vitest";

import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from "./history";
import type { WorkflowGraph } from "./types";

function makeGraph(id: string): WorkflowGraph {
  return {
    nodes: [
      { id, type: "log", position: { x: 0, y: 0 }, config: { label: id } },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

const graphA = makeGraph("a");
const graphB = makeGraph("b");
const graphC = makeGraph("c");

describe("createHistory", () => {
  it("returns empty history", () => {
    const history = createHistory();
    expect(history.past).toEqual([]);
    expect(history.future).toEqual([]);
  });
});

describe("pushHistory", () => {
  it("adds graph to past and clears future", () => {
    const withFuture = { past: [graphA], future: [graphC] };
    const result = pushHistory(withFuture, graphB);
    expect(result.past).toEqual([graphA, graphB]);
    expect(result.future).toEqual([]);
  });
});

describe("canUndo / canRedo", () => {
  it("returns false for empty stacks", () => {
    const history = createHistory();
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it("returns true when stacks have entries", () => {
    const history = { past: [graphA], future: [graphB] };
    expect(canUndo(history)).toBe(true);
    expect(canRedo(history)).toBe(true);
  });
});

describe("undoHistory", () => {
  it("returns null when past is empty", () => {
    expect(undoHistory(createHistory(), graphA)).toBeNull();
  });

  it("pops last past entry and moves current to future", () => {
    const history = { past: [graphA, graphB], future: [] };
    const result = undoHistory(history, graphC);
    expect(result).not.toBeNull();
    expect(result!.graph).toEqual(graphB);
    expect(result!.history.past).toEqual([graphA]);
    expect(result!.history.future).toEqual([graphC]);
  });

  it("prepends current to existing future", () => {
    const history = { past: [graphA], future: [graphC] };
    const result = undoHistory(history, graphB);
    expect(result!.history.future).toEqual([graphB, graphC]);
  });
});

describe("redoHistory", () => {
  it("returns null when future is empty", () => {
    expect(redoHistory(createHistory(), graphA)).toBeNull();
  });

  it("pops first future entry and moves current to past", () => {
    const history = { past: [], future: [graphB, graphC] };
    const result = redoHistory(history, graphA);
    expect(result).not.toBeNull();
    expect(result!.graph).toEqual(graphB);
    expect(result!.history.past).toEqual([graphA]);
    expect(result!.history.future).toEqual([graphC]);
  });
});

describe("full undo/redo flow", () => {
  it("add → undo → redo restores original graph", () => {
    let history = createHistory();
    history = pushHistory(history, graphA);
    const afterUndo = undoHistory(history, graphB);
    expect(afterUndo!.graph).toEqual(graphA);
    const afterRedo = redoHistory(afterUndo!.history, afterUndo!.graph);
    expect(afterRedo!.graph).toEqual(graphB);
  });

  it("new edit after undo clears redo stack", () => {
    let history = createHistory();
    history = pushHistory(history, graphA);
    const afterUndo = undoHistory(history, graphB);
    expect(canRedo(afterUndo!.history)).toBe(true);
    const afterNewEdit = pushHistory(afterUndo!.history, afterUndo!.graph);
    expect(canRedo(afterNewEdit)).toBe(false);
  });
});

describe("immutability", () => {
  it("pushHistory does not mutate input", () => {
    const history = { past: [graphA], future: [] };
    const snapshot = structuredClone(history);
    pushHistory(history, graphB);
    expect(history).toEqual(snapshot);
  });

  it("undoHistory does not mutate input", () => {
    const history = { past: [graphA], future: [] };
    const snapshot = structuredClone(history);
    undoHistory(history, graphB);
    expect(history).toEqual(snapshot);
  });

  it("redoHistory does not mutate input", () => {
    const history = { past: [], future: [graphB] };
    const snapshot = structuredClone(history);
    redoHistory(history, graphA);
    expect(history).toEqual(snapshot);
  });
});
