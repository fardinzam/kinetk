import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import {
  acceptInvitation,
  InvitationNotFoundError,
  InvitationExpiredError,
  InvitationAlreadyAcceptedError,
} from "@/server/invitations/service";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireUser();
  const { token } = await context.params;

  try {
    await acceptInvitation({
      token,
      acceptingUserId: user.id,
      acceptingUserEmail: user.email ?? "",
      acceptingUserName: user.user_metadata?.name ?? null,
    });
    return NextResponse.json({ accepted: true });
  } catch (err) {
    if (
      err instanceof InvitationNotFoundError ||
      err instanceof InvitationExpiredError
    ) {
      return NextResponse.json({ error: err.message }, { status: 410 });
    }
    if (err instanceof InvitationAlreadyAcceptedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[invitations] accept error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
