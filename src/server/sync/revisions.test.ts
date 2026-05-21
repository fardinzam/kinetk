import { describe, expect, it } from "vitest";
import type { QueryResult, QueryResultRow } from "pg";

import type { Queryable } from "@/server/db/pool";

import { fetchWorkflowSyncState } from "./revisions";

describe("fetchWorkflowSyncState", () => {
  it("locks the workflow row before returning the sync snapshot", async () => {
    let queryText = "";
    let queryValues: unknown[] | undefined;
    const db: Queryable = {
      async query<T extends QueryResultRow>(text: string, values?: unknown[]) {
        queryText = text;
        queryValues = values;
        const result: QueryResult<T> = {
          command: "SELECT",
          rowCount: 1,
          oid: 0,
          fields: [],
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
            } as unknown as T,
          ],
        };
        return result;
      },
    };

    await fetchWorkflowSyncState(db, "workflow-1");

    expect(queryText).toMatch(/for\s+update/i);
    expect(queryValues).toEqual(["workflow-1"]);
  });
});
