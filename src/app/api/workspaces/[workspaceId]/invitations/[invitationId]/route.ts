import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import {
  revokeInvitation,
  InvitationAccessError,
} from "@/server/invitations/service";

type RouteContext = {
  params: Promise<{ workspaceId: string; invitationId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireUser();
  const { workspaceId, invitationId } = await context.params;

  try {
    await revokeInvitation({
      invitationId,
      requestingUserId: user.id,
      workspaceId,
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof InvitationAccessError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[invitations] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
