import { describe, expect, it } from "vitest";

import {
  bootstrapDefaultWorkspace,
  listWorkspacesForUser,
  userCanAccessWorkspace,
} from "./service";
import type { WorkspaceQueries } from "./queries";

function createWorkspaceQueries(): WorkspaceQueries & {
  workspaces: Array<{ id: string; ownerId: string; name: string }>;
  members: Array<{
    workspaceId: string;
    userId: string;
    role: "owner" | "member";
  }>;
} {
  const users = new Map<string, { email: string; name: string | null }>();
  const workspaces: Array<{ id: string; ownerId: string; name: string }> = [];
  const members: Array<{
    workspaceId: string;
    userId: string;
    role: "owner" | "member";
  }> = [];

  return {
    workspaces,
    members,
    async upsertUserProfile(user) {
      users.set(user.id, {
        email: user.email,
        name: user.name ?? null,
      });
    },
    async findOwnedWorkspace(userId) {
      return (
        workspaces.find((workspace) => workspace.ownerId === userId) ?? null
      );
    },
    async createWorkspace(input) {
      const workspace = {
        id: `workspace_${workspaces.length + 1}`,
        ownerId: input.ownerId,
        name: input.name,
      };
      workspaces.push(workspace);
      return workspace;
    },
    async ensureWorkspaceMembership(input) {
      if (
        !members.some(
          (member) =>
            member.workspaceId === input.workspaceId &&
            member.userId === input.userId,
        )
      ) {
        members.push(input);
      }
    },
    async listWorkspacesForUser(userId) {
      return members
        .filter((member) => member.userId === userId)
        .map((member) => {
          const workspace = workspaces.find(
            (candidate) => candidate.id === member.workspaceId,
          );

          if (!workspace) {
            throw new Error("Test workspace missing");
          }

          return {
            id: workspace.id,
            name: workspace.name,
            role: member.role,
          };
        });
    },
    async userCanAccessWorkspace(userId, workspaceId) {
      return members.some(
        (member) =>
          member.userId === userId && member.workspaceId === workspaceId,
      );
    },
  };
}

describe("workspace service", () => {
  it("bootstraps a default owner workspace idempotently", async () => {
    const queries = createWorkspaceQueries();
    const user = {
      id: "user_1",
      email: "developer@example.com",
      name: "Developer",
    };

    const first = await bootstrapDefaultWorkspace(user, queries);
    const second = await bootstrapDefaultWorkspace(user, queries);

    expect(second).toEqual(first);
    expect(queries.workspaces).toHaveLength(1);
    expect(queries.members).toEqual([
      { workspaceId: first.id, userId: "user_1", role: "owner" },
    ]);
  });

  it("returns only workspaces where the user is a member", async () => {
    const queries = createWorkspaceQueries();
    const first = await bootstrapDefaultWorkspace(
      { id: "user_1", email: "one@example.com" },
      queries,
    );
    await bootstrapDefaultWorkspace(
      { id: "user_2", email: "two@example.com" },
      queries,
    );

    await expect(listWorkspacesForUser("user_1", queries)).resolves.toEqual([
      { id: first.id, name: "one's workspace", role: "owner" },
    ]);
  });

  it("denies workspace access for non-members", async () => {
    const queries = createWorkspaceQueries();
    const workspace = await bootstrapDefaultWorkspace(
      { id: "owner", email: "owner@example.com" },
      queries,
    );

    await expect(
      userCanAccessWorkspace("outsider", workspace.id, queries),
    ).resolves.toBe(false);
  });
});
