import "server-only";

import type { Queryable } from "@/server/db/pool";
import { getPool } from "@/server/db/pool";

export type RunSummary = {
  id: string;
  workflowId: string;
  workspaceId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  stepCount: number;
  errorSummary: string | null;
  queuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export type StepRunRecord = {
  id: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  inputJson: unknown;
  outputJson: unknown;
  errorJson: unknown;
  attempt: number;
  durationMs: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export type RunQueries = {
  userCanAccessWorkspace(userId: string, workspaceId: string): Promise<boolean>;
  findWorkflowWorkspace(workflowId: string): Promise<string | null>;
  findRunWorkspace(runId: string): Promise<string | null>;
  listRunsForWorkflow(
    workflowId: string,
    workspaceId: string,
    limit: number,
    before?: Date,
  ): Promise<RunSummary[]>;
  findRunById(runId: string, workspaceId: string): Promise<RunSummary | null>;
  findStepsByRunId(
    runId: string,
    workspaceId: string,
  ): Promise<StepRunRecord[]>;
};

function mapRun(row: {
  id: string;
  workflow_id: string;
  workspace_id: string;
  status: string;
  step_count: number;
  error_summary: string | null;
  queued_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
}): RunSummary {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workspaceId: row.workspace_id,
    status: row.status as RunSummary["status"],
    stepCount: row.step_count,
    errorSummary: row.error_summary,
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function mapStep(row: {
  id: string;
  run_id: string;
  node_id: string;
  node_type: string;
  status: string;
  input_json: unknown;
  output_json: unknown;
  error_json: unknown;
  attempt: number;
  duration_ms: number | null;
  started_at: Date | null;
  finished_at: Date | null;
}): StepRunRecord {
  return {
    id: row.id,
    runId: row.run_id,
    nodeId: row.node_id,
    nodeType: row.node_type,
    status: row.status as StepRunRecord["status"],
    inputJson: row.input_json,
    outputJson: row.output_json,
    errorJson: row.error_json,
    attempt: row.attempt,
    durationMs: row.duration_ms,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export function createRunQueries(db: Queryable = getPool()): RunQueries {
  return {
    async userCanAccessWorkspace(userId, workspaceId) {
      const result = await db.query<{ exists: boolean }>(
        `select exists (select 1 from public.workspace_members where user_id = $1 and workspace_id = $2)`,
        [userId, workspaceId],
      );
      return result.rows[0]?.exists ?? false;
    },

    async findWorkflowWorkspace(workflowId) {
      const result = await db.query<{ workspace_id: string }>(
        `select workspace_id from public.workflows where id = $1 and deleted_at is null limit 1`,
        [workflowId],
      );
      return result.rows[0]?.workspace_id ?? null;
    },

    async findRunWorkspace(runId) {
      const result = await db.query<{ workspace_id: string }>(
        `select workspace_id from public.workflow_runs where id = $1 limit 1`,
        [runId],
      );
      return result.rows[0]?.workspace_id ?? null;
    },

    async listRunsForWorkflow(workflowId, workspaceId, limit, before) {
      const result = await db.query<{
        id: string;
        workflow_id: string;
        workspace_id: string;
        status: string;
        step_count: number;
        error_summary: string | null;
        queued_at: Date;
        started_at: Date | null;
        finished_at: Date | null;
      }>(
        before
          ? `select id, workflow_id, workspace_id, status, step_count, error_summary,
                   queued_at, started_at, finished_at
             from public.workflow_runs
             where workspace_id = $1 and workflow_id = $2 and queued_at < $3
             order by queued_at desc limit $4`
          : `select id, workflow_id, workspace_id, status, step_count, error_summary,
                   queued_at, started_at, finished_at
             from public.workflow_runs
             where workspace_id = $1 and workflow_id = $2
             order by queued_at desc limit $3`,
        before
          ? [workspaceId, workflowId, before, limit]
          : [workspaceId, workflowId, limit],
      );
      return result.rows.map(mapRun);
    },

    async findRunById(runId, workspaceId) {
      const result = await db.query<{
        id: string;
        workflow_id: string;
        workspace_id: string;
        status: string;
        step_count: number;
        error_summary: string | null;
        queued_at: Date;
        started_at: Date | null;
        finished_at: Date | null;
      }>(
        `select id, workflow_id, workspace_id, status, step_count, error_summary,
                queued_at, started_at, finished_at
         from public.workflow_runs where id = $1 and workspace_id = $2 limit 1`,
        [runId, workspaceId],
      );
      return result.rows[0] ? mapRun(result.rows[0]) : null;
    },

    async findStepsByRunId(runId, workspaceId) {
      const result = await db.query<{
        id: string;
        run_id: string;
        node_id: string;
        node_type: string;
        status: string;
        input_json: unknown;
        output_json: unknown;
        error_json: unknown;
        attempt: number;
        duration_ms: number | null;
        started_at: Date | null;
        finished_at: Date | null;
      }>(
        `select id, run_id, node_id, node_type, status,
                input_json, output_json, error_json,
                attempt, duration_ms, started_at, finished_at
         from public.workflow_step_runs
         where run_id = $1 and workspace_id = $2
         order by started_at asc nulls last`,
        [runId, workspaceId],
      );
      return result.rows.map(mapStep);
    },
  };
}
