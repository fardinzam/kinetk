import type {
  WorkspaceQueries,
  WorkspaceRecord,
  WorkspaceSummary,
} from "./queries";

export type WorkspaceUser = {
  id: string;
  email?: string;
  name?: string | null;
};

function workspaceNameForUser(user: WorkspaceUser): string {
  const emailName = user.email?.split("@")[0];
  const baseName = user.name ?? emailName ?? "Developer";

  return `${baseName}'s workspace`;
}

async function getWorkspaceQueries(
  queries?: WorkspaceQueries,
): Promise<WorkspaceQueries> {
  if (queries) {
    return queries;
  }

  const workspaceQueriesModule = await import("./queries");
  return workspaceQueriesModule.createWorkspaceQueries();
}

export async function bootstrapDefaultWorkspace(
  user: WorkspaceUser,
  queries?: WorkspaceQueries,
): Promise<WorkspaceRecord> {
  const workspaceQueries = await getWorkspaceQueries(queries);

  if (!user.email) {
    throw new Error("Cannot bootstrap workspace without a user email");
  }

  await workspaceQueries.upsertUserProfile({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  const existing = await workspaceQueries.findOwnedWorkspace(user.id);
  const workspace =
    existing ??
    (await workspaceQueries.createWorkspace({
      ownerId: user.id,
      name: workspaceNameForUser(user),
    }));

  await workspaceQueries.ensureWorkspaceMembership({
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
  });

  return workspace;
}

export async function listWorkspacesForUser(
  userId: string,
  queries?: WorkspaceQueries,
): Promise<WorkspaceSummary[]> {
  const workspaceQueries = await getWorkspaceQueries(queries);

  return workspaceQueries.listWorkspacesForUser(userId);
}

export async function userCanAccessWorkspace(
  userId: string,
  workspaceId: string,
  queries?: WorkspaceQueries,
): Promise<boolean> {
  const workspaceQueries = await getWorkspaceQueries(queries);

  return workspaceQueries.userCanAccessWorkspace(userId, workspaceId);
}
