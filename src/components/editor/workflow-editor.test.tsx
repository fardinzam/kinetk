import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkflowEditor } from "./workflow-editor";
import type { WorkflowEvent } from "@/domain/workflows/events";
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
  it("shows validation errors without blocking edits", () => {
    render(
      <WorkflowEditor
        initialGraph={{
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        }}
      />,
    );

    expect(screen.getByText("invalid_trigger_count")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add log" }));

    expect(
      screen.getByRole("button", { name: "log log_1" }),
    ).toBeInTheDocument();
    expect(screen.getByText("invalid_trigger_count")).toBeInTheDocument();
  });

  it("builds a valid trigger to transform to log workflow", () => {
    render(
      <WorkflowEditor
        initialGraph={{
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add webhook trigger" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add transform json" }));
    fireEvent.click(screen.getByRole("button", { name: "Add log" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Connect from webhook_trigger_1" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Connect to transform_json_1" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Connect from transform_json_1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Connect to log_1" }));

    expect(
      screen.getByLabelText("edge webhook_trigger_1 to transform_json_1"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("edge transform_json_1 to log_1"),
    ).toBeInTheDocument();
    expect(screen.getByText("Graph is executable.")).toBeInTheDocument();
  });

  it("edits selected node config and emits a node_updated event", () => {
    const events: WorkflowEvent[] = [];
    render(
      <WorkflowEditor
        initialGraph={seededGraph}
        onLocalEvent={(event) => events.push(event)}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "log log" }), {
      pointerId: 1,
      clientX: 360,
      clientY: 72,
    });
    fireEvent.change(screen.getByLabelText("Log label"), {
      target: { value: "Updated audit log" },
    });

    expect(screen.getByDisplayValue("Updated audit log")).toBeInTheDocument();
    expect(events.at(-1)).toMatchObject({
      type: "node_updated",
      payload: {
        nodeId: "log",
        config: { label: "Updated audit log" },
      },
    });
  });

  it("adds nodes from the palette and prevents duplicate webhook triggers", () => {
    render(<WorkflowEditor initialGraph={seededGraph} />);

    fireEvent.click(screen.getByRole("button", { name: "Add transform json" }));
    fireEvent.click(screen.getByRole("button", { name: "Add condition" }));
    fireEvent.click(screen.getByRole("button", { name: "Add http request" }));
    fireEvent.click(screen.getByRole("button", { name: "Add log" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Add webhook trigger" }),
    );

    expect(
      screen.getByRole("button", { name: "transform json transform_json_1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "condition condition_1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "http request http_request_1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "log log_1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add webhook trigger" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "webhook trigger trigger" }),
    ).toBeInTheDocument();
  });

  it("renders a seeded graph with nodes and edges", () => {
    render(<WorkflowEditor initialGraph={seededGraph} />);

    expect(
      screen.getByRole("button", { name: "webhook trigger trigger" }),
    ).toBeInTheDocument();
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

    expect(
      screen.queryByRole("button", { name: "log log" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("edge trigger to log"),
    ).not.toBeInTheDocument();
  });

  it("keeps node drag visual-only until pointerup commits the move", () => {
    const events: WorkflowEvent[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    render(
      <WorkflowEditor
        initialGraph={seededGraph}
        onLocalEvent={(event) => events.push(event)}
      />,
    );

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

    expect(screen.getByTestId("node-log")).toHaveAttribute(
      "data-position",
      "360,72",
    );
    expect(screen.getByTestId("node-log")).toHaveStyle(
      "transform: translate3d(60px, 48px, 0)",
    );
    expect(events).toHaveLength(0);

    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(screen.getByTestId("node-log")).toHaveAttribute(
      "data-position",
      "420,120",
    );
    expect(events.at(-1)).toMatchObject({
      type: "node_moved",
      payload: {
        nodeId: "log",
        position: { x: 420, y: 120 },
      },
    });

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("connects nodes with handles and deletes edges", () => {
    render(<WorkflowEditor initialGraph={{ ...seededGraph, edges: [] }} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Connect from trigger" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Connect to log" }));

    expect(screen.getByLabelText("edge trigger to log")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Delete edge trigger to log" }),
    );

    expect(
      screen.queryByLabelText("edge trigger to log"),
    ).not.toBeInTheDocument();
  });

  it("emits condition branch handles when connecting condition nodes", () => {
    const events: WorkflowEvent[] = [];
    render(
      <WorkflowEditor
        initialGraph={{
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        }}
        onLocalEvent={(event) => events.push(event)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add condition" }));
    fireEvent.click(screen.getByRole("button", { name: "Add log" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Connect true from condition_1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Connect to log_1" }));

    expect(events.at(-1)).toMatchObject({
      type: "edge_added",
      payload: {
        edge: {
          sourceNodeId: "condition_1",
          sourceHandle: "true",
          targetNodeId: "log_1",
        },
      },
    });
  });
});
