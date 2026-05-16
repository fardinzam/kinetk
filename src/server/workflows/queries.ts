import type { WorkflowGraph } from "@/domain/workflows/types";
import type { Queryable } from "@/server/db/pool";
import { getPool } from "@/server/db/pool";

export type CreateWorkflowRecord = {
  workspaceId: string;
  name: string;
  graph: WorkflowGraph;
  schemaVersion: 1;
};

export type WorkflowSummary = {
  id: string;
  workspaceId: string;
  name: string;
  schemaVersion: 1;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowRecord = WorkflowSummary & { graph: WorkflowGraph };

export type WorkflowQueries = {
  userCanAccessWorkspace(userId: string, workspaceId: string): Promise<boolean>;
  createWorkflow(input: CreateWorkflowRecord): Promise<WorkflowSummary>;
  listWorkflowsForWorkspace(workspaceId: string): Promise<WorkflowSummary[]>;
  findWorkflowById(workflowId: string): Promise<WorkflowSummary | null>;
  findWorkflowWithGraphById(workflowId: string): Promise<WorkflowRecord | null>;
};

function mapWorkflowRow(row: {
  id: string;
  workspace_id: string;
  name: string;
  schema_version: number;
  version: number;
  created_at: Date;
  updated_at: Date;
}): WorkflowSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    schemaVersion: row.schema_version as 1,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWorkflowQueries(db: Queryable = getPool()): WorkflowQueries {
  return {
    async userCanAccessWorkspace(userId, workspaceId) {
      const result = await db.query<{ exists: boolean }>(
        `
          select exists (
            select 1
            from public.workspace_members
            where user_id = $1 and workspace_id = $2
          )
        `,
        [userId, workspaceId],
      );

      return result.rows[0]?.exists ?? false;
    },
    async createWorkflow(input) {
      const result = await db.query<{
        id: string;
        workspace_id: string;
        name: string;
        schema_version: number;
        version: number;
        created_at: Date;
        updated_at: Date;
      }>(
        `
          insert into public.workflows (
            workspace_id,
            name,
            current_state_json,
            schema_version
          )
          values ($1, $2, $3::jsonb, $4)
          returning id, workspace_id, name, schema_version, version, created_at, updated_at
        `,
        [
          input.workspaceId,
          input.name,
          JSON.stringify(input.graph),
          input.schemaVersion,
        ],
      );
      const row = result.rows[0];

      if (!row) {
        throw new Error("Workflow creation failed");
      }

      return mapWorkflowRow(row);
    },
    async listWorkflowsForWorkspace(workspaceId) {
      const result = await db.query<{
        id: string;
        workspace_id: string;
        name: string;
        schema_version: number;
        version: number;
        created_at: Date;
        updated_at: Date;
      }>(
        `
          select id, workspace_id, name, schema_version, version, created_at, updated_at
          from public.workflows
          where workspace_id = $1 and deleted_at is null
          order by updated_at desc, created_at desc
        `,
        [workspaceId],
      );

      return result.rows.map(mapWorkflowRow);
    },
    async findWorkflowById(workflowId) {
      const result = await db.query<{
        id: string;
        workspace_id: string;
        name: string;
        schema_version: number;
        version: number;
        created_at: Date;
        updated_at: Date;
      }>(
        `
          select id, workspace_id, name, schema_version, version, created_at, updated_at
          from public.workflows
          where id = $1 and deleted_at is null
          limit 1
        `,
        [workflowId],
      );
      const row = result.rows[0];

      return row ? mapWorkflowRow(row) : null;
    },
    async findWorkflowWithGraphById(workflowId) {
      const result = await db.query<{
        id: string;
        workspace_id: string;
        name: string;
        schema_version: number;
        version: number;
        created_at: Date;
        updated_at: Date;
        current_state_json: WorkflowGraph;
      }>(
        `
          select id, workspace_id, name, schema_version, version,
                 created_at, updated_at, current_state_json
          from public.workflows
          where id = $1 and deleted_at is null
          limit 1
        `,
        [workflowId],
      );
      const row = result.rows[0];
      if (!row) return null;

      return { ...mapWorkflowRow(row), graph: row.current_state_json };
    },
  };
}
