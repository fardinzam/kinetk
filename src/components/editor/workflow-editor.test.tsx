import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkflowEditor } from "./workflow-editor";
import type { WorkflowGraph } from "@/domain/workflows/types";

const seededGraph: WorkflowGraph = {
  nodes: [
    {
      id: "trigger",
      type: "webhook_trigger",
      position: { x: 48, y: 72 },
      config: {},
    },
    {
      id: "log",
      type: "log",
      position: { x: 360, y: 72 },
      config: { label: "Audit log" },
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

describe("WorkflowEditor", () => {
  it("renders a seeded graph with nodes and edges", () => {
    render(<WorkflowEditor initialGraph={seededGraph} />);

    expect(screen.getByRole("button", { name: "webhook trigger trigger" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "log log" })).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow edges")).toBeInTheDocument();
  });

  it("selects, drags, and deletes a node in memory", () => {
    render(<WorkflowEditor initialGraph={seededGraph} />);

    const logNode = screen.getByRole("button", { name: "log log" });
    fireEvent.pointerDown(logNode, {
      pointerId: 1,
      clientX: 360,
      clientY: 72,
    });
    fireEvent.pointerMove(window, {
      pointerId: 1,
      clientX: 420,
      clientY: 120,
    });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(screen.getByTestId("node-log")).toHaveAttribute(
      "data-position",
      "420,120",
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));

    expect(screen.queryByRole("button", { name: "log log" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("edge trigger to log")).not.toBeInTheDocument();
  });
});
