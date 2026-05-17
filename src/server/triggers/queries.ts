import "server-only";

import type { Queryable } from "@/server/db/pool";
import { getPool } from "@/server/db/pool";

export type TriggerRecord = {
  id: string;
  workflowId: string;
  workspaceId: string;
  status: "active" | "disabled";
  createdAt: Date;
  rotatedAt: Date | null;
  lastUsedAt: Date | null;
};

export type TriggerQueries = {
  userCanAccessWorkspace(userId: string, workspaceId: string): Promise<boolean>;
  createTrigger(input: {
    workflowId: string;
    workspaceId: string;
    tokenHash: string;
  }): Promise<TriggerRecord>;
  findTriggerByWorkflow(workflowId: string): Promise<TriggerRecord | null>;
  findTriggerById(triggerId: string): Promise<TriggerRecord | null>;
  findActiveByTokenHash(tokenHash: string): Promise<TriggerRecord | null>;
  updateTriggerHash(
    triggerId: string,
    tokenHash: string,
  ): Promise<TriggerRecord>;
  updateTriggerStatus(
    triggerId: string,
    status: "active" | "disabled",
  ): Promise<TriggerRecord>;
  updateLastUsed(triggerId: string): Promise<void>;
};

function mapRow(row: {
  id: string;
  workflow_id: string;
  workspace_id: string;
  status: string;
  created_at: Date;
  rotated_at: Date | null;
  last_used_at: Date | null;
}): TriggerRecord {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workspaceId: row.workspace_id,
    status: row.status as "active" | "disabled",
    createdAt: row.created_at,
    rotatedAt: row.rotated_at,
    lastUsedAt: row.last_used_at,
  };
}

const RETURNING = `returning id, workflow_id, workspace_id, status, created_at, rotated_at, last_used_at`;

export function createTriggerQueries(
  db: Queryable = getPool(),
): TriggerQueries {
  return {
    async userCanAccessWorkspace(userId, workspaceId) {
      const result = await db.query<{ exists: boolean }>(
        `select exists (select 1 from public.workspace_members where user_id = $1 and workspace_id = $2)`,
        [userId, workspaceId],
      );
      return result.rows[0]?.exists ?? false;
    },

    async createTrigger({ workflowId, workspaceId, tokenHash }) {
      const result = await db.query<{
        id: string;
        workflow_id: string;
        workspace_id: string;
        status: string;
        created_at: Date;
        rotated_at: Date | null;
        last_used_at: Date | null;
      }>(
        `insert into public.webhook_triggers (workflow_id, workspace_id, token_hash, status)
         values ($1, $2, $3, 'active') ${RETURNING}`,
        [workflowId, workspaceId, tokenHash],
      );
      return mapRow(result.rows[0]!);
    },

    async findTriggerByWorkflow(workflowId) {
      const result = await db.query<{
        id: string;
        workflow_id: string;
        workspace_id: string;
        status: string;
        created_at: Date;
        rotated_at: Date | null;
        last_used_at: Date | null;
      }>(
        `select id, workflow_id, workspace_id, status, created_at, rotated_at, last_used_at
         from public.webhook_triggers where workflow_id = $1 limit 1`,
        [workflowId],
      );
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },

    async findTriggerById(triggerId) {
      const result = await db.query<{
        id: string;
        workflow_id: string;
        workspace_id: string;
        status: string;
        created_at: Date;
        rotated_at: Date | null;
        last_used_at: Date | null;
      }>(
        `select id, workflow_id, workspace_id, status, created_at, rotated_at, last_used_at
         from public.webhook_triggers where id = $1 limit 1`,
        [triggerId],
      );
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },

    async findActiveByTokenHash(tokenHash) {
      const result = await db.query<{
        id: string;
        workflow_id: string;
        workspace_id: string;
        status: string;
        created_at: Date;
        rotated_at: Date | null;
        last_used_at: Date | null;
      }>(
        `select id, workflow_id, workspace_id, status, created_at, rotated_at, last_used_at
         from public.webhook_triggers where token_hash = $1 and status = 'active' limit 1`,
        [tokenHash],
      );
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },

    async updateTriggerHash(triggerId, tokenHash) {
      const result = await db.query<{
        id: string;
        workflow_id: string;
        workspace_id: string;
        status: string;
        created_at: Date;
        rotated_at: Date | null;
        last_used_at: Date | null;
      }>(
        `update public.webhook_triggers
         set token_hash = $2, rotated_at = now()
         where id = $1 ${RETURNING}`,
        [triggerId, tokenHash],
      );
      return mapRow(result.rows[0]!);
    },

    async updateTriggerStatus(triggerId, status) {
      const result = await db.query<{
        id: string;
        workflow_id: string;
        workspace_id: string;
        status: string;
        created_at: Date;
        rotated_at: Date | null;
        last_used_at: Date | null;
      }>(
        `update public.webhook_triggers set status = $2 where id = $1 ${RETURNING}`,
        [triggerId, status],
      );
      return mapRow(result.rows[0]!);
    },

    async updateLastUsed(triggerId) {
      await db.query(
        `update public.webhook_triggers set last_used_at = now() where id = $1`,
        [triggerId],
      );
    },
  };
}
