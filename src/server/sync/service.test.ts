import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkflowEvent } from "@/domain/workflows/events";
import type { WorkflowGraph } from "@/domain/workflows/types";

const {
  claimRevisions,
  existingRevisions,
  fetchWorkflowSyncState,
  insertWorkflowEvents,
  updateWorkflowGraph,
  userCanAccessWorkspace,
} = vi.hoisted(() => ({
  claimRevisions: vi.fn(),
  existingRevisions: new Map<string, number>(),
  fetchWorkflowSyncState: vi.fn(),
  insertWorkflowEvents: vi.fn(),
  updateWorkflowGraph: vi.fn(),
  userCanAccessWorkspace: vi.fn(),
}));

vi.mock("@/server/db/pool", () => ({
  withTransaction: vi.fn(async (fn: (db: unknown) => Promise<unknown>) =>
    fn({ __transaction: true }),
  ),
}));

vi.mock("@/server/workflows/queries", () => ({
  createWorkflowQueries: () => ({
    userCanAccessWorkspace,
  }),
}));

vi.mock("./events", () => ({
  findExistingRevisions: vi.fn(async () => existingRevisions),
  insertWorkflowEvents,
}));

vi.mock("./revisions", () => ({
  claimRevisions,
  fetchWorkflowSyncState,
  updateWorkflowGraph,
}));

import { syncWorkflowEvents, SyncRevisionConflictError } from "./service";

const emptyGraph: WorkflowGraph = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

const event: WorkflowEvent = {
  clientEventId: "event-1",
  type: "workflow_renamed",
  eventSchemaVersion: 1,
  payload: { name: "Renamed" },
  createdAt: "2026-05-20T00:00:00.000Z",
};

describe("syncWorkflowEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existingRevisions.clear();
    fetchWorkflowSyncState.mockResolvedValue({
      workspaceId: "workspace-1",
      name: "Workflow",
      schemaVersion: 1,
      currentVersion: 7,
      currentGraph: emptyGraph,
    });
    userCanAccessWorkspace.mockResolvedValue(true);
  });

  it("rejects stale clients before appending events or updating the snapshot", async () => {
    await expect(
      syncWorkflowEvents({
        userId: "user-1",
        workflowId: "workflow-1",
        baseServerRevision: 6,
        events: [event],
      }),
    ).rejects.toBeInstanceOf(SyncRevisionConflictError);

    expect(claimRevisions).not.toHaveBeenCalled();
    expect(insertWorkflowEvents).not.toHaveBeenCalled();
    expect(updateWorkflowGraph).not.toHaveBeenCalled();
  });
});
