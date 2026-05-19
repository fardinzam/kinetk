import { NextResponse } from "next/server";

import { getInvitationByToken } from "@/server/invitations/service";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;

  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return NextResponse.json(
      { error: "Invitation not found" },
      { status: 404 },
    );
  }

  if (invitation.status !== "pending" || invitation.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Invitation is no longer valid" },
      { status: 410 },
    );
  }

  return NextResponse.json({
    workspaceName: invitation.workspaceName,
    email: invitation.email,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
  });
}
