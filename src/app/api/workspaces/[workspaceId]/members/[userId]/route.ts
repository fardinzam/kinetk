import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import { createWorkspaceQueries } from "@/server/workspaces/queries";
import { removeWorkspaceMember } from "@/server/workspaces/service";

type RouteContext = {
  params: Promise<{ workspaceId: string; userId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireUser();
  const { workspaceId, userId } = await context.params;

  const q = createWorkspaceQueries();

  // Only workspace owners may remove members.
  const members = await q.listMembersForWorkspace(workspaceId);
  const requester = members.find((m) => m.userId === user.id);

  if (!requester) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (requester.role !== "owner") {
    return NextResponse.json(
      { error: "Only the workspace owner can remove members" },
      { status: 403 },
    );
  }

  // Cannot remove the workspace owner.
  const target = members.find((m) => m.userId === userId);
  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "Cannot remove the workspace owner" },
      { status: 400 },
    );
  }

  try {
    await removeWorkspaceMember(workspaceId, userId);
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("[members] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
