import { describe, expect, it, vi } from "vitest";

import { fetchWorkflowSyncState } from "./revisions";

describe("fetchWorkflowSyncState", () => {
  it("locks the workflow row before returning the sync snapshot", async () => {
    const db = {
      query: vi.fn(async () => ({
        rows: [
          {
            workspace_id: "workspace-1",
            name: "Workflow",
            schema_version: 1,
            version: 3,
            current_state_json: {
              nodes: [],
              edges: [],
              viewport: { x: 0, y: 0, zoom: 1 },
            },
          },
        ],
      })),
    };

    await fetchWorkflowSyncState(db, "workflow-1");

    expect(db.query).toHaveBeenCalledWith(
      expect.stringMatching(/for\s+update/i),
      ["workflow-1"],
    );
  });
});
