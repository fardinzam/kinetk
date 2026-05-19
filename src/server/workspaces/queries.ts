import type { Queryable } from "@/server/db/pool";
import { getPool } from "@/server/db/pool";

export type WorkspaceRole = "owner" | "member";

export type WorkspaceMember = {
  userId: string;
  email: string;
  name: string | null;
  role: WorkspaceRole;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

export type WorkspaceRecord = {
  id: string;
  ownerId: string;
  name: string;
};

export type WorkspaceQueries = {
  upsertUserProfile(user: {
    id: string;
    email: string;
    name?: string | null;
  }): Promise<void>;
  findOwnedWorkspace(userId: string): Promise<WorkspaceRecord | null>;
  createWorkspace(input: {
    ownerId: string;
    name: string;
  }): Promise<WorkspaceRecord>;
  ensureWorkspaceMembership(input: {
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
  }): Promise<void>;
  listWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]>;
  userCanAccessWorkspace(userId: string, workspaceId: string): Promise<boolean>;
  listMembersForWorkspace(workspaceId: string): Promise<WorkspaceMember[]>;
  removeWorkspaceMember(workspaceId: string, userId: string): Promise<void>;
};

export function createWorkspaceQueries(
  db: Queryable = getPool(),
): WorkspaceQueries {
  return {
    async upsertUserProfile(user) {
      await db.query(
        `
          insert into public.users (id, email, name, created_at)
          values ($1, $2, $3, now())
          on conflict (id) do update
            set email = excluded.email,
                name = excluded.name
        `,
        [user.id, user.email, user.name ?? null],
      );
    },
    async findOwnedWorkspace(userId) {
      const result = await db.query<{
        id: string;
        owner_id: string;
        name: string;
      }>(
        `
          select id, owner_id, name
          from public.workspaces
          where owner_id = $1
          order by created_at asc
          limit 1
        `,
        [userId],
      );
      const row = result.rows[0];

      return row ? { id: row.id, ownerId: row.owner_id, name: row.name } : null;
    },
    async createWorkspace(input) {
      const result = await db.query<{
        id: string;
        owner_id: string;
        name: string;
      }>(
        `
          insert into public.workspaces (owner_id, name)
          values ($1, $2)
          returning id, owner_id, name
        `,
        [input.ownerId, input.name],
      );
      const row = result.rows[0];

      if (!row) {
        throw new Error("Workspace creation failed");
      }

      return { id: row.id, ownerId: row.owner_id, name: row.name };
    },
    async ensureWorkspaceMembership(input) {
      await db.query(
        `
          insert into public.workspace_members (workspace_id, user_id, role)
          values ($1, $2, $3)
          on conflict (workspace_id, user_id) do nothing
        `,
        [input.workspaceId, input.userId, input.role],
      );
    },
    async listWorkspacesForUser(userId) {
      const result = await db.query<{
        id: string;
        name: string;
        role: WorkspaceRole;
      }>(
        `
          select workspaces.id, workspaces.name, workspace_members.role
          from public.workspace_members
          inner join public.workspaces
            on workspaces.id = workspace_members.workspace_id
          where workspace_members.user_id = $1
          order by workspaces.created_at asc
        `,
        [userId],
      );

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role,
      }));
    },
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
    async listMembersForWorkspace(workspaceId) {
      const result = await db.query<{
        user_id: string;
        email: string;
        name: string | null;
        role: WorkspaceRole;
      }>(
        `
          select wm.user_id, u.email, u.name, wm.role
          from public.workspace_members wm
          join public.users u on u.id = wm.user_id
          where wm.workspace_id = $1
          order by wm.created_at asc
        `,
        [workspaceId],
      );
      return result.rows.map((row) => ({
        userId: row.user_id,
        email: row.email,
        name: row.name,
        role: row.role,
      }));
    },
    async removeWorkspaceMember(workspaceId, userId) {
      await db.query(
        `
          delete from public.workspace_members
          where workspace_id = $1 and user_id = $2
        `,
        [workspaceId, userId],
      );
    },
  };
}
