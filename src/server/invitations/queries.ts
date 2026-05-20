import "server-only";

import type { Queryable } from "@/server/db/pool";
import { getPool } from "@/server/db/pool";

export type InvitationStatus = "pending" | "accepted" | "revoked";

export type InvitationRecord = {
  id: string;
  workspaceId: string;
  invitedByUserId: string;
  email: string;
  token: string;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
};

export type InvitationWithWorkspace = InvitationRecord & {
  workspaceName: string;
};

export type InvitationQueries = {
  insertInvitation(input: {
    workspaceId: string;
    invitedByUserId: string;
    email: string;
    token: string;
  }): Promise<InvitationRecord>;
  findInvitationByToken(token: string): Promise<InvitationWithWorkspace | null>;
  findInvitationsByWorkspace(workspaceId: string): Promise<InvitationRecord[]>;
  findPendingInvitationByWorkspaceAndEmail(
    workspaceId: string,
    email: string,
  ): Promise<InvitationRecord | null>;
  updateInvitationStatus(
    invitationId: string,
    status: InvitationStatus,
  ): Promise<void>;
  updateInvitationStatusForWorkspace(
    invitationId: string,
    workspaceId: string,
    status: InvitationStatus,
  ): Promise<boolean>;
};

function rowToRecord(row: {
  id: string;
  workspace_id: string;
  invited_by_user_id: string;
  email: string;
  token: string;
  status: InvitationStatus;
  expires_at: Date;
  created_at: Date;
}): InvitationRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    invitedByUserId: row.invited_by_user_id,
    email: row.email,
    token: row.token,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function createInvitationQueries(
  db: Queryable = getPool(),
): InvitationQueries {
  return {
    async insertInvitation(input) {
      const result = await db.query<{
        id: string;
        workspace_id: string;
        invited_by_user_id: string;
        email: string;
        token: string;
        status: InvitationStatus;
        expires_at: Date;
        created_at: Date;
      }>(
        `
          INSERT INTO public.workspace_invitations
            (workspace_id, invited_by_user_id, email, token)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        [input.workspaceId, input.invitedByUserId, input.email, input.token],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Invitation insert failed");
      return rowToRecord(row);
    },

    async findInvitationByToken(token) {
      const result = await db.query<{
        id: string;
        workspace_id: string;
        invited_by_user_id: string;
        email: string;
        token: string;
        status: InvitationStatus;
        expires_at: Date;
        created_at: Date;
        workspace_name: string;
      }>(
        `
          SELECT wi.*, w.name AS workspace_name
          FROM public.workspace_invitations wi
          JOIN public.workspaces w ON w.id = wi.workspace_id
          WHERE wi.token = $1
        `,
        [token],
      );
      const row = result.rows[0];
      if (!row) return null;
      return { ...rowToRecord(row), workspaceName: row.workspace_name };
    },

    async findInvitationsByWorkspace(workspaceId) {
      const result = await db.query<{
        id: string;
        workspace_id: string;
        invited_by_user_id: string;
        email: string;
        token: string;
        status: InvitationStatus;
        expires_at: Date;
        created_at: Date;
      }>(
        `
          SELECT * FROM public.workspace_invitations
          WHERE workspace_id = $1
          ORDER BY created_at DESC
        `,
        [workspaceId],
      );
      return result.rows.map(rowToRecord);
    },

    async findPendingInvitationByWorkspaceAndEmail(workspaceId, email) {
      const result = await db.query<{
        id: string;
        workspace_id: string;
        invited_by_user_id: string;
        email: string;
        token: string;
        status: InvitationStatus;
        expires_at: Date;
        created_at: Date;
      }>(
        `
          SELECT * FROM public.workspace_invitations
          WHERE workspace_id = $1
            AND email = $2
            AND status = 'pending'
          LIMIT 1
        `,
        [workspaceId, email],
      );
      const row = result.rows[0];
      return row ? rowToRecord(row) : null;
    },

    async updateInvitationStatus(invitationId, status) {
      await db.query(
        `
          UPDATE public.workspace_invitations
          SET status = $2
          WHERE id = $1
        `,
        [invitationId, status],
      );
    },

    async updateInvitationStatusForWorkspace(
      invitationId,
      workspaceId,
      status,
    ) {
      const result = await db.query(
        `
          UPDATE public.workspace_invitations
          SET status = $3
          WHERE id = $1
            AND workspace_id = $2
        `,
        [invitationId, workspaceId, status],
      );
      return result.rowCount === 1;
    },
  };
}
