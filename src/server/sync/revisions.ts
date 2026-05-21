import "server-only";

import { workflowGraphSchema } from "@/domain/workflows/schemas";
import type { WorkflowGraph } from "@/domain/workflows/types";
import type { Queryable } from "@/server/db/pool";

export type WorkflowSyncState = {
  workspaceId: string;
  name: string;
  schemaVersion: 1;
  currentVersion: number;
  currentGraph: WorkflowGraph;
};

export async function fetchWorkflowSyncState(
  db: Queryable,
  workflowId: string,
): Promise<WorkflowSyncState | null> {
  const result = await db.query<{
    workspace_id: string;
    name: string;
    schema_version: number;
    version: number;
    current_state_json: unknown;
  }>(
    `
      select workspace_id, name, schema_version, version, current_state_json
      from public.workflows
      where id = $1 and deleted_at is null
      for update
    `,
    [workflowId],
  );

  const row = result.rows[0];
  if (!row) return null;

  const graph = workflowGraphSchema.parse(row.current_state_json);

  return {
    workspaceId: row.workspace_id,
    name: row.name,
    schemaVersion: row.schema_version as 1,
    currentVersion: row.version,
    currentGraph: graph,
  };
}

export async function claimRevisions(
  db: Queryable,
  workflowId: string,
  count: number,
): Promise<number> {
  const result = await db.query<{ old_version: number }>(
    `
      update public.workflows
      set version = version + $2, updated_at = now()
      where id = $1
      returning version - $2 as old_version
    `,
    [workflowId, count],
  );

  return result.rows[0]!.old_version;
}

export async function updateWorkflowGraph(
  db: Queryable,
  workflowId: string,
  graph: WorkflowGraph,
): Promise<void> {
  await db.query(
    `
      update public.workflows
      set current_state_json = $2::jsonb, updated_at = now()
      where id = $1
    `,
    [workflowId, JSON.stringify(graph)],
  );
}
