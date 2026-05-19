"use server";

import { cookies } from "next/headers";

import { requireUser } from "@/server/auth/session";
import { createWorkspaceQueries } from "@/server/workspaces/queries";

export async function setActiveWorkspace(workspaceId: string): Promise<void> {
  const user = await requireUser();
  const q = createWorkspaceQueries();
  const canAccess = await q.userCanAccessWorkspace(user.id, workspaceId);
  if (!canAccess) return;

  const cookieStore = await cookies();
  cookieStore.set("active_workspace_id", workspaceId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
